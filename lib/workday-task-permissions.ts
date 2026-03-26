import type { UserRole } from "@/lib/types"

export function canCreateWorkdayTask(role?: UserRole | null) {
  return role === "admin" || role === "coordinador" || role === "trabajador"
}

export function getWorkdayTaskCreationHint(role?: UserRole | null) {
  if (role === "trabajador") {
    return "La tarea se te asignara automaticamente."
  }

  return "La nueva tarea quedara disponible en este proyecto."
}
