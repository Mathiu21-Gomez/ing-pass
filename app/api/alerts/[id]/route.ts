import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskAlerts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

/** PATCH /api/alerts/[id] — Dismiss an alert */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const { id } = await params

  try {
    const [updated] = await db
      .update(taskAlerts)
      .set({ dismissed: true })
      .where(and(eq(taskAlerts.id, id), eq(taskAlerts.userId, user.id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Alarma no encontrada" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error("PATCH /api/alerts/[id] error:", err)
    return NextResponse.json({ error: "Error al descartar alarma" }, { status: 500 })
  }
}
