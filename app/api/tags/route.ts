import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tags } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    let allTags
    if (projectId) {
      // Project-scoped tags + global tags (null projectId)
      const projectTags = await db.select().from(tags).where(eq(tags.projectId, projectId))
      const globalTags = await db.select().from(tags).where(eq(tags.projectId, null as unknown as string))
      allTags = [...globalTags, ...projectTags]
    } else {
      allTags = await db.select().from(tags)
    }

    return NextResponse.json(allTags)
  } catch (err) {
    console.error("Error fetching tags:", err)
    return NextResponse.json({ error: "Error al obtener etiquetas" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json()
    const { name, color, projectId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre de la etiqueta es requerido" }, { status: 400 })
    }

    const [newTag] = await db
      .insert(tags)
      .values({
        name: name.trim(),
        color: color ?? "#6366f1",
        projectId: projectId ?? null,
        createdBy: user.id,
      })
      .returning()

    return NextResponse.json(newTag, { status: 201 })
  } catch (err) {
    console.error("Error creating tag:", err)
    return NextResponse.json({ error: "Error al crear etiqueta" }, { status: 500 })
  }
}
