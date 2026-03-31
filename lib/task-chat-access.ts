import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { projectWorkers, projects, taskAssignments, tasks } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"

export type TaskChatAccessSource =
  | "admin"
  | "coordinator"
  | "project-membership"
  | "task-assignment"

export interface TaskChatAccessContext {
  taskId: string
  projectId: string
  coordinatorId: string
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

  if (user.role === "admin") {
    return {
      context: {
        ...taskContext,
        accessSource: "admin",
      },
      error: null,
      maskAsNotFound: false,
    }
  }

  if (user.role === "coordinador") {
    if (taskContext.coordinatorId === user.id) {
      return {
        context: {
          ...taskContext,
          accessSource: "coordinator",
        },
        error: null,
        maskAsNotFound: false,
      }
    }

    return maskAsNotFound()
  }

  if (user.role === "trabajador") {
    const [projectMembershipRows, taskAssignmentRows] = await Promise.all([
      db
        .select({ projectId: projectWorkers.projectId })
        .from(projectWorkers)
        .where(
          and(
            eq(projectWorkers.projectId, taskContext.projectId),
            eq(projectWorkers.userId, user.id)
          )
        ),
      db
        .select({ taskId: taskAssignments.taskId })
        .from(taskAssignments)
        .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.userId, user.id))),
    ])

    if (taskAssignmentRows.length > 0) {
      return {
        context: {
          ...taskContext,
          accessSource: "task-assignment",
        },
        error: null,
        maskAsNotFound: false,
      }
    }

    if (projectMembershipRows.length > 0) {
      return {
        context: {
          ...taskContext,
          accessSource: "project-membership",
        },
        error: null,
        maskAsNotFound: false,
      }
    }

    return maskAsNotFound()
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
