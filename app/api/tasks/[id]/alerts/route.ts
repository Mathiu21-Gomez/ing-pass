import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskAlerts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const alerts = await db
      .select()
      .from(taskAlerts)
      .where(and(eq(taskAlerts.taskId, taskId), eq(taskAlerts.userId, user.id)))

    return NextResponse.json(alerts)
  } catch (err) {
    console.error("Error fetching alerts:", err)
    return NextResponse.json({ error: "Error al obtener alertas" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const body = await request.json()
    const { alertAt, message } = body

    if (!alertAt) {
      return NextResponse.json({ error: "alertAt es requerido" }, { status: 400 })
    }

    const [newAlert] = await db
      .insert(taskAlerts)
      .values({
        taskId,
        userId: user.id,
        alertAt: new Date(alertAt),
        message: message ?? "",
      })
      .returning()

    return NextResponse.json(newAlert, { status: 201 })
  } catch (err) {
    console.error("Error creating alert:", err)
    return NextResponse.json({ error: "Error al crear alerta" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const body = await request.json()
    const { alertId, dismissed } = body

    if (!alertId) {
      return NextResponse.json({ error: "alertId es requerido" }, { status: 400 })
    }

    const [updated] = await db
      .update(taskAlerts)
      .set({ dismissed: dismissed ?? true })
      .where(and(eq(taskAlerts.id, alertId), eq(taskAlerts.userId, user.id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Error updating alert:", err)
    return NextResponse.json({ error: "Error al actualizar alerta" }, { status: 500 })
  }
}
