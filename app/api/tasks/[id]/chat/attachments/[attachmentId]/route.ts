import { NextRequest, NextResponse } from "next/server"

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import {
  deleteTaskChatStagedAttachment,
  getTaskChatAttachmentFile,
} from "@/lib/task-chat-storage"

export const runtime = "nodejs"

async function resolveAccessibleAttachment(
  taskId: string,
  attachmentId: string,
  userId: string
) {
  const attachment = await getTaskChatAttachmentFile({ attachmentId })

  if (!attachment || attachment.taskId !== taskId) {
    return null
  }

  if (!attachment.messageId && attachment.uploadedBy !== userId) {
    return null
  }

  return attachment
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string; id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { attachmentId, id: taskId } = await params
    const accessResult = await getTaskChatAccessContext(taskId, authUser)

    if (accessResult.error) return accessResult.error
    if (accessResult.maskAsNotFound || !accessResult.context) {
      return createTaskChatNotFoundResponse()
    }

    const attachment = await resolveAccessibleAttachment(taskId, attachmentId, authUser.id)

    if (!attachment) {
      return createTaskChatNotFoundResponse()
    }

    return new NextResponse(attachment.body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Type": attachment.mimeType,
      },
    })
  } catch (error) {
    console.error("Error serving task chat attachment:", error)
    return NextResponse.json({ error: "Error al obtener adjunto del chat" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string; id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { attachmentId, id: taskId } = await params
    const accessResult = await getTaskChatAccessContext(taskId, authUser)

    if (accessResult.error) return accessResult.error
    if (accessResult.maskAsNotFound || !accessResult.context) {
      return createTaskChatNotFoundResponse()
    }

    const deleted = await deleteTaskChatStagedAttachment({
      attachmentId,
      taskId,
      uploaderId: authUser.id,
    })

    if (!deleted) {
      return createTaskChatNotFoundResponse()
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting staged task chat attachment:", error)
    return NextResponse.json({ error: "Error al eliminar adjunto del chat" }, { status: 500 })
  }
}
