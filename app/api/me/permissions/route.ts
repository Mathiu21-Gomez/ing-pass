import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { userRoles, rolePermissions, permissions, user } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    // Get roles assigned to user
    const assignedRoles = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, authUser.id))

    if (assignedRoles.length === 0) {
      const userRecord = await db
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, authUser.id))

      return NextResponse.json(
        {
          error: "El usuario no tiene roles sincronizados en la base de datos.",
          code: "USER_ROLES_MISSING",
          legacyRole: userRecord[0]?.role ?? authUser.role,
        },
        { status: 409 }
      )
    }

    // Get all permissions for all assigned roles
    const roleIds = assignedRoles.map((r) => r.roleId)

    const permRows = await db
      .select({
        module: permissions.module,
        action: permissions.action,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds))

    if (permRows.length === 0) {
      return NextResponse.json(
        {
          error: "Los roles asignados no tienen permisos sembrados en la base de datos.",
          code: "ROLE_PERMISSIONS_MISSING",
        },
        { status: 409 }
      )
    }

    // Deduplicate
    const permSet = new Set(permRows.map((p) => `${p.module}:${p.action}`))

    return NextResponse.json({
      permissions: Array.from(permSet),
      source: "database",
    })
  } catch (err) {
    console.error("Error fetching user permissions:", err)
    return NextResponse.json(
      { error: "Error al obtener permisos desde la base de datos", code: "PERMISSIONS_DB_ERROR" },
      { status: 500 }
    )
  }
}
