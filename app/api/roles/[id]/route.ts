import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { roles, rolePermissions, permissions } from "@/db/schema"
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
    const role = await db.select().from(roles).where(eq(roles.id, id))

    if (role.length === 0) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
    }

    const perms = await db
      .select({ id: permissions.id, module: permissions.module, action: permissions.action })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, id))

    return NextResponse.json({
      ...role[0],
      permissions: perms.map((p) => `${p.module}:${p.action}`),
    })
  } catch (err) {
    console.error("Error fetching role:", err)
    return NextResponse.json({ error: "Error al obtener rol" }, { status: 500 })
  }
}

export async function PATCH(
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

    const existing = await db.select().from(roles).where(eq(roles.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description

    if (Object.keys(updateData).length > 0) {
      await db.update(roles).set(updateData).where(eq(roles.id, id))
    }

    const updated = await db.select().from(roles).where(eq(roles.id, id))
    return NextResponse.json(updated[0])
  } catch (err) {
    console.error("Error updating role:", err)
    return NextResponse.json({ error: "Error al actualizar rol" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const existing = await db.select().from(roles).where(eq(roles.id, id))

    if (existing.length === 0) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
    }

    if (existing[0].isSystem) {
      return NextResponse.json(
        { error: "No se puede eliminar un rol del sistema" },
        { status: 403 }
      )
    }

    await db.delete(roles).where(eq(roles.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting role:", err)
    return NextResponse.json({ error: "Error al eliminar rol" }, { status: 500 })
  }
}
