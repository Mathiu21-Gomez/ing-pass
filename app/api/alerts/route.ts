import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskAlerts, tasks } from "@/db/schema"
import { eq, and, lte } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

/** GET /api/alerts — Returns all pending (non-dismissed) alerts due now or in the past for the current user */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const now = new Date()
    const pendingAlerts = await db
      .select({
        id: taskAlerts.id,
        taskId: taskAlerts.taskId,
        alertAt: taskAlerts.alertAt,
        message: taskAlerts.message,
        dismissed: taskAlerts.dismissed,
        createdAt: taskAlerts.createdAt,
        taskName: tasks.name,
        correlativeId: tasks.correlativeId,
      })
      .from(taskAlerts)
      .innerJoin(tasks, eq(taskAlerts.taskId, tasks.id))
      .where(
        and(
          eq(taskAlerts.userId, user.id),
          eq(taskAlerts.dismissed, false),
          lte(taskAlerts.alertAt, now)
        )
      )

    return NextResponse.json(pendingAlerts)
  } catch (err) {
    console.error("Error fetching alerts:", err)
    return NextResponse.json({ error: "Error al obtener alertas" }, { status: 500 })
  }
}
