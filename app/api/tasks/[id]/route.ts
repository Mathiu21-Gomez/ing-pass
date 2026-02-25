import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskAssignments, activities, documents, comments } from "@/db/schema"
import { taskSchema } from "@/lib/schemas"
import { eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await db.select().from(tasks).where(eq(tasks.id, id))

    if (task.length === 0) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    const assigns = await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, id))

    const taskActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.taskId, id))

    const taskDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.taskId, id))

    const taskComments = await db
      .select()
      .from(comments)
      .where(eq(comments.parentId, id))

    return NextResponse.json({
      ...task[0],
      assignedTo: assigns.map((a) => a.userId),
      activities: taskActivities,
      documents: taskDocs,
      comments: taskComments,
    })
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json(
      { error: "Error al obtener tarea" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const assignedTo: string[] | undefined = body.assignedTo

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate || null
    if (body.status !== undefined) updateData.status = body.status

    if (Object.keys(updateData).length === 0 && !assignedTo) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      )
    }

    let updated
    if (Object.keys(updateData).length > 0) {
      updated = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json(
          { error: "Tarea no encontrada" },
          { status: 404 }
        )
      }
    } else {
      const existing = await db.select().from(tasks).where(eq(tasks.id, id))
      if (existing.length === 0) {
        return NextResponse.json(
          { error: "Tarea no encontrada" },
          { status: 404 }
        )
      }
      updated = existing
    }

    if (assignedTo) {
      await db.delete(taskAssignments).where(eq(taskAssignments.taskId, id))
      if (assignedTo.length > 0) {
        await db.insert(taskAssignments).values(
          assignedTo.map((userId) => ({ taskId: id, userId }))
        )
      }
    }

    return NextResponse.json({ ...updated[0], assignedTo })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json(
      { error: "Error al actualizar tarea" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Error al eliminar tarea" },
      { status: 500 }
    )
  }
}
