import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activities } from "@/db/schema"
import { activitySchema } from "@/lib/schemas"
import { eq, and } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
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
  try {
    const { id: taskId } = await params
    const body = await request.json()
    const parsed = activitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const createdBy: string = body.createdBy ?? ""

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
  try {
    const { id: taskId } = await params
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating activity:", error)
    return NextResponse.json(
      { error: "Error al actualizar actividad" },
      { status: 500 }
    )
  }
}
