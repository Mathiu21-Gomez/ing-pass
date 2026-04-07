import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { tasks, user as userTable } from "@/db/schema"
import { getProjectMembership } from "@/lib/project-membership-store"

export interface TaskMentionableUser {
  id: string
  name: string
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getTaskChatMentionableUsers(
  taskId: string,
  options?: { excludeUserId?: string }
): Promise<TaskMentionableUser[]> {
  const taskRows = await db
    .select({
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))

  const taskRow = taskRows[0]
  if (!taskRow) return []

  const membership = await getProjectMembership(taskRow.projectId)

  const adminRows = await db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(and(eq(userTable.active, true), eq(userTable.role, "admin")))

  const projectMemberIds = [
    ...membership.projectMembers.map((member) => member.userId),
  ].filter((value): value is string => Boolean(value))

  const projectMemberRows =
    projectMemberIds.length > 0
      ? await db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(
            and(eq(userTable.active, true), inArray(userTable.id, projectMemberIds))
          )
      : []

  const mentionableUsers = new Map<string, TaskMentionableUser>()
  for (const candidate of [...adminRows, ...projectMemberRows]) {
    if (candidate.id !== options?.excludeUserId) {
      mentionableUsers.set(candidate.id, candidate)
    }
  }

  return [...mentionableUsers.values()]
}

export function getMentionedTaskChatUsers(
  text: string,
  candidates: TaskMentionableUser[]
): TaskMentionableUser[] {
  return candidates.filter((candidate) => {
    const mentionPattern = new RegExp(
      `(^|\\s)@${escapeRegex(candidate.name)}(?=$|\\s|[.,!?;:])`,
      "i"
    )

    return mentionPattern.test(text)
  })
}
