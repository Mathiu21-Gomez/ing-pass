import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { projects, tasks, taskAssignments } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"

export interface TaskAccessContext {
  taskId: string
  projectId: string
  coordinatorId: string
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

  if (user.role === "admin") {
    return { context: taskContext, error: null }
  }

  if (user.role === "coordinador") {
    if (taskContext.coordinatorId === user.id) {
      return { context: taskContext, error: null }
    }

    return {
      context: null,
      error: NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 }),
    }
  }

  if (user.role === "trabajador") {
    const assignment = await db
      .select({ taskId: taskAssignments.taskId })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.taskId, taskContext.taskId),
          eq(taskAssignments.userId, user.id)
        )
      )

    if (assignment.length > 0) {
      return { context: taskContext, error: null }
    }

    return {
      context: null,
      error: NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 }),
    }
  }

  return {
    context: null,
    error: NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 }),
  }
}
