// ── Roles ──
export type UserRole = "admin" | "coordinador" | "trabajador" | "externo"

export type ProjectStatus = "Activo" | "Pausado" | "Finalizado"

export type TimerStatus = "trabajando" | "colacion" | "pausado" | "reunion" | "finalizado" | "inactivo"

export type TaskStatus = "abierta" | "cerrada" | "pendiente_aprobacion"

export type WorkerStatus = "disponible" | "en_reunion" | "trabajando" | "ausente"

// ── Documentos ──
export interface DocumentAttachment {
  id: string
  name: string
  type: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
}

// ── Imagen adjunta ──
export interface ImageAttachment {
  id: string
  name: string
  url: string
  uploadedBy: string
  uploadedAt: string
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

// ── Horario por día ──
export interface DaySchedule {
  dayOfWeek: number // 0=Lun … 6=Dom
  startTime: string
  endTime: string
  isWorkingDay: boolean
  reason: string // Justificación para Sáb/Dom
}

export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

// ── Usuario ──
export interface User {
  id: string
  name: string
  email: string
  emailPersonal: string
  role: UserRole
  position: string
  active: boolean
  avatar?: string
  scheduleType: "fijo" | "libre"
  workerStatus?: WorkerStatus
  weeklySchedule: DaySchedule[]
}

// ── Actividad ──
export interface Activity {
  id: string
  taskId: string
  name: string
  description: string
  completed: boolean
  dueDate: string | null
  createdBy: string
  createdAt: string
}

// ── Comentario ──
export interface Comment {
  id: string
  parentType: "task" | "activity"
  parentId: string
  authorId: string
  text: string
  createdAt: string
  imageAttachments?: ImageAttachment[]
  referenceId?: string
}

// ── Tarea ──
export interface Task {
  id: string
  name: string
  description: string
  projectId: string
  assignedTo: string[]
  createdBy: string
  createdAt: string
  dueDate: string | null
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
  coordinatorId: string
  stage: string
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
  editable: boolean
}

// ── Time Entry enriched (from API) ──
export interface TimeEntryEnriched extends TimeEntry {
  userName: string
  userPosition: string
  projectName: string
  taskName: string
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

// ── Dashboard KPIs (from /api/dashboard/kpis) ──
export interface DashboardKPIs {
  tasksByProject: {
    projectId: string
    projectName: string
    totalTasks: number
    closedTasks: number
    completionRate: number
  }[]
  coordinatorTasks: number
  userCreatedTasks: number
  totalTasks: number
  totalActivities: number
  completedActivities: number
  progressByUser: {
    userId: string
    userName: string
    totalActivities: number
    completedActivities: number
    progressRate: number
    totalTasks: number
    closedTasks: number
  }[]
  hoursByProject: { project: string; hours: number }[]
  hoursByWorker: { worker: string; hours: number; target: number }[]
  activeWorkersToday: (TimeEntry & {
    userName: string
    userPosition: string
    projectName: string
    taskName: string
  })[]
  weeklyTrend: { day: string; hours: number }[]
  totalProjects: number
  activeProjects: number
  totalWorkers: number
}
