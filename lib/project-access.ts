import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { clients, projects, projectWorkers } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"

export interface ProjectAccessContext {
  projectId: string
  coordinatorId: string
  clientEmail: string
}

type ProjectAccessSuccess = {
  context: ProjectAccessContext
  error: null
}

type ProjectAccessFailure = {
  context: null
  error: NextResponse
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
}

function forbidden(message = "Sin permisos suficientes") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function getProjectAccessContext(
  projectId: string,
  user: ApiUser
): Promise<ProjectAccessSuccess | ProjectAccessFailure> {
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

  if (user.role === "trabajador") {
    const membershipRows = await db
      .select({ projectId: projectWorkers.projectId })
      .from(projectWorkers)
      .where(
        and(
          eq(projectWorkers.projectId, projectContext.projectId),
          eq(projectWorkers.userId, user.id)
        )
      )

    if (membershipRows.length > 0) {
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
