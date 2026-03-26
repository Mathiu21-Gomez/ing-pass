import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { userRoles, roles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const assigned = await db
      .select({ id: roles.id, name: roles.name, description: roles.description, isSystem: roles.isSystem })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id))

    return NextResponse.json(assigned)
  } catch (err) {
    console.error("Error fetching user roles:", err)
    return NextResponse.json({ error: "Error al obtener roles del usuario" }, { status: 500 })
  }
}

/**
 * PUT /api/users/[id]/roles
 * Body: { roleIds: string[] }
 * Replaces the full set of roles for the user.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const body = await request.json()
    const roleIds: string[] = body.roleIds ?? []

    await db.delete(userRoles).where(eq(userRoles.userId, id))

    if (roleIds.length > 0) {
      await db.insert(userRoles).values(roleIds.map((roleId) => ({ userId: id, roleId })))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error updating user roles:", err)
    return NextResponse.json({ error: "Error al actualizar roles del usuario" }, { status: 500 })
  }
}
