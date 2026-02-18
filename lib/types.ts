// ── Roles ──
export type UserRole = "admin" | "coordinador" | "trabajador" | "externo"

export type ProjectStatus = "Activo" | "Pausado" | "Finalizado"

export type TimerStatus = "trabajando" | "colacion" | "pausado" | "finalizado" | "inactivo"

export type TaskStatus = "abierta" | "cerrada" | "pendiente_aprobacion"

export type WorkerStatus = "disponible" | "en_reunion" | "trabajando" | "ausente"

// ── Documentos (mock: solo metadata, sin archivo real) ──
export interface DocumentAttachment {
  id: string
  name: string
  type: string        // e.g. "pdf", "dwg", "xlsx"
  size: string        // e.g. "2.4 MB"
  uploadedBy: string  // userId
  uploadedAt: string  // ISO date string
}

// ── Cliente ──
export interface Client {
  id: string
  name: string
  rut: string
  contact: string
  email: string
  address: string
}

// ── Usuario ──
export interface User {
  id: string
  name: string
  email: string
  emailPersonal: string       // email personal
  role: UserRole
  position: string
  active: boolean
  avatar?: string
  scheduleStart: string       // e.g. "08:00"
  scheduleEnd: string         // e.g. "17:00"
  scheduleType: "fijo" | "libre"
  workerStatus?: WorkerStatus // solo para trabajadores
}

// ── Actividad (sub-tarea dentro de una Tarea) ──
export interface Activity {
  id: string
  taskId: string
  name: string
  description: string
  completed: boolean
  dueDate: string | null       // fecha estimada de finalización
  createdBy: string            // userId
  createdAt: string            // ISO date
}

// ── Comentario (puede vivir en tarea o actividad) ──
export interface Comment {
  id: string
  parentType: "task" | "activity"
  parentId: string             // taskId o activityId
  authorId: string             // userId
  text: string
  createdAt: string            // ISO date
}

// ── Tarea ──
export interface Task {
  id: string
  name: string
  description: string
  projectId: string
  assignedTo: string[]         // userIds asignados a la tarea
  createdBy: string            // userId
  createdAt: string            // ISO date
  dueDate: string | null       // fecha límite puesta por el usuario
  status: TaskStatus
  documents: DocumentAttachment[]
  activities: Activity[]
}

// ── Proyecto ──
export interface Project {
  id: string
  name: string
  description: string
  clientId: string
  coordinatorId: string        // userId del coordinador asignado
  stage: string                // etapa del proyecto (ej: "Diseño", "Construcción")
  startDate: string
  endDate: string
  status: ProjectStatus
  documents: DocumentAttachment[]
  urls: { label: string; url: string }[]
  tasks: Task[]
  assignedWorkers: string[]
}

// ── Registro de Tiempo ──
export interface TimeEntry {
  id: string
  userId: string
  projectId: string
  taskId: string
  date: string
  startTime: string
  lunchStartTime: string | null
  lunchEndTime: string | null
  endTime: string | null
  effectiveHours: number
  status: TimerStatus
  notes: string
  progressPercentage: number
  pauseCount: number
  progressJustification: string
  editable: boolean             // true si aún está dentro de las 24h de cierre
}

// ── Resumen Diario ──
export interface DaySummary {
  date: string
  hoursWorked: number
  hoursRemaining: number
  lunchDuration: number
  project: string
  tasks: string[]
  status: TimerStatus
}

// ── Progreso por Hora ──
export interface HourlyProgress {
  hour: number
  timestamp: Date
  description: string
  percentage: number
}
