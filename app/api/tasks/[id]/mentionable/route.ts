import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import { getTaskChatMentionableUsers } from "@/lib/task-chat-mentionable"

export const runtime = "nodejs"

/**
 * GET /api/tasks/[id]/mentionable
 * Returns users that can be @mentioned in this task's chat:
 * - All admins (active)
 * - The project coordinator
 * - Workers assigned to the project
 * Excludes the requesting user.
 */
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

    const mentionableUsers = await getTaskChatMentionableUsers(taskId, {
      excludeUserId: authUser.id,
    })

    return NextResponse.json(mentionableUsers)
  } catch (err) {
    console.error("GET /api/tasks/[id]/mentionable error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
