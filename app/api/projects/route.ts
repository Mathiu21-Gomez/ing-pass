import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  projects,
  projectWorkers,
  projectUrls,
  tasks,
  taskAssignments,
  activities,
  documents,
} from "@/db/schema"
import { projectSchema } from "@/lib/schemas"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")

    let query = db.select().from(projects)

    if (status) {
      query = query.where(eq(projects.status, status as "Activo" | "Pausado" | "Finalizado")) as typeof query
    }
    if (clientId) {
      query = query.where(eq(projects.clientId, clientId)) as typeof query
    }

    const allProjects = await query

    const enriched = await Promise.all(
      allProjects.map(async (project) => {
        const workers = await db
          .select()
          .from(projectWorkers)
          .where(eq(projectWorkers.projectId, project.id))

        const urls = await db
          .select()
          .from(projectUrls)
          .where(eq(projectUrls.projectId, project.id))

        const projectTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, project.id))

        const projectDocs = await db
          .select()
          .from(documents)
          .where(eq(documents.projectId, project.id))

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

        return {
          ...project,
          assignedWorkers: workers.map((w) => w.userId),
          urls: urls.map((u) => ({ label: u.label, url: u.url })),
          tasks: enrichedTasks,
          documents: projectDocs,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = projectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { assignedWorkers, ...projectData } = parsed.data

    const [newProject] = await db
      .insert(projects)
      .values(projectData)
      .returning()

    if (assignedWorkers.length > 0) {
      await db.insert(projectWorkers).values(
        assignedWorkers.map((userId) => ({
          projectId: newProject.id,
          userId,
        }))
      )
    }

    return NextResponse.json(
      { ...newProject, assignedWorkers },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Error al crear proyecto" },
      { status: 500 }
    )
  }
}
