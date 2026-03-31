import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskLinks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { error } = await getAuthUser(request)
  if (error) return error

  const { id: taskId, linkId } = await params

  try {
    await db
      .delete(taskLinks)
      .where(and(eq(taskLinks.id, linkId), eq(taskLinks.taskId, taskId)))

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Error al eliminar enlace" }, { status: 500 })
  }
}
