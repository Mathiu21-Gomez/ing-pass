import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { comments } from "@/db/schema"
import { commentSchema } from "@/lib/schemas"
import { eq, and } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"
import { validateAttachments } from "@/lib/validate-attachments"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const { error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const taskComments = await db
      .select()
      .from(comments)
      .where(
        and(eq(comments.parentType, "task"), eq(comments.parentId, taskId))
      )

    return NextResponse.json(taskComments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json(
      { error: "Error al obtener comentarios" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id: taskId } = await params
    const { error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const body = await request.json()
    const parsed = commentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const attachmentError = validateAttachments(parsed.data.attachments)
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 })
    }

    const authorId: string = authUser.id
    const referenceId: string | undefined = body.referenceId ?? undefined

    const [newComment] = await db
      .insert(comments)
      .values({
        parentType: "task",
        parentId: taskId,
        authorId,
        text: parsed.data.text,
        referenceId: referenceId || null,
        attachments: parsed.data.attachments ?? [],
      })
      .returning()

    return NextResponse.json(newComment, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json(
      { error: "Error al crear comentario" },
      { status: 500 }
    )
  }
}
