import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { roles, permissions, rolePermissions, userRoles, user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import { MODULES, ACTIONS, DEFAULT_ROLE_PERMISSIONS, type Module, type Action } from "@/lib/permissions"

/**
 * POST /api/roles/seed
 * Creates default roles, permissions, and migrates existing users.
 * Safe to call multiple times — idempotent.
 */
export async function POST(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(authUser, ["admin"])
  if (roleError) return roleError

  try {
    const report: string[] = []

    // ── 1. Seed all permission combinations ──────────────────────────────
    const existingPerms = await db.select().from(permissions)
    const existingPermKeys = new Set(existingPerms.map((p) => `${p.module}:${p.action}`))

    const allPermCombinations = (Object.values(MODULES) as Module[]).flatMap((module) =>
      (Object.values(ACTIONS) as Action[]).map((action) => ({ module, action }))
    )

    const missingPerms = allPermCombinations.filter(
      ({ module, action }) => !existingPermKeys.has(`${module}:${action}`)
    )

    if (missingPerms.length > 0) {
      await db.insert(permissions).values(missingPerms)
      report.push(`Creados ${missingPerms.length} permisos`)
    } else {
      report.push("Permisos ya existentes — sin cambios")
    }

    // Reload permissions to get IDs
    const allPerms = await db.select().from(permissions)
    const permMap = new Map(allPerms.map((p) => [`${p.module}:${p.action}`, p.id]))

    // ── 2. Seed default system roles ─────────────────────────────────────
    const legacyRoles = ["admin", "coordinador", "trabajador", "externo"]
    const existingRoles = await db.select().from(roles)
    const existingRoleNames = new Set(existingRoles.map((r) => r.name))

    const roleDescriptions: Record<string, string> = {
      admin: "Acceso total al sistema",
      coordinador: "Gestión de proyectos, tareas y equipo",
      trabajador: "Registro de jornada y gestión de tareas propias",
      externo: "Vista de solo lectura para clientes externos",
    }

    const createdRoles: { id: string; name: string }[] = []
    for (const roleName of legacyRoles) {
      if (!existingRoleNames.has(roleName)) {
        const [newRole] = await db
          .insert(roles)
          .values({
            name: roleName,
            description: roleDescriptions[roleName] ?? "",
            isSystem: true,
          })
          .returning()
        createdRoles.push(newRole)
        report.push(`Rol creado: ${roleName}`)
      } else {
        // Mark existing legacy roles as system roles
        await db.update(roles).set({ isSystem: true }).where(eq(roles.name, roleName))
        const existing = existingRoles.find((r) => r.name === roleName)
        if (existing) createdRoles.push(existing)
      }
    }

    // ── 3. Assign permissions to roles ───────────────────────────────────
    for (const role of createdRoles) {
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role.name] ?? []

      // Remove old assignments to re-sync
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id))

      const toInsert = defaultPerms
        .map((permKey) => ({ roleId: role.id, permissionId: permMap.get(permKey) }))
        .filter((row): row is { roleId: string; permissionId: string } =>
          row.permissionId !== undefined
        )

      if (toInsert.length > 0) {
        await db.insert(rolePermissions).values(toInsert)
      }
      report.push(`Permisos asignados a '${role.name}': ${toInsert.length}`)
    }

    // ── 4. Migrate existing users ─────────────────────────────────────────
    const allUsers = await db.select({ id: user.id, role: user.role }).from(user)
    const roleByName = new Map(
      [...existingRoles, ...createdRoles].map((r) => [r.name, r.id])
    )

    let migratedCount = 0
    for (const u of allUsers) {
      const roleId = roleByName.get(u.role)
      if (!roleId) continue

      // Check if already has this role
      const existing = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.userId, u.id))

      if (existing.length === 0) {
        await db.insert(userRoles).values({ userId: u.id, roleId })
        migratedCount++
      }
    }
    report.push(`Usuarios migrados: ${migratedCount}`)

    return NextResponse.json({ success: true, report })
  } catch (err) {
    console.error("Error seeding roles:", err)
    return NextResponse.json({ error: "Error al inicializar roles", details: String(err) }, { status: 500 })
  }
}
