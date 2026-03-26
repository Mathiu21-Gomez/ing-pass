export const MODULES = {
  DASHBOARD: "dashboard",
  USERS: "users",
  PROJECTS: "projects",
  TASKS: "tasks",
  CLIENTS: "clients",
  TIME_ENTRIES: "time_entries",
  HISTORIAL: "historial",
  NOTES: "notes",
  ROLES: "roles",
} as const

export type Module = (typeof MODULES)[keyof typeof MODULES]

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  MANAGE: "manage",
} as const

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS]

export type Permission = `${Module}:${Action}`

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  users: "Usuarios",
  projects: "Proyectos",
  tasks: "Tareas",
  clients: "Clientes",
  time_entries: "Registros de Tiempo",
  historial: "Historial",
  notes: "Notas",
  roles: "Roles y Permisos",
}

export const ACTION_LABELS: Record<Action, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  manage: "Administrar",
}

/** Permissions assigned by default to each legacy role when seeding */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: (Object.values(MODULES) as Module[]).flatMap((module) =>
    (Object.values(ACTIONS) as Action[]).map(
      (action) => `${module}:${action}` as Permission
    )
  ),
  coordinador: [
    "dashboard:view",
    "projects:view",
    "projects:create",
    "projects:edit",
    "tasks:view",
    "tasks:create",
    "tasks:edit",
    "tasks:delete",
    "users:view",
    "clients:view",
    "time_entries:view",
    "historial:view",
    "notes:view",
    "notes:create",
    "notes:edit",
    "notes:delete",
  ],
  trabajador: [
    "dashboard:view",
    "tasks:view",
    "time_entries:view",
    "time_entries:create",
    "time_entries:edit",
    "historial:view",
    "notes:view",
    "notes:create",
    "notes:edit",
  ],
  externo: ["dashboard:view", "projects:view"],
}

/** Build a permission string */
export function perm(module: Module, action: Action): Permission {
  return `${module}:${action}`
}

/** Check if a permissions set contains a specific permission */
export function can(
  userPermissions: Set<string> | string[],
  module: Module,
  action: Action
): boolean {
  const set =
    userPermissions instanceof Set
      ? userPermissions
      : new Set(userPermissions)
  return set.has(perm(module, action))
}
