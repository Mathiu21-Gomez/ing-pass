import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { user, userSchedules } from "@/db/schema"
import { userSchema } from "@/lib/schemas"
import { eq, and } from "drizzle-orm"

async function getUserWithSchedule(id: string) {
  const found = await db.select().from(user).where(eq(user.id, id))
  if (found.length === 0) return null

  const schedules = await db
    .select()
    .from(userSchedules)
    .where(eq(userSchedules.userId, id))

  return {
    ...found[0],
    weeklySchedule: schedules
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isWorkingDay: s.isWorkingDay,
        reason: s.reason ?? "",
      })),
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getUserWithSchedule(id)

    if (!result) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Error al obtener usuario" },
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
    const { weeklySchedule: scheduleData, ...userData } = body

    // Update user fields if present
    if (Object.keys(userData).length > 0) {
      const updated = await db
        .update(user)
        .set(userData)
        .where(eq(user.id, id))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        )
      }
    }

    // Upsert schedule rows if provided
    if (scheduleData && Array.isArray(scheduleData)) {
      for (const s of scheduleData) {
        // Delete existing row for this day and re-insert
        await db
          .delete(userSchedules)
          .where(
            and(
              eq(userSchedules.userId, id),
              eq(userSchedules.dayOfWeek, s.dayOfWeek)
            )
          )

        await db.insert(userSchedules).values({
          userId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isWorkingDay: s.isWorkingDay,
          reason: s.reason ?? "",
        })
      }
    }

    const result = await getUserWithSchedule(id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
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

    // Schedules are cascade-deleted via FK
    const deleted = await db
      .delete(user)
      .where(eq(user.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    )
  }
}
