import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { roles, rolePermissions, permissions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const allRoles = await db.select().from(roles).orderBy(roles.name)

    // Enrich with permission count
    const enriched = await Promise.all(
      allRoles.map(async (role) => {
        const perms = await db
          .select({ module: permissions.module, action: permissions.action })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(rolePermissions.roleId, role.id))

        return {
          ...role,
          permissions: perms.map((p) => `${p.module}:${p.action}`),
        }
      })
    )

    return NextResponse.json(enriched)
  } catch (err) {
    console.error("Error fetching roles:", err)
    return NextResponse.json({ error: "Error al obtener roles" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre del rol es requerido" }, { status: 400 })
    }

    const [newRole] = await db
      .insert(roles)
      .values({ name: name.trim(), description: description ?? "", isSystem: false })
      .returning()

    return NextResponse.json({ ...newRole, permissions: [] }, { status: 201 })
  } catch (err) {
    console.error("Error creating role:", err)
    return NextResponse.json({ error: "Error al crear rol" }, { status: 500 })
  }
}
