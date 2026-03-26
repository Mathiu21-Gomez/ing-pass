import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { desc } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

/** GET /api/events — Events visible to current user's role, pinned first */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const userRole = user.role ?? "trabajador"

    const allEvents = await db
      .select()
      .from(events)
      .orderBy(desc(events.pinned), desc(events.createdAt))

    // Filter: targetRoles empty = visible to all; otherwise must include user's role
    const visible = allEvents.filter(
      (e) => !e.targetRoles || e.targetRoles.length === 0 || e.targetRoles.includes(userRole)
    )

    return NextResponse.json(visible)
  } catch (err) {
    console.error("Error fetching events:", err)
    return NextResponse.json({ error: "Error al obtener eventos" }, { status: 500 })
  }
}

/** POST /api/events — Create event (admin/coordinador only) */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  if (!["admin", "coordinador"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { title, content, type, eventDate, targetRoles, pinned } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 })
    }

    const [newEvent] = await db
      .insert(events)
      .values({
        title: title.trim(),
        content: content ?? "",
        type: type ?? "comunicado",
        eventDate: eventDate || null,
        createdBy: user.id,
        targetRoles: targetRoles ?? [],
        pinned: pinned ?? false,
      })
      .returning()

    return NextResponse.json(newEvent, { status: 201 })
  } catch (err) {
    console.error("Error creating event:", err)
    return NextResponse.json({ error: "Error al crear evento" }, { status: 500 })
  }
}
