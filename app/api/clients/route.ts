import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { clients } from "@/db/schema"
import { clientSchema } from "@/lib/schemas"

export async function GET() {
  try {
    const allClients = await db.select().from(clients)
    return NextResponse.json(allClients)
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = clientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        ...parsed.data,
        address: parsed.data.address ?? "",
      })
      .returning()

    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    )
  }
}
