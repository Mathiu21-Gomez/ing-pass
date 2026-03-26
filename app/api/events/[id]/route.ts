import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  if (!["admin", "coordinador"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.content !== undefined) updateData.content = body.content
    if (body.type !== undefined) updateData.type = body.type
    if (body.eventDate !== undefined) updateData.eventDate = body.eventDate || null
    if (body.targetRoles !== undefined) updateData.targetRoles = body.targetRoles
    if (body.pinned !== undefined) updateData.pinned = body.pinned

    const [updated] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Error updating event:", err)
    return NextResponse.json({ error: "Error al actualizar evento" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  if (!["admin", "coordinador"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  try {
    const { id } = await params
    const [deleted] = await db.delete(events).where(eq(events.id, id)).returning()

    if (!deleted) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting event:", err)
    return NextResponse.json({ error: "Error al eliminar evento" }, { status: 500 })
  }
}
