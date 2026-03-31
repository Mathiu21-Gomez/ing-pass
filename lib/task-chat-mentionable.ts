import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { projectWorkers, projects, tasks, user as userTable } from "@/db/schema"

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
      coordinatorId: projects.coordinatorId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const taskRow = taskRows[0]
  if (!taskRow) return []

  const [workerRows, adminRows] = await Promise.all([
    db
      .select({ userId: projectWorkers.userId })
      .from(projectWorkers)
      .where(eq(projectWorkers.projectId, taskRow.projectId)),
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(and(eq(userTable.active, true), eq(userTable.role, "admin"))),
  ])

  const projectMemberIds = [
    taskRow.coordinatorId,
    ...workerRows.map((worker) => worker.userId),
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
