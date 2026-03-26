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
import { and, eq } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

function toProjectResponse<T extends Record<string, unknown>>(
  project: T,
  assignedWorkers: string[]
) {
  return {
    ...project,
    assignedWorkers,
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

    const workers = await db
      .select()
      .from(projectWorkers)
      .where(eq(projectWorkers.projectId, id))

    const urls = await db
      .select()
      .from(projectUrls)
      .where(eq(projectUrls.projectId, id))

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, id))

    const projectDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, id))

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
      assignedWorkers: workers.map((w) => w.userId),
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
    const parsed = projectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { assignedWorkers, ...projectData } = parsed.data

    const updated = await db
      .update(projects)
      .set(projectData)
      .where(eq(projects.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      )
    }

    await db
      .delete(projectWorkers)
      .where(eq(projectWorkers.projectId, id))

    if (assignedWorkers.length > 0) {
      await db.insert(projectWorkers).values(
        assignedWorkers.map((userId) => ({
          projectId: id,
          userId,
        }))
      )
    }

    return NextResponse.json(toProjectResponse(updated[0], assignedWorkers))
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
