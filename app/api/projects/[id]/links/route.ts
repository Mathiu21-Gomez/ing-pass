import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { projectUrls } from "@/db/schema"
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
  const { error } = await getAuthUser(request)
  if (error) return error

  const { id: projectId } = await params

  try {
    const links = await db
      .select()
      .from(projectUrls)
      .where(eq(projectUrls.projectId, projectId))

    return NextResponse.json(links)
  } catch {
    return NextResponse.json({ error: "Error al obtener enlaces" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await getAuthUser(request)
  if (error) return error

  const { id: projectId } = await params

  const body = await request.json()
  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(projectUrls)
      .values({ projectId, label: parsed.data.label, url: parsed.data.url })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear enlace" }, { status: 500 })
  }
}
