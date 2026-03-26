import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activities, tasks } from "@/db/schema"
import { activitySchema } from "@/lib/schemas"
import { eq, and } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const { error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const taskActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.taskId, taskId))

    return NextResponse.json(taskActivities)
  } catch (error) {
    console.error("Error fetching activities:", error)
    return NextResponse.json(
      { error: "Error al obtener actividades" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id: taskId } = await params
    const { error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const body = await request.json()
    const parsed = activitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const createdBy: string = authUser.id

    const [newActivity] = await db
      .insert(activities)
      .values({
        taskId,
        name: parsed.data.name,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate || null,
        createdBy,
      })
      .returning()

    return NextResponse.json(newActivity, { status: 201 })
  } catch (error) {
    console.error("Error creating activity:", error)
    return NextResponse.json(
      { error: "Error al crear actividad" },
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
    const { id: taskId } = await params
    const { error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const body = await request.json()
    const { activityId, completed } = body as {
      activityId: string
      completed: boolean
    }

    if (!activityId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Se requiere activityId y completed" },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(activities)
      .set({ completed })
      .where(and(eq(activities.id, activityId), eq(activities.taskId, taskId)))
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      )
    }

    // Check if all activities are completed to auto-update task status
    const allActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.taskId, taskId))

    let taskStatusChanged = false
    let newTaskStatus: string | null = null

    if (allActivities.length > 0) {
      const allDone = allActivities.every((a) => a.completed)

      if (allDone) {
        // All activities done → mark task as ready for review
        await db
          .update(tasks)
          .set({ status: "listo_para_revision" })
          .where(eq(tasks.id, taskId))
        taskStatusChanged = true
        newTaskStatus = "listo_para_revision"
      } else if (!completed) {
        // Unchecking an activity — revert task from listo_para_revision back to en_curso
        const [currentTask] = await db
          .select({ status: tasks.status })
          .from(tasks)
          .where(eq(tasks.id, taskId))

        if (currentTask?.status === "listo_para_revision") {
          await db
            .update(tasks)
            .set({ status: "en_curso" })
            .where(eq(tasks.id, taskId))
          taskStatusChanged = true
          newTaskStatus = "en_curso"
        }
      }
    }

    return NextResponse.json({ ...updated, taskStatusChanged, newTaskStatus })
  } catch (error) {
    console.error("Error updating activity:", error)
    return NextResponse.json(
      { error: "Error al actualizar actividad" },
      { status: 500 }
    )
  }
}
