import { eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { projectMembers, projectWorkers, projects } from "@/db/schema"
import type { ProjectMemberRole } from "@/lib/types"

export interface ProjectMembershipRecord {
  projectId: string
  coordinatorIds: string[]
  assignedWorkerIds: string[]
  projectMembers: Array<{
    userId: string
    role: ProjectMemberRole
  }>
}

export class ProjectMembershipDriftError extends Error {
  readonly projectIds: string[]

  constructor(message: string, projectIds: string[]) {
    super(message)
    this.name = "ProjectMembershipDriftError"
    this.projectIds = projectIds
  }
}

export function isProjectMembershipDriftError(error: unknown): error is ProjectMembershipDriftError {
  return error instanceof ProjectMembershipDriftError
}

function isMissingProjectMembersTable(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes('relation "project_members" does not exist')
      || error.message.includes("project_members")
    )
}

function dedupeMembers(members: Array<{ userId: string; role: ProjectMemberRole }>) {
  return [...new Map(members.map((member) => [`${member.userId}:${member.role}`, member])).values()]
}

async function loadContextualMembers(projectIds: string[]) {
  if (projectIds.length === 0) return []

  try {
    return await db
      .select({
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds))
  } catch (error) {
    if (isMissingProjectMembersTable(error)) {
      throw new ProjectMembershipDriftError(
        "La tabla project_members no existe o no esta disponible en la DB activa.",
        projectIds
      )
    }

    throw error
  }
}

function getProjectMembershipDriftErrorMessage(projectIds: string[]) {
  const preview = projectIds.slice(0, 3).join(", ")
  const suffix = projectIds.length > 3 ? ` y ${projectIds.length - 3} mas` : ""
  return `Faltan membresias contextualizadas en project_members para: ${preview}${suffix}.`
}

export async function getProjectMemberships(
  projectIds: string[],
  _options?: {
    legacyCoordinators?: Array<{ projectId: string; coordinatorId: string | null }>
  }
) {
  if (projectIds.length === 0) {
    return new Map<string, ProjectMembershipRecord>()
  }

  const uniqueProjectIds = [...new Set(projectIds)]

  const [contextualRows, workerRows] = await Promise.all([
    loadContextualMembers(uniqueProjectIds),
    db
      .select({
        projectId: projectWorkers.projectId,
        userId: projectWorkers.userId,
      })
      .from(projectWorkers)
      .where(inArray(projectWorkers.projectId, uniqueProjectIds)),
  ])

  const contextualByProject = new Map<string, Array<{ userId: string; role: ProjectMemberRole }>>()
  for (const row of contextualRows) {
    const members = contextualByProject.get(row.projectId) ?? []
    members.push({ userId: row.userId, role: row.role })
    contextualByProject.set(row.projectId, members)
  }

  const workersByProject = new Map<string, string[]>()
  for (const row of workerRows) {
    const workerIds = workersByProject.get(row.projectId) ?? []
    workerIds.push(row.userId)
    workersByProject.set(row.projectId, workerIds)
  }

  const membershipMap = new Map<string, ProjectMembershipRecord>()
  const missingProjectIds: string[] = []

  for (const projectId of uniqueProjectIds) {
    const contextualMembers = contextualByProject.get(projectId) ?? []
    if (contextualMembers.length === 0) {
      missingProjectIds.push(projectId)
      continue
    }

    const assignedWorkerIds = [...new Set(workersByProject.get(projectId) ?? [])]
    const dedupedMembers = dedupeMembers(contextualMembers)
    const coordinatorIds = [...new Set(
      dedupedMembers
        .filter((member) => member.role === "coordinador" || member.role === "lider")
        .map((member) => member.userId)
    )]

    if (coordinatorIds.length === 0) {
      missingProjectIds.push(projectId)
      continue
    }

    membershipMap.set(projectId, {
      projectId,
      coordinatorIds,
      assignedWorkerIds,
      projectMembers: dedupedMembers,
    })
  }

  if (missingProjectIds.length > 0) {
    throw new ProjectMembershipDriftError(
      getProjectMembershipDriftErrorMessage(missingProjectIds),
      missingProjectIds
    )
  }

  return membershipMap
}

export async function getProjectMembership(
  projectId: string,
  options?: {
    legacyCoordinatorId?: string | null
  }
) {
  const memberships = await getProjectMemberships([projectId], {
    legacyCoordinators: [{ projectId, coordinatorId: options?.legacyCoordinatorId ?? null }],
  })

  const membership = memberships.get(projectId)

  if (!membership) {
    throw new ProjectMembershipDriftError(
      getProjectMembershipDriftErrorMessage([projectId]),
      [projectId]
    )
  }

  return membership
}

