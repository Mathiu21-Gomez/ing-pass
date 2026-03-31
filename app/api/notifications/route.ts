import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { notifications, user } from "@/db/schema"
import { getAuthUser } from "@/lib/api-auth"
import { eq, desc, isNull, and, inArray, sql } from "drizzle-orm"

// ── GET /api/notifications ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        fromUserId: notifications.fromUserId,
        fromUserName: user.name,
        message: notifications.message,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(user, eq(notifications.fromUserId, user.id))
      .where(eq(notifications.userId, authUser.id))
      .orderBy(desc(notifications.createdAt))

    const unreadCount = rows.filter((n) => n.readAt === null).length

    return NextResponse.json({ notifications: rows, unreadCount })
  } catch (err) {
    console.error("GET /api/notifications error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/notifications ───────────────────────────────────────────────
// Body: { ids?: string[] } — omit to mark ALL unread
export async function PATCH(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = body?.ids

    const baseCondition = and(
      eq(notifications.userId, authUser.id),
      isNull(notifications.readAt)
    )

    const whereCondition =
      ids && ids.length > 0
        ? and(baseCondition, inArray(notifications.id, ids))
        : baseCondition

    const result = await db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(whereCondition)
      .returning({ id: notifications.id })

    return NextResponse.json({ updated: result.length })
  } catch (err) {
    console.error("PATCH /api/notifications error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
