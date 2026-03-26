import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { permissions } from "@/db/schema"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import { MODULES, ACTIONS, MODULE_LABELS, ACTION_LABELS, type Module, type Action } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const allPerms = await db.select().from(permissions).orderBy(permissions.module, permissions.action)

    const grouped = (Object.values(MODULES) as Module[]).map((module) => ({
      module,
      label: MODULE_LABELS[module],
      actions: (Object.values(ACTIONS) as Action[]).map((action) => ({
        action,
        label: ACTION_LABELS[action],
        key: `${module}:${action}`,
        exists: allPerms.some((p) => p.module === module && p.action === action),
      })),
    }))

    return NextResponse.json({ permissions: allPerms, grouped })
  } catch (err) {
    console.error("Error fetching permissions:", err)
    return NextResponse.json({ error: "Error al obtener permisos" }, { status: 500 })
  }
}
