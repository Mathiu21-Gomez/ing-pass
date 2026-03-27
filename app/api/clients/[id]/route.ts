import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { clients } from "@/db/schema"
import { clientSchema } from "@/lib/schemas"
import { and, eq } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params

    if (authUser.role === "externo") {
      const client = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, id), eq(clients.email, authUser.email)))

      if (client.length === 0) {
        return NextResponse.json(
          { error: "Cliente no encontrado" },
          { status: 404 }
        )
      }

      return NextResponse.json(client[0])
    }

    const roleError = requireRole(authUser, ["admin", "coordinador"])
    if (roleError) return roleError

    const client = await db.select().from(clients).where(eq(clients.id, id))

    if (client.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(client[0])
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  const roleError = requireRole(authUser, ["admin"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = clientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db
      .update(clients)
      .set({ ...parsed.data, address: parsed.data.address ?? "" })
      .where(eq(clients.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(updated[0])
  } catch (error) {
    const isUniqueViolation =
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "23505"

    if (isUniqueViolation) {
      return NextResponse.json(
        { error: "Ya existe un cliente con ese RUT" },
        { status: 409 }
      )
    }

    console.error("Error updating client:", error)
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  const roleError = requireRole(authUser, ["admin"])
  if (roleError) return roleError

  try {
    const { id } = await params
    const deleted = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    )
  }
}
