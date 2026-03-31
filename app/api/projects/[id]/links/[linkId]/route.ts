import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { projectUrls } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { error } = await getAuthUser(request)
  if (error) return error

  const { id: projectId, linkId } = await params

  try {
    await db
      .delete(projectUrls)
      .where(and(eq(projectUrls.id, linkId), eq(projectUrls.projectId, projectId)))

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Error al eliminar enlace" }, { status: 500 })
  }
}
