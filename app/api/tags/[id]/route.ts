import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tags } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.color !== undefined) updateData.color = body.color

    const [updated] = await db.update(tags).set(updateData).where(eq(tags.id, id)).returning()
    if (!updated) return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Error updating tag:", err)
    return NextResponse.json({ error: "Error al actualizar etiqueta" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params
    const deleted = await db.delete(tags).where(eq(tags.id, id)).returning()
    if (deleted.length === 0) return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting tag:", err)
    return NextResponse.json({ error: "Error al eliminar etiqueta" }, { status: 500 })
  }
}
