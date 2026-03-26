import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { clients, messages, projects, projectWorkers, taskAssignments, tasks } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"

export interface ProjectMessageAccessContext {
  projectId: string
  coordinatorId: string
  clientEmail: string
}

export interface TaskMessageAccessContext {
  taskId: string
  projectId: string
  coordinatorId: string
  clientEmail: string
}

export interface SessionMessageAccessContext {
  sessionId: string
}

type MessageAccessSuccess<TContext> = {
  context: TContext
  error: null
}

type MessageAccessFailure = {
  context: null
  error: NextResponse
}

type SessionAccessResult = {
  context: SessionMessageAccessContext | null
  error: NextResponse | null
  exists: boolean
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
}

function forbidden(message = "Sin permisos suficientes") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function getProjectMessageAccessContext(
  projectId: string,
  user: ApiUser
): Promise<
  MessageAccessSuccess<ProjectMessageAccessContext> | MessageAccessFailure
> {
  const projectRows = await db
    .select({
      projectId: projects.id,
      coordinatorId: projects.coordinatorId,
      clientEmail: clients.email,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))

  if (projectRows.length === 0) {
    return {
      context: null,
      error: notFound("Proyecto no encontrado"),
    }
  }

  const projectContext = projectRows[0]

  if (user.role === "admin") {
    return { context: projectContext, error: null }
  }

  if (user.role === "coordinador") {
    if (projectContext.coordinatorId === user.id) {
      return { context: projectContext, error: null }
    }

    return {
      context: null,
      error: notFound("Proyecto no encontrado"),
    }
  }

  if (user.role === "externo") {
    if (projectContext.clientEmail === user.email) {
      return { context: projectContext, error: null }
    }

    return {
      context: null,
      error: notFound("Proyecto no encontrado"),
    }
  }

  return {
    context: null,
    error: forbidden(),
  }
}

export async function getTaskMessageAccessContext(
  taskId: string,
  user: ApiUser
): Promise<MessageAccessSuccess<TaskMessageAccessContext> | MessageAccessFailure> {
  const taskRows = await db
    .select({
      taskId: tasks.id,
      projectId: tasks.projectId,
      coordinatorId: projects.coordinatorId,
      clientEmail: clients.email,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(tasks.id, taskId))

  if (taskRows.length === 0) {
    return {
      context: null,
      error: notFound("Tarea no encontrada"),
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
      error: notFound("Tarea no encontrada"),
    }
  }

  if (user.role === "externo") {
    if (taskContext.clientEmail === user.email) {
      return { context: taskContext, error: null }
    }

    return {
      context: null,
      error: notFound("Tarea no encontrada"),
    }
  }

  if (user.role === "trabajador") {
    const [projectMembership, taskMembership] = await Promise.all([
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
        .where(
          and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.userId, user.id))
        ),
    ])

    if (projectMembership.length > 0 || taskMembership.length > 0) {
      return { context: taskContext, error: null }
    }

    return {
      context: null,
      error: notFound("Tarea no encontrada"),
    }
  }

  return {
    context: null,
    error: forbidden(),
  }
}

export async function getSessionMessageAccessContext(
  sessionId: string,
  user: ApiUser,
  options?: { allowMissing?: boolean }
): Promise<SessionAccessResult> {
  const sessionRows = await db
    .select({
      sessionId: messages.sessionId,
      fromUserId: messages.fromUserId,
      projectId: messages.projectId,
      coordinatorId: projects.coordinatorId,
    })
    .from(messages)
    .leftJoin(projects, eq(messages.projectId, projects.id))
    .where(eq(messages.sessionId, sessionId))

  if (sessionRows.length === 0) {
    if (options?.allowMissing) {
      return {
        context: null,
        error: null,
        exists: false,
      }
    }

    return {
      context: null,
      error: notFound("Sesión de mensajes no encontrada"),
      exists: false,
    }
  }

  const sessionContext = {
    sessionId,
  }

  if (user.role === "admin") {
    return { context: sessionContext, error: null, exists: true }
  }

  if (user.role === "coordinador") {
    if (sessionRows.some((row) => row.coordinatorId === user.id)) {
      return { context: sessionContext, error: null, exists: true }
    }

    return {
      context: null,
      error: notFound("Sesión de mensajes no encontrada"),
      exists: true,
    }
  }

  if (user.role === "trabajador") {
    if (sessionRows.some((row) => row.fromUserId === user.id)) {
      return { context: sessionContext, error: null, exists: true }
    }

    return {
      context: null,
      error: notFound("Sesión de mensajes no encontrada"),
      exists: true,
    }
  }

  return {
    context: null,
    error: forbidden(),
    exists: true,
  }
}
