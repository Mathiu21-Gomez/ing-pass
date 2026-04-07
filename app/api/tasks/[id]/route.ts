import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskAssignments, activities, documents, comments, taskTags, tags, notifications, projectWorkers, user as userTable } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"

const SINGLE_ASSIGNEE_ERROR = "Cada tarea puede tener solo 1 trabajador responsable"

async function createTaskAssignedNotifications(input: {
  taskId: string
  taskName: string
  newUserIds: string[]
  assignedById: string
  assignedByName: string
}) {
  const usersToNotify = input.newUserIds.filter((id) => id !== input.assignedById)
  if (usersToNotify.length === 0) return
  try {
    await db.insert(notifications).values(
      usersToNotify.map((userId) => ({
        userId,
        type: "task_assigned" as const,
        entityType: "task" as const,
        entityId: input.taskId,
        fromUserId: input.assignedById,
        message: `${input.assignedByName} te asignó la tarea "${input.taskName}"`,
      }))
    )
  } catch (err) {
    console.error("Error creating task_assigned notifications:", err)
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

const WORKER_EDITABLE_FIELDS = new Set(["guidelines", "status"])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params
    const accessResult = await getTaskAccessContext(id, authUser)
    if (accessResult.error) return accessResult.error

    const task = await db.select().from(tasks).where(eq(tasks.id, id))

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    const assigns = await db
      .select({ userId: taskAssignments.userId, role: taskAssignments.role })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, id))

    const taskActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.taskId, id))

    const taskDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.taskId, id))

    const taskComments = await db
      .select()
      .from(comments)
      .where(and(eq(comments.parentType, "task"), eq(comments.parentId, id)))

    const taskTagRows = await db
      .select({ id: tags.id, name: tags.name, color: tags.color, projectId: tags.projectId, createdBy: tags.createdBy, createdAt: tags.createdAt })
      .from(taskTags)
      .innerJoin(tags, eq(taskTags.tagId, tags.id))
      .where(eq(taskTags.taskId, id))

    return NextResponse.json({
      ...task[0],
      assignedTo: assigns.filter((a) => a.role === "primary").map((a) => a.userId),
      supportIds: assigns.filter((a) => a.role === "support").map((a) => a.userId),
      activities: taskActivities,
      documents: taskDocs,
      comments: taskComments,
      tags: taskTagRows,
    })
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json(
      { error: "Error al obtener tarea" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id } = await params
    const accessResult = await getTaskAccessContext(id, authUser)
    if (accessResult.error) return accessResult.error

    const body = await request.json()

    if (authUser.role === "trabajador") {
      const attemptedFields = Object.keys(body).filter((key) => body[key] !== undefined)
      const invalidFields = attemptedFields.filter((key) => !WORKER_EDITABLE_FIELDS.has(key))

      if (invalidFields.length > 0) {
        return NextResponse.json(
          { error: "Los trabajadores solo pueden actualizar el estado o las pautas de la tarea" },
          { status: 403 }
        )
      }

      // Workers cannot set a task as finalizado — only coordinators/admins close tasks
      if (body.status === "finalizado") {
        return NextResponse.json(
          { error: "Los trabajadores no pueden finalizar tareas. Usá 'Listo para revisión'." },
          { status: 403 }
        )
      }
    }

    if (body.assignedTo !== undefined && !isStringArray(body.assignedTo)) {
      return NextResponse.json(
        { error: "assignedTo debe ser un array de strings" },
        { status: 400 }
      )
    }

    if (body.supportIds !== undefined && !isStringArray(body.supportIds)) {
      return NextResponse.json(
        { error: "supportIds debe ser un array de strings" },
        { status: 400 }
      )
    }

    const assignedTo = body.assignedTo !== undefined
      ? uniqueStrings(body.assignedTo)
      : undefined

    const supportIds = body.supportIds !== undefined
      ? uniqueStrings(body.supportIds)
      : undefined

    // Primary assignee: max 1
    if (assignedTo && assignedTo.length > 1) {
      return NextResponse.json(
        { error: SINGLE_ASSIGNEE_ERROR },
        { status: 400 }
      )
    }

    // Validate primary assignees
    if (assignedTo && assignedTo.length > 0) {
      const [validMembershipRows, validWorkerRows] = await Promise.all([
        db
          .select({ userId: projectWorkers.userId })
          .from(projectWorkers)
          .where(
            and(
              eq(projectWorkers.projectId, accessResult.context.projectId),
              inArray(projectWorkers.userId, assignedTo)
            )
          ),
        db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(
              inArray(userTable.id, assignedTo),
              eq(userTable.active, true),
              eq(userTable.role, "trabajador")
            )
          ),
      ])

      if (validMembershipRows.length !== assignedTo.length) {
        return NextResponse.json(
          { error: "Hay trabajadores que no pertenecen al proyecto" },
          { status: 400 }
        )
      }

      if (validWorkerRows.length !== assignedTo.length) {
        return NextResponse.json(
          { error: "Solo se puede asignar un trabajador activo por tarea" },
          { status: 400 }
        )
      }
    }

    // Validate support workers
    if (supportIds && supportIds.length > 0) {
      const [validSupportMembership, validSupportWorkers] = await Promise.all([
        db
          .select({ userId: projectWorkers.userId })
          .from(projectWorkers)
          .where(
            and(
              eq(projectWorkers.projectId, accessResult.context.projectId),
              inArray(projectWorkers.userId, supportIds)
            )
          ),
        db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(
              inArray(userTable.id, supportIds),
              eq(userTable.active, true),
              eq(userTable.role, "trabajador")
            )
          ),
      ])

      if (validSupportMembership.length !== supportIds.length) {
        return NextResponse.json(
          { error: "Hay apoyos que no pertenecen al proyecto" },
          { status: 400 }
        )
      }

      if (validSupportWorkers.length !== supportIds.length) {
        return NextResponse.json(
          { error: "Solo se pueden asignar trabajadores activos como apoyo" },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.guidelines !== undefined) updateData.guidelines = body.guidelines
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate || null
    if (body.status !== undefined) updateData.status = body.status

    const hasAssignmentChange = assignedTo !== undefined || supportIds !== undefined

    if (Object.keys(updateData).length === 0 && !hasAssignmentChange) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      )
    }

    // Capture current assignments before mutation for diff (notifications)
    let previousPrimaryIds: string[] = []
    if (hasAssignmentChange) {
      const prevRows = await db
        .select({ userId: taskAssignments.userId, role: taskAssignments.role })
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, id))
      previousPrimaryIds = prevRows.filter((r) => r.role === "primary").map((r) => r.userId)
    }

    // Build the new full assignment list (primary + support)
    let newAssignmentRows: { taskId: string; userId: string; role: "primary" | "support" }[] | undefined
    if (hasAssignmentChange) {
      // Load current assignments to merge with partial updates
      const currentRows = await db
        .select({ userId: taskAssignments.userId, role: taskAssignments.role })
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, id))

      const currentPrimary = currentRows.filter((r) => r.role === "primary").map((r) => r.userId)
      const currentSupport = currentRows.filter((r) => r.role === "support").map((r) => r.userId)

      const finalPrimary = assignedTo ?? currentPrimary
      const finalSupport = supportIds ?? currentSupport

      newAssignmentRows = [
        ...finalPrimary.map((userId) => ({ taskId: id, userId, role: "primary" as const })),
        ...finalSupport.map((userId) => ({ taskId: id, userId, role: "support" as const })),
      ]
    }

    let currentTask

    if (Object.keys(updateData).length > 0) {
      const updated = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning()

      currentTask = updated[0] ?? null
    } else {
      const existing = await db.select().from(tasks).where(eq(tasks.id, id))
      currentTask = existing[0] ?? null
    }

    if (newAssignmentRows !== undefined) {
      await db.delete(taskAssignments).where(eq(taskAssignments.taskId, id))
      if (newAssignmentRows.length > 0) {
        await db.insert(taskAssignments).values(newAssignmentRows)
      }
    }

    if (!currentTask) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    // Build response with split assignment roles
    const finalAssignRows = await db
      .select({ userId: taskAssignments.userId, role: taskAssignments.role })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, id))

    const finalPrimaryIds = finalAssignRows.filter((r) => r.role === "primary").map((r) => r.userId)
    const finalSupportIds = finalAssignRows.filter((r) => r.role === "support").map((r) => r.userId)

    const updatedTask = {
      ...currentTask,
      assignedTo: finalPrimaryIds,
      supportIds: finalSupportIds,
    }

    // Notify newly added primary assignees
    if (assignedTo !== undefined && assignedTo.length > 0) {
      const prevSet = new Set(previousPrimaryIds)
      const newlyAssigned = assignedTo.filter((uid) => !prevSet.has(uid))
      if (newlyAssigned.length > 0) {
        void createTaskAssignedNotifications({
          taskId: id,
          taskName: updatedTask.name ?? "",
          newUserIds: newlyAssigned,
          assignedById: authUser.id,
          assignedByName: authUser.name,
        })
      }
    }

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json(
      { error: "Error al actualizar tarea" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id } = await params
    const { error: accessError } = await getTaskAccessContext(id, authUser)
    if (accessError) return accessError

    const deleted = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Error al eliminar tarea" },
      { status: 500 }
    )
  }
}
