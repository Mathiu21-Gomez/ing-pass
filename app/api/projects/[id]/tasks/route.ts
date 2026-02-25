import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskAssignments, activities, documents } from "@/db/schema"
import { taskSchema } from "@/lib/schemas"
import { eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))

    const enriched = await Promise.all(
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

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return NextResponse.json(
      { error: "Error al obtener tareas del proyecto" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const parsed = taskSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const assignedTo: string[] = body.assignedTo ?? []
    const createdBy: string = body.createdBy ?? ""

    const [newTask] = await db
      .insert(tasks)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        projectId,
        createdBy,
        dueDate: parsed.data.dueDate || null,
      })
      .returning()

    if (assignedTo.length > 0) {
      await db.insert(taskAssignments).values(
        assignedTo.map((userId) => ({ taskId: newTask.id, userId }))
      )
    }

    return NextResponse.json(
      { ...newTask, assignedTo, activities: [], documents: [] },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Error al crear tarea" },
      { status: 500 }
    )
  }
}
