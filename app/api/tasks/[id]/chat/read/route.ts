import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import {
  TaskChatNotFoundError,
  TaskChatValidationError,
  getTaskChatService,
} from "@/lib/task-chat-service"
import { taskChatMarkReadBodySchema } from "@/lib/task-chat-schemas"

export const runtime = "nodejs"

function handleTaskChatReadError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos", details: error.flatten() },
      { status: 400 }
    )
  }

  if (error instanceof TaskChatValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? null },
      { status: 400 }
    )
  }

  if (error instanceof TaskChatNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  console.error("Error marking task chat as read:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

export async function PATCH(
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

    const body = taskChatMarkReadBodySchema.parse(await request.json())
    const result = await getTaskChatService().markRead({
      lastReadMessageId: body.lastReadMessageId,
      taskId,
      userId: authUser.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleTaskChatReadError(error)
  }
}