export async function syncProjectMembers(input: {
  projectId: string
  coordinatorIds: string[]
  assignedWorkerIds: string[]
  leaderIds?: string[]
  modelerIds?: string[]
}) {
  try {
    await db.delete(projectMembers).where(eq(projectMembers.projectId, input.projectId))

    const leaderSet = new Set(input.leaderIds ?? [])
    const modelerSet = new Set(input.modelerIds ?? [])
    const coordinatorSet = new Set(input.coordinatorIds)

    const nextMembers = dedupeMembers([
      ...input.coordinatorIds.map((userId) => ({ userId, role: "coordinador" as const })),
      ...(input.leaderIds ?? []).map((userId) => ({ userId, role: "lider" as const })),
      ...(input.modelerIds ?? []).map((userId) => ({ userId, role: "modelador" as const })),
      ...input.assignedWorkerIds
        .filter((userId) => !coordinatorSet.has(userId) && !leaderSet.has(userId) && !modelerSet.has(userId))
        .map((userId) => ({ userId, role: "colaborador" as const })),
    ])

    if (nextMembers.length > 0) {
      await db.insert(projectMembers).values(
        nextMembers.map((member) => ({
          projectId: input.projectId,
          userId: member.userId,
          role: member.role,
        }))
      )
    }

    return true
  } catch (error) {
    if (isMissingProjectMembersTable(error)) {
      throw new ProjectMembershipDriftError(
        "No se pudo sincronizar project_members porque la tabla no existe o no esta disponible.",
        [input.projectId]
      )
    }

    throw error
  }
}

export async function syncProjectMembershipsForProjects(projectIds: string[]) {
  const uniqueProjectIds = [...new Set(projectIds)]

  if (uniqueProjectIds.length === 0) {
    return 0
  }

  const [projectRows, workerRows, contextualRows] = await Promise.all([
    db
      .select({
        projectId: projects.id,
        coordinatorId: projects.coordinatorId,
      })
      .from(projects)
      .where(inArray(projects.id, uniqueProjectIds)),
    db
      .select({
        projectId: projectWorkers.projectId,
        userId: projectWorkers.userId,
      })
      .from(projectWorkers)
      .where(inArray(projectWorkers.projectId, uniqueProjectIds)),
    loadContextualMembers(uniqueProjectIds),
  ])

  const workersByProject = new Map<string, string[]>()
  for (const row of workerRows) {
    const members = workersByProject.get(row.projectId) ?? []
    members.push(row.userId)
    workersByProject.set(row.projectId, members)
  }

  const contextualByProject = new Map<string, Array<{ userId: string; role: ProjectMemberRole }>>()
  for (const row of contextualRows) {
    const members = contextualByProject.get(row.projectId) ?? []
    members.push({ userId: row.userId, role: row.role })
    contextualByProject.set(row.projectId, members)
  }

  for (const projectRow of projectRows) {
    const assignedWorkerIds = [...new Set(workersByProject.get(projectRow.projectId) ?? [])]
    const contextualMembers = contextualByProject.get(projectRow.projectId) ?? []
    const coordinatorIds = [...new Set([
      projectRow.coordinatorId,
      ...contextualMembers
        .filter((member) => member.role === "coordinador")
        .map((member) => member.userId),
    ])]
    const leaderIds = [...new Set(
      contextualMembers
        .filter((member) => member.role === "lider" && assignedWorkerIds.includes(member.userId))
        .map((member) => member.userId)
    )]
    const modelerIds = [...new Set(
      contextualMembers
        .filter((member) => member.role === "modelador" && assignedWorkerIds.includes(member.userId))
        .map((member) => member.userId)
    )]

    await syncProjectMembers({
      projectId: projectRow.projectId,
      coordinatorIds,
      assignedWorkerIds,
      leaderIds,
      modelerIds,
    })
  }

  return projectRows.length
}

export async function syncProjectMembershipsForUser(userId: string) {
  try {
    const [workerProjects, contextualProjects] = await Promise.all([
      db
        .select({ projectId: projectWorkers.projectId })
        .from(projectWorkers)
        .where(eq(projectWorkers.userId, userId)),
      db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, userId)),
    ])

    const projectIds = [...new Set([
      ...workerProjects.map((row) => row.projectId),
      ...contextualProjects.map((row) => row.projectId),
    ])]

    return syncProjectMembershipsForProjects(projectIds)
  } catch (error) {
    if (isMissingProjectMembersTable(error)) {
      throw new ProjectMembershipDriftError(
        "No se pudo leer project_members para resincronizar membresias del usuario.",
        []
      )
    }

    throw error
  }
}

export async function userHasProjectMembership(input: {
  projectId: string
  userId: string
}) {
  const membership = await getProjectMembership(input.projectId)
  return membership.projectMembers.some((member) => member.userId === input.userId)
}

export async function userHasProjectCoordinatorMembership(input: {
  projectId: string
  userId: string
  legacyCoordinatorId?: string | null
}) {
  const membership = await getProjectMembership(input.projectId, {
    legacyCoordinatorId: input.legacyCoordinatorId,
  })

  return membership.coordinatorIds.includes(input.userId)
}
