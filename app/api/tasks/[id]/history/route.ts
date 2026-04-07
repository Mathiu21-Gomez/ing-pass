import { NextRequest, NextResponse } from "next/server"

import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"
import { getTaskOperationalHistory } from "@/lib/task-operational-history"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id: taskId } = await params
    const accessResult = await getTaskAccessContext(taskId, authUser)
    if (accessResult.error) return accessResult.error

    const summary = await getTaskOperationalHistory(taskId)
    return NextResponse.json(summary)
  } catch (routeError) {
    console.error("Error fetching task operational history:", routeError)
    return NextResponse.json(
      { error: "Error al obtener el historial operativo" },
      { status: 500 }
    )
  }
}
