import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { projects, tasks } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"
import { getProjectMembership } from "@/lib/project-membership-store"

export interface TaskAccessContext {
  taskId: string
  projectId: string
  coordinatorId: string
  coordinatorIds: string[]
}

type TaskAccessSuccess = {
  context: TaskAccessContext
  error: null
}

type TaskAccessFailure = {
  context: null
  error: NextResponse
}

export async function getTaskAccessContext(
  taskId: string,
  user: ApiUser
): Promise<TaskAccessSuccess | TaskAccessFailure> {
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
    return {
      context: null,
      error: NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 }),
    }
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
    return { context: contextualTaskContext, error: null }
  }

  if (membership.projectMembers.some((member) => member.userId === user.id)) {
    return { context: contextualTaskContext, error: null }
  }

  return {
    context: null,
    error: NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 }),
  }
}
