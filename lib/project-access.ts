import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { clients, projects } from "@/db/schema"
import type { ApiUser } from "@/lib/api-auth"
import { getProjectMembership } from "@/lib/project-membership-store"

export interface ProjectAccessContext {
  projectId: string
  coordinatorId: string
  coordinatorIds: string[]
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
  const membership = await getProjectMembership(projectContext.projectId, {
    legacyCoordinatorId: projectContext.coordinatorId,
  })
  const contextualProjectContext = {
    ...projectContext,
    coordinatorId: membership.coordinatorIds[0] ?? projectContext.coordinatorId,
    coordinatorIds: membership.coordinatorIds,
  }

  if (user.role === "admin") {
    return { context: contextualProjectContext, error: null }
  }

  if (user.role === "coordinador") {
    if (membership.coordinatorIds.includes(user.id)) {
      return { context: contextualProjectContext, error: null }
    }

    return {
      context: null,
      error: notFound("Proyecto no encontrado"),
    }
  }

  if (user.role === "externo") {
    if (projectContext.clientEmail === user.email) {
      return { context: contextualProjectContext, error: null }
    }

    return {
      context: null,
      error: notFound("Proyecto no encontrado"),
    }
  }

  if (membership.projectMembers.some((member) => member.userId === user.id)) {
    return { context: contextualProjectContext, error: null }
  }

  if (user.role === "trabajador" || user.role === "coordinador") {
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
