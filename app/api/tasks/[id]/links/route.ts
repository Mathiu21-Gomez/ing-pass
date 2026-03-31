import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskLinks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { z } from "zod"

const linkSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url("La URL no es válida"),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  const { id: taskId } = await params

  try {
    const links = await db
      .select()
      .from(taskLinks)
      .where(eq(taskLinks.taskId, taskId))

    return NextResponse.json(links)
  } catch {
    return NextResponse.json({ error: "Error al obtener enlaces" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  const { id: taskId } = await params

  const body = await request.json()
  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(taskLinks)
      .values({
        taskId,
        label: parsed.data.label,
        url: parsed.data.url,
        addedBy: authUser.id,
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear enlace" }, { status: 500 })
  }
}
