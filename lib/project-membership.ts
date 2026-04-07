import type { Project, ProjectMemberRole } from "@/lib/types"

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  coordinador: "Coordinador",
  colaborador: "Colaborador",
  modelador: "Modelador",
  lider: "Líder",
}

export function getProjectCoordinatorIds(project: Pick<Project, "coordinatorId" | "coordinatorIds" | "projectMembers">) {
  const contextual = [
    ...(project.coordinatorIds ?? []),
    ...((project.projectMembers ?? [])
      .filter((member) => member.role === "coordinador" || member.role === "lider")
      .map((member) => member.userId)),
  ]

  const uniqueIds = [...new Set(contextual.filter(Boolean))]

  if (uniqueIds.length > 0) {
    return uniqueIds
  }

  return project.coordinatorId ? [project.coordinatorId] : []
}

export function getPrimaryProjectCoordinatorId(
  project: Pick<Project, "coordinatorId" | "coordinatorIds" | "projectMembers">
) {
  return getProjectCoordinatorIds(project)[0] ?? project.coordinatorId
}

export function isProjectCoordinator(
  project: Pick<Project, "coordinatorId" | "coordinatorIds" | "projectMembers">,
  userId: string | null | undefined
) {
  if (!userId) return false
  return getProjectCoordinatorIds(project).includes(userId)
}
