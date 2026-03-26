import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { notes, user } from "@/db/schema"
import { eq, or, and, desc, gte, lte } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { validateAttachments } from "@/lib/validate-attachments"

/** GET /api/notes — Notas propias + notas de equipo visibles */
export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const baseWhere = or(
      eq(notes.authorId, authUser.id),
      eq(notes.isTeamNote, true)
    )

    const dateFilter =
      from && to
        ? and(
            gte(notes.createdAt, new Date(from + "T00:00:00")),
            lte(notes.createdAt, new Date(to + "T23:59:59"))
          )
        : undefined

    const categoryFilter = category
      ? eq(notes.category, category as "trabajo_ayer" | "emergencia" | "anotacion" | "cumpleanos" | "general")
      : undefined

    const whereClause = and(baseWhere, dateFilter, categoryFilter)

    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        authorId: notes.authorId,
        authorName: user.name,
        category: notes.category,
        isTeamNote: notes.isTeamNote,
        priority: notes.priority,
        targetRoles: notes.targetRoles,
        attachments: notes.attachments,
        projectId: notes.projectId,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .innerJoin(user, eq(notes.authorId, user.id))
      .where(whereClause)
      .orderBy(desc(notes.createdAt))

    const filtered = rows.filter((row) => {
      if (row.authorId === authUser.id) return true
      if (!row.targetRoles || row.targetRoles.length === 0) return true
      return row.targetRoles.includes(authUser.role)
    })

    return NextResponse.json(filtered)
  } catch (err) {
    console.error("Error fetching notes:", err)
    return NextResponse.json({ error: "Error al obtener notas" }, { status: 500 })
  }
}

/** POST /api/notes — Crear nota */
export async function POST(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json()
    const { title, content, category, isTeamNote, projectId, priority, targetRoles, attachments } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 })
    }

    const attachmentError = validateAttachments(attachments)
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 })
    }

    // Solo admin/coordinador pueden crear notas de equipo
    const canCreateTeamNote = ["admin", "coordinador"].includes(authUser.role ?? "")
    const teamNote = isTeamNote && canCreateTeamNote

    const [newNote] = await db
      .insert(notes)
      .values({
        title: title.trim(),
        content: content ?? "",
        authorId: authUser.id,
        category: category ?? "general",
        isTeamNote: teamNote,
        projectId: projectId || null,
        priority: priority ?? null,
        targetRoles: targetRoles ?? [],
        attachments: attachments ?? [],
      })
      .returning()

    return NextResponse.json({ ...newNote, authorName: authUser.name }, { status: 201 })
  } catch (err) {
    console.error("Error creating note:", err)
    return NextResponse.json({ error: "Error al crear nota" }, { status: 500 })
  }
}
