import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { notifications, tasks } from "@/db/schema"
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
import {
  getMentionedTaskChatUsers,
  getTaskChatMentionableUsers,
} from "@/lib/task-chat-mentionable"
import {
  taskChatCreateMessageBodySchema,
  taskChatListQuerySchema,
} from "@/lib/task-chat-schemas"

export const runtime = "nodejs"

function handleTaskChatRouteError(error: unknown, fallbackMessage: string) {
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

  console.error(fallbackMessage, error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

async function createMentionNotifications(input: {
  messageId: string
  senderId: string
  senderName: string
  taskId: string
  text: string
}) {
  if (!input.text.includes("@")) return

  try {
    const [taskRows, mentionableUsers] = await Promise.all([
      db.select({ name: tasks.name }).from(tasks).where(eq(tasks.id, input.taskId)).limit(1),
      getTaskChatMentionableUsers(input.taskId, {
        excludeUserId: input.senderId,
      }),
    ])

    const taskName = taskRows[0]?.name ?? "una tarea"

    const mentioned = getMentionedTaskChatUsers(input.text, mentionableUsers)

    if (mentioned.length === 0) return

    await db.insert(notifications).values(
      mentioned.map((u) => ({
        userId: u.id,
        type: "mention" as const,
        entityType: "task" as const,
        entityId: input.taskId,
        fromUserId: input.senderId,
        message: `${input.senderName} te mencionó en la tarea "${taskName}"`,
      }))
    )
  } catch (err) {
    console.error("Error creating mention notifications:", err)
  }
}

export async function GET(
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

    const { searchParams } = new URL(request.url)
    const query = taskChatListQuerySchema.parse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })

    const result = await getTaskChatService().listMessages({
      cursor: query.cursor,
      limit: query.limit,
      taskId,
      userId: authUser.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleTaskChatRouteError(error, "Error listing task chat messages:")
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
    const accessResult = await getTaskChatAccessContext(taskId, authUser)

    if (accessResult.error) return accessResult.error
    if (accessResult.maskAsNotFound || !accessResult.context) {
      return createTaskChatNotFoundResponse()
    }

    const body = taskChatCreateMessageBodySchema.parse(await request.json())
    const result = await getTaskChatService().createMessage({
      attachmentIds: body.attachmentIds,
      clientRequestId: body.clientRequestId,
      taskId,
      text: body.text,
      userId: authUser.id,
    })

    // Fire-and-forget: create notifications for @mentions (non-blocking)
    if (body.text) {
      void createMentionNotifications({
        messageId: result.id,
        senderId: authUser.id,
        senderName: authUser.name,
        taskId,
        text: body.text,
      })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleTaskChatRouteError(error, "Error creating task chat message:")
  }
}
