import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { comments } from "@/db/schema"
import { commentSchema } from "@/lib/schemas"
import { eq, and } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
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
  try {
    const { id: taskId } = await params
    const body = await request.json()
    const parsed = commentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const authorId: string = body.authorId ?? ""
    const parentType = (body.parentType as "task" | "activity") ?? "task"
    const parentId = parentType === "task" ? taskId : (body.parentId ?? taskId)
    const referenceId: string | undefined = body.referenceId ?? undefined

    const [newComment] = await db
      .insert(comments)
      .values({
        parentType,
        parentId,
        authorId,
        text: parsed.data.text,
        referenceId: referenceId || null,
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
