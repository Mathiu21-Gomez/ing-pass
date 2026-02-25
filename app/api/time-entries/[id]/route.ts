import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { timeEntries } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))

    if (entry.length === 0) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(entry[0])
  } catch (error) {
    console.error("Error fetching time entry:", error)
    return NextResponse.json(
      { error: "Error al obtener registro" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    if (!existing[0].editable) {
      return NextResponse.json(
        { error: "Este registro ya no es editable (pasaron más de 24h)" },
        { status: 403 }
      )
    }

    const updated = await db
      .update(timeEntries)
      .set({
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.lunchStartTime !== undefined && { lunchStartTime: body.lunchStartTime }),
        ...(body.lunchEndTime !== undefined && { lunchEndTime: body.lunchEndTime }),
        ...(body.endTime !== undefined && { endTime: body.endTime }),
        ...(body.effectiveHours !== undefined && { effectiveHours: body.effectiveHours }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.progressPercentage !== undefined && { progressPercentage: body.progressPercentage }),
        ...(body.pauseCount !== undefined && { pauseCount: body.pauseCount }),
        ...(body.progressJustification !== undefined && { progressJustification: body.progressJustification }),
        ...(body.editable !== undefined && { editable: body.editable }),
      })
      .where(eq(timeEntries.id, id))
      .returning()

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error("Error updating time entry:", error)
    return NextResponse.json(
      { error: "Error al actualizar registro" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await db
      .delete(timeEntries)
      .where(eq(timeEntries.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting time entry:", error)
    return NextResponse.json(
      { error: "Error al eliminar registro" },
      { status: 500 }
    )
  }
}
