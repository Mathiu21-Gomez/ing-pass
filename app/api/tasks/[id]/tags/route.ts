import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskTags, tags } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"

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

    const taskTagRows = await db
      .select({ id: tags.id, name: tags.name, color: tags.color, projectId: tags.projectId, createdBy: tags.createdBy, createdAt: tags.createdAt })
      .from(taskTags)
      .innerJoin(tags, eq(taskTags.tagId, tags.id))
      .where(eq(taskTags.taskId, taskId))

    return NextResponse.json(taskTagRows)
  } catch (err) {
    console.error("Error fetching task tags:", err)
    return NextResponse.json({ error: "Error al obtener etiquetas" }, { status: 500 })
  }
}

/**
 * PUT /api/tasks/[id]/tags
 * Body: { tagIds: string[] }
 * Replaces all tags for the task.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const { context, error: accessError } = await getTaskAccessContext(taskId, authUser)
    if (accessError) return accessError

    const body = await request.json()
    const tagIds = Array.isArray(body.tagIds) ? [...new Set(body.tagIds)] : body.tagIds ?? []

    if (!Array.isArray(tagIds) || tagIds.some((tagId) => typeof tagId !== "string")) {
      return NextResponse.json({ error: "tagIds debe ser un array de strings" }, { status: 400 })
    }

    if (tagIds.length > 0) {
      const existingTags = await db
        .select({ id: tags.id, projectId: tags.projectId })
        .from(tags)
        .where(inArray(tags.id, tagIds))

      const validTags = existingTags.filter((tag) => tag.projectId === context.projectId)

      if (validTags.length !== tagIds.length) {
        return NextResponse.json(
          { error: "Hay etiquetas que no pertenecen al proyecto de la tarea" },
          { status: 400 }
        )
      }
    }

    if (tagIds.length > 0) {
      await db.batch([
        db.delete(taskTags).where(eq(taskTags.taskId, taskId)),
        db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId, tagId }))),
      ])
    } else {
      await db.batch([
        db.delete(taskTags).where(eq(taskTags.taskId, taskId)),
      ])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error updating task tags:", err)
    return NextResponse.json({ error: "Error al actualizar etiquetas" }, { status: 500 })
  }
}
