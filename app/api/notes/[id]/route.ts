import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { notes } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { validateAttachments } from "@/lib/validate-attachments"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Admin/coordinador pueden mover cualquier nota (drag-and-drop); otros solo la propia
    const canEditAny = ["admin", "coordinador"].includes(user.role ?? "")
    const whereClause = canEditAny
      ? eq(notes.id, id)
      : and(eq(notes.id, id), eq(notes.authorId, user.id))

    const existing = await db.select().from(notes).where(whereClause)

    if (existing.length === 0) {
      return NextResponse.json({ error: "Nota no encontrada o sin permisos" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.content !== undefined) updateData.content = body.content
    if (body.category !== undefined) updateData.category = body.category
    if (body.isTeamNote !== undefined) updateData.isTeamNote = body.isTeamNote
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null
    if (body.priority !== undefined) updateData.priority = body.priority || null
    if (body.targetRoles !== undefined) updateData.targetRoles = body.targetRoles
    if (body.attachments !== undefined) {
      const attachmentError = validateAttachments(body.attachments)
      if (attachmentError) {
        return NextResponse.json({ error: attachmentError }, { status: 400 })
      }
      updateData.attachments = body.attachments
    }

    const [updated] = await db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, id))
      .returning()

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Error updating note:", err)
    return NextResponse.json({ error: "Error al actualizar nota" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params

    // Admin puede borrar cualquier nota; otros solo la propia
    const whereClause = user.role === "admin"
      ? eq(notes.id, id)
      : and(eq(notes.id, id), eq(notes.authorId, user.id))

    const [deleted] = await db.delete(notes).where(whereClause).returning()

    if (!deleted) {
      return NextResponse.json({ error: "Nota no encontrada o sin permisos" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting note:", err)
    return NextResponse.json({ error: "Error al eliminar nota" }, { status: 500 })
  }
}
