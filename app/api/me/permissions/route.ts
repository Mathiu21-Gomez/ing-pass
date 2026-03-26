import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { userRoles, rolePermissions, permissions, roles, user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions"

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
      // No roles in new system — fall back to legacy role field
      const userRecord = await db
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, authUser.id))

      const legacyRole = userRecord[0]?.role ?? "trabajador"
      const fallbackPerms = DEFAULT_ROLE_PERMISSIONS[legacyRole] ?? []
      return NextResponse.json({ permissions: fallbackPerms, source: "fallback" })
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
      .where(
        roleIds.length === 1
          ? eq(rolePermissions.roleId, roleIds[0])
          : // For multiple roles, we fetch each individually and merge
            eq(rolePermissions.roleId, roleIds[0])
      )

    // If user has multiple roles, fetch the rest
    const allPermRows = [...permRows]
    if (roleIds.length > 1) {
      for (let i = 1; i < roleIds.length; i++) {
        const extra = await db
          .select({ module: permissions.module, action: permissions.action })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(rolePermissions.roleId, roleIds[i]))
        allPermRows.push(...extra)
      }
    }

    // Deduplicate
    const permSet = new Set(allPermRows.map((p) => `${p.module}:${p.action}`))

    return NextResponse.json({
      permissions: Array.from(permSet),
      source: "database",
    })
  } catch (err) {
    console.error("Error fetching user permissions:", err)
    // Graceful fallback — if tables don't exist yet return role-based perms
    const fallbackPerms = DEFAULT_ROLE_PERMISSIONS[authUser.role] ?? []
    return NextResponse.json({ permissions: fallbackPerms, source: "fallback" })
  }
}
