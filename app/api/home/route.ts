import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, tasks, taskAssignments, taskAlerts, tags, taskTags } from "@/db/schema"
import { eq, and, lte, inArray, desc } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

/** GET /api/home — Aggregated home data: events, my tasks, pending alerts */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const userRole = user.role ?? "trabajador"
    const now = new Date()

    // 1. Events visible to this role (pinned first, max 20)
    const allEvents = await db
      .select()
      .from(events)
      .orderBy(desc(events.pinned), desc(events.createdAt))
      .limit(20)

    const visibleEvents = allEvents.filter(
      (e) => !e.targetRoles || e.targetRoles.length === 0 || e.targetRoles.includes(userRole)
    )

    // 2. Tasks assigned to current user (not finalizado/retrasado)
    const myAssignments = await db
      .select({ taskId: taskAssignments.taskId })
      .from(taskAssignments)
      .where(eq(taskAssignments.userId, user.id))

    const myTaskIds = myAssignments.map((a) => a.taskId)

    let myTasks: unknown[] = []
    if (myTaskIds.length > 0) {
      const taskList = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, myTaskIds))

      // Get tags for each task
      myTasks = await Promise.all(
        taskList.map(async (task) => {
          const taskTagRows = await db
            .select({ id: tags.id, name: tags.name, color: tags.color })
            .from(taskTags)
            .innerJoin(tags, eq(taskTags.tagId, tags.id))
            .where(eq(taskTags.taskId, task.id))
          return { ...task, tags: taskTagRows }
        })
      )
    }

    // 3. Pending alerts for current user
    const pendingAlerts = await db
      .select()
      .from(taskAlerts)
      .where(
        and(
          eq(taskAlerts.userId, user.id),
          eq(taskAlerts.dismissed, false),
          lte(taskAlerts.alertAt, now)
        )
      )

    return NextResponse.json({
      events: visibleEvents,
      myTasks,
      pendingAlerts,
    })
  } catch (err) {
    console.error("Error fetching home data:", err)
    return NextResponse.json({ error: "Error al obtener datos de inicio" }, { status: 500 })
  }
}
