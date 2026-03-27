import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskAssignments, activities, documents, comments, taskTags, tags } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params
    const { error: accessError } = await getTaskAccessContext(id, authUser)
    if (accessError) return accessError

    const task = await db.select().from(tasks).where(eq(tasks.id, id))

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    const assigns = await db
      .select()
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
      assignedTo: assigns.map((a) => a.userId),
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
    const { error: accessError } = await getTaskAccessContext(id, authUser)
    if (accessError) return accessError

    const body = await request.json()

    if (body.assignedTo !== undefined && !isStringArray(body.assignedTo)) {
      return NextResponse.json(
        { error: "assignedTo debe ser un array de strings" },
        { status: 400 }
      )
    }

    const assignedTo = body.assignedTo !== undefined
      ? uniqueStrings(body.assignedTo)
      : undefined

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.guidelines !== undefined) updateData.guidelines = body.guidelines
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate || null
    if (body.status !== undefined) updateData.status = body.status

    if (Object.keys(updateData).length === 0 && !assignedTo) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      )
    }

    let currentTask

    if (assignedTo !== undefined) {
      if (Object.keys(updateData).length > 0) {
        if (assignedTo.length > 0) {
          const [updated] = await db.batch([
            db
              .update(tasks)
              .set(updateData)
              .where(eq(tasks.id, id))
              .returning(),
            db.delete(taskAssignments).where(eq(taskAssignments.taskId, id)),
            db.insert(taskAssignments).values(
              assignedTo.map((userId) => ({ taskId: id, userId }))
            ),
          ])

          if (updated.length === 0) {
            currentTask = null
          } else {
            currentTask = updated[0]
          }
        } else {
          const [updated] = await db.batch([
            db
              .update(tasks)
              .set(updateData)
              .where(eq(tasks.id, id))
              .returning(),
            db.delete(taskAssignments).where(eq(taskAssignments.taskId, id)),
          ])

          if (updated.length === 0) {
            currentTask = null
          } else {
            currentTask = updated[0]
          }
        }
      } else if (assignedTo.length > 0) {
        const [existing] = await db.batch([
          db.select().from(tasks).where(eq(tasks.id, id)),
          db.delete(taskAssignments).where(eq(taskAssignments.taskId, id)),
          db.insert(taskAssignments).values(
            assignedTo.map((userId) => ({ taskId: id, userId }))
          ),
        ])

        if (existing.length === 0) {
          currentTask = null
        } else {
          currentTask = existing[0]
        }
      } else {
        const [existing] = await db.batch([
          db.select().from(tasks).where(eq(tasks.id, id)),
          db.delete(taskAssignments).where(eq(taskAssignments.taskId, id)),
        ])

        if (existing.length === 0) {
          currentTask = null
        } else {
          currentTask = existing[0]
        }
      }
    } else if (Object.keys(updateData).length > 0) {
      const updated = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning()

      if (updated.length === 0) {
        currentTask = null
      } else {
        currentTask = updated[0]
      }
    } else {
      const existing = await db.select().from(tasks).where(eq(tasks.id, id))

      if (existing.length === 0) {
        currentTask = null
      } else {
        currentTask = existing[0]
      }
    }

    const updatedTask = currentTask
      ? {
          ...currentTask,
          assignedTo,
        }
      : null

    if (!updatedTask) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
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
