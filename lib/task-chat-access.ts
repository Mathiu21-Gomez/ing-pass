import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { projects, tasks } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"
import { getProjectMembership } from "@/lib/project-membership-store"

export type TaskChatAccessSource =
  | "admin"
  | "coordinator"
  | "project-member"

export interface TaskChatAccessContext {
  taskId: string
  projectId: string
  coordinatorId: string
  coordinatorIds: string[]
  accessSource: TaskChatAccessSource
}

type TaskChatAccessSuccess = {
  context: TaskChatAccessContext
  error: null
  maskAsNotFound: false
}

type TaskChatAccessMasked = {
  context: null
  error: null
  maskAsNotFound: true
}

type TaskChatAccessFailure = {
  context: null
  error: NextResponse
  maskAsNotFound: false
}

export type TaskChatAccessResult =
  | TaskChatAccessSuccess
  | TaskChatAccessMasked
  | TaskChatAccessFailure

function forbidden(message = "Sin permisos suficientes") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function maskAsNotFound(): TaskChatAccessMasked {
  return {
    context: null,
    error: null,
    maskAsNotFound: true,
  }
}

export function createTaskChatNotFoundResponse() {
  return NextResponse.json({ error: "Chat de tarea no encontrado" }, { status: 404 })
}

export async function getTaskChatAccessContext(
  taskId: string,
  user: ApiUser
): Promise<TaskChatAccessResult> {
  const taskRows = await db
    .select({
      taskId: tasks.id,
      projectId: tasks.projectId,
      coordinatorId: projects.coordinatorId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))

  if (taskRows.length === 0) {
    return maskAsNotFound()
  }

  const taskContext = taskRows[0]
  const membership = await getProjectMembership(taskContext.projectId, {
    legacyCoordinatorId: taskContext.coordinatorId,
  })
  const contextualTaskContext = {
    ...taskContext,
    coordinatorId: membership.coordinatorIds[0] ?? taskContext.coordinatorId,
    coordinatorIds: membership.coordinatorIds,
  }

  if (user.role === "admin") {
    return {
      context: {
        ...contextualTaskContext,
        accessSource: "admin",
      },
      error: null,
      maskAsNotFound: false,
    }
  }

  if (membership.coordinatorIds.includes(user.id)) {
    return {
      context: {
        ...contextualTaskContext,
        accessSource: "coordinator",
      },
      error: null,
      maskAsNotFound: false,
    }
  }

  if (membership.projectMembers.some((member) => member.userId === user.id)) {
    return {
      context: {
        ...contextualTaskContext,
        accessSource: "project-member",
      },
      error: null,
      maskAsNotFound: false,
    }
  }

  if (user.role === "externo") {
    return maskAsNotFound()
  }

  return {
    context: null,
    error: forbidden(),
    maskAsNotFound: false,
  }
}
