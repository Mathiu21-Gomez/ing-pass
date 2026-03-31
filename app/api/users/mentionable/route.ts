import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { user as userTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

/**
 * GET /api/users/mentionable
 * Returns id + name of all active users.
 * Accessible to all authenticated roles (needed for @mentions in task chat).
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const rows = await db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.active, true))

    return NextResponse.json(rows)
  } catch (err) {
    console.error("GET /api/users/mentionable error:", err)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}
