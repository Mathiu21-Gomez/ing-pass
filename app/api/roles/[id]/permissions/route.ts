import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { roles, permissions, rolePermissions } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

/**
 * PUT /api/roles/[id]/permissions
 * Body: { permissions: string[] }  e.g. ["dashboard:view", "tasks:create"]
 * Replaces the full set of permissions for the role.
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
    const permissionStrings: string[] = body.permissions ?? []

    const role = await db.select().from(roles).where(eq(roles.id, id))
    if (role.length === 0) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
    }

    // Delete all existing permissions for this role
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id))

    if (permissionStrings.length > 0) {
      // Look up permission IDs
      const allPerms = await db.select().from(permissions)
      const permMap = new Map(allPerms.map((p) => [`${p.module}:${p.action}`, p.id]))

      const toInsert = permissionStrings
        .map((str) => ({ roleId: id, permissionId: permMap.get(str) }))
        .filter((row): row is { roleId: string; permissionId: string } =>
          row.permissionId !== undefined
        )

      if (toInsert.length > 0) {
        await db.insert(rolePermissions).values(toInsert)
      }
    }

    return NextResponse.json({ success: true, count: permissionStrings.length })
  } catch (err) {
    console.error("Error updating role permissions:", err)
    return NextResponse.json({ error: "Error al actualizar permisos del rol" }, { status: 500 })
  }
}
