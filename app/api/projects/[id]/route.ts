import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  clients,
  projects,
  projectWorkers,
  projectUrls,
  tasks,
  taskAssignments,
  activities,
  documents,
} from "@/db/schema"
import { projectSchema } from "@/lib/schemas"
import { and, eq, inArray } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import { getProjectMembership, syncProjectMembers } from "@/lib/project-membership-store"

function toProjectResponse<T extends Record<string, unknown>>(
  project: T,
  assignedWorkers: string[],
  coordinatorIds: string[],
  projectMembers?: Array<{ userId: string; role: "coordinador" | "colaborador" | "modelador" | "lider" }>
) {
  return {
    ...project,
    coordinatorId: coordinatorIds[0] ?? (project.coordinatorId as string),
    coordinatorIds,
    assignedWorkers,
    projectMembers: projectMembers ?? [],
    tasks: [],
    documents: [],
    urls: [],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params

    let project

    if (authUser.role === "externo") {
      const matchingClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.email, authUser.email))
        .limit(1)

      if (matchingClient.length === 0) {
        return NextResponse.json(
          { error: "Proyecto no encontrado" },
          { status: 404 }
        )
      }

      project = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.clientId, matchingClient[0].id)))
    } else {
      const roleError = requireRole(authUser, ["admin", "coordinador"])
      if (roleError) return roleError

      project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
    }

    if (project.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      )
    }

    const [workers, urls, projectTasks, projectDocs, membership] = await Promise.all([
      db.select().from(projectWorkers).where(eq(projectWorkers.projectId, id)),
      db.select().from(projectUrls).where(eq(projectUrls.projectId, id)),
      db.select().from(tasks).where(eq(tasks.projectId, id)),
      db.select().from(documents).where(eq(documents.projectId, id)),
      getProjectMembership(id, { legacyCoordinatorId: project[0].coordinatorId }),
    ])

    const enrichedTasks = await Promise.all(
      projectTasks.map(async (task) => {
        const assigns = await db
          .select()
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id))

        const taskActivities = await db
          .select()
          .from(activities)
          .where(eq(activities.taskId, task.id))

        const taskDocs = await db
          .select()
          .from(documents)
          .where(eq(documents.taskId, task.id))

        return {
          ...task,
          assignedTo: assigns.map((a) => a.userId),
          activities: taskActivities,
          documents: taskDocs,
        }
      })
    )

    return NextResponse.json({
      ...project[0],
      coordinatorId: membership.coordinatorIds[0] ?? project[0].coordinatorId,
      coordinatorIds: membership.coordinatorIds,
      assignedWorkers: membership.assignedWorkerIds.length > 0
        ? membership.assignedWorkerIds
        : workers.map((w) => w.userId),
      projectMembers: membership.projectMembers,
      urls: urls.map((u) => ({ id: u.id, label: u.label, url: u.url })),
      tasks: enrichedTasks,
      documents: projectDocs,
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json(
      { error: "Error al obtener proyecto" },
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

  const roleError = requireRole(authUser, ["admin", "coordinador"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const body = await request.json()

    // Progress-only update (quick edit from card)
    if (typeof body.progress === "number" && Object.keys(body).length === 1) {
      const progress = Math.min(Math.max(Math.round(body.progress), 0), 100)
      const [updated] = await db.update(projects).set({ progress }).where(eq(projects.id, id)).returning()
      if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
      const [workers, membership] = await Promise.all([
        db.select().from(projectWorkers).where(eq(projectWorkers.projectId, id)),
        getProjectMembership(id, { legacyCoordinatorId: updated.coordinatorId }),
      ])
      return NextResponse.json(
        toProjectResponse(
          updated,
          membership.assignedWorkerIds.length > 0
            ? membership.assignedWorkerIds
            : workers.map((w) => w.userId),
          membership.coordinatorIds,
          membership.projectMembers
        )
      )
    }

    const parsed = projectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { assignedWorkers, coordinatorIds, coordinatorId, ...projectData } = parsed.data
    const leaderIds: string[] = Array.isArray(body.leaderIds) ? body.leaderIds : []

    const updated = await db
      .update(projects)
      .set({
        ...projectData,
        coordinatorId,
      })
      .where(eq(projects.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      )
    }

    // Diff-based sync: only add/remove what changed (avoids unnecessary churn)
    const existingWorkerRows = await db
      .select({ userId: projectWorkers.userId })
      .from(projectWorkers)
      .where(eq(projectWorkers.projectId, id))

    const existingIds = new Set(existingWorkerRows.map((r) => r.userId))
    const nextIds = new Set(assignedWorkers)

    const toAdd = assignedWorkers.filter((uid) => !existingIds.has(uid))
    const toRemove = [...existingIds].filter((uid) => !nextIds.has(uid))

    if (toRemove.length > 0) {
      await db
        .delete(projectWorkers)
        .where(and(eq(projectWorkers.projectId, id), inArray(projectWorkers.userId, toRemove)))
    }

    if (toAdd.length > 0) {
      await db.insert(projectWorkers).values(
        toAdd.map((userId) => ({ projectId: id, userId }))
      )
    }

    const currentMembership = await getProjectMembership(id, { legacyCoordinatorId: updated[0].coordinatorId })
    const modelerIds = currentMembership.projectMembers
      .filter((member) => member.role === "modelador")
      .map((member) => member.userId)

    await syncProjectMembers({
      projectId: id,
      coordinatorIds,
      assignedWorkerIds: assignedWorkers,
      leaderIds,
      modelerIds,
    })

    const leaderSet = new Set(leaderIds)
    const modelerSet = new Set(modelerIds)
    return NextResponse.json(toProjectResponse(updated[0], assignedWorkers, coordinatorIds, [
      ...coordinatorIds.map((userId) => ({ userId, role: "coordinador" as const })),
      ...leaderIds.map((userId) => ({ userId, role: "lider" as const })),
      ...modelerIds.map((userId) => ({ userId, role: "modelador" as const })),
      ...assignedWorkers
        .filter((userId) => !leaderSet.has(userId) && !modelerSet.has(userId))
        .map((userId) => ({ userId, role: "colaborador" as const })),
    ]))
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Error al actualizar proyecto" },
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

  const roleError = requireRole(authUser, ["admin", "coordinador"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const deleted = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Error al eliminar proyecto" },
      { status: 500 }
    )
  }
}
