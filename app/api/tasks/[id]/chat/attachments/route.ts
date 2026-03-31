import { ZodError } from "zod"
import { NextRequest, NextResponse } from "next/server"

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import { stageTaskChatAttachment } from "@/lib/task-chat-storage"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id: taskId } = await params
    const accessResult = await getTaskChatAccessContext(taskId, authUser)

    if (accessResult.error) return accessResult.error
    if (accessResult.maskAsNotFound || !accessResult.context) {
      return createTaskChatNotFoundResponse()
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const source = formData.get("source")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes adjuntar una imagen en el campo file" },
        { status: 400 }
      )
    }

    const stagedAttachment = await stageTaskChatAttachment({
      file,
      projectId: accessResult.context.projectId,
      source: typeof source === "string" ? source as "manual" | "clipboard" : undefined,
      taskId,
      uploaderId: authUser.id,
    })

    return NextResponse.json(stagedAttachment, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.flatten() },
        { status: 400 }
      )
    }

    console.error("Error staging task chat attachment:", error)
    return NextResponse.json(
      { error: "Error al subir adjunto del chat" },
      { status: 500 }
    )
  }
}
