// ── Roles ──
export type UserRole = "admin" | "coordinador" | "trabajador" | "externo"

export type ProjectMemberRole = "coordinador" | "colaborador" | "modelador" | "lider"

export type TaskAssignmentRole = "primary" | "support"

export type ProjectStatus = "Activo" | "Pausado" | "Finalizado"

export type TimerStatus = "trabajando" | "colacion" | "pausado" | "reunion" | "finalizado" | "inactivo"

export type TaskStatus =
  | "pendiente"
  | "en_curso"
  | "esperando_info"
  | "bloqueado"
  | "listo_para_revision"
  | "finalizado"
  | "retrasado"

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

// ── Attachment de comentario (base64) ──
export interface CommentAttachment {
  id: string
  name: string
  type: string
  size: number
  data: string   // base64
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

export interface UserProjectReference {
  id: string
  name: string
  status?: ProjectStatus
}

export interface UserProjectSummary {
  coordinated: UserProjectReference[]
  worker: UserProjectReference[]
  activeTaskAssignments: number
}

export interface UserPromotionInfo {
  canPromoteToCoordinator: boolean
  cleanupProjectMemberships: number
  cleanupTaskAssignments: number
  reason: string | null
}

export interface UserRoleTransitionSummary {
  changed: boolean
  fromRole: UserRole
  toRole: UserRole
  removedProjectMemberships: number
  removedTaskAssignments: number
}

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
  projectSummary?: UserProjectSummary
  promotion?: UserPromotionInfo
  roleTransition?: UserRoleTransitionSummary
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
  mentions: string[]
  createdAt: string
  attachments: CommentAttachment[]
  referenceId?: string
}

// ── Etiqueta ──
export interface Tag {
  id: string
  name: string
  color: string
  projectId: string | null
  createdBy: string
  createdAt: string
}

// ── Alerta de tarea ──
export interface TaskAlert {
  id: string
  taskId: string
  userId: string
  alertAt: string
  message: string
  dismissed: boolean
  createdAt: string
}

// ── Link compartido ──
export interface SharedLink {
  id: string
  label: string
  url: string
  addedBy?: string
  createdAt?: string
}

// ── Tarea ──
export interface Task {
  id: string
  correlativeId: number
  name: string
  description: string
  guidelines: string | null
  priority: number
  projectId: string
  assignedTo: string[]
  supportIds?: string[]
  createdBy: string
  createdAt: string
  dueDate: string | null
  status: TaskStatus
  documents: DocumentAttachment[]
  activities: Activity[]
  tags: Tag[]
}

// ── Proyecto ──
export interface Project {
  id: string
  name: string
  description: string
  clientId: string
  coordinatorId: string
  coordinatorIds: string[]
  stage: string
  startDate: string
  endDate: string
  status: ProjectStatus
  progress: number
  documents: DocumentAttachment[]
  urls: { label: string; url: string }[]
  tasks: Task[]
  assignedWorkers: string[]
  projectMembers?: Array<{
    userId: string
    role: ProjectMemberRole
  }>
}

// ── Nota ──
export type NoteCategory = "trabajo_ayer" | "emergencia" | "anotacion" | "cumpleanos" | "general"

export interface Note {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  category: NoteCategory
  isTeamNote: boolean
  projectId: string | null
  createdAt: string
  updatedAt: string
}

// ── Evento / Comunicado ──
export interface AppEvent {
  id: string
  title: string
  content: string
  type: "evento" | "comunicado"
  eventDate: string | null
  createdBy: string
  targetRoles: string[]
  pinned: boolean
  createdAt: string
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
  runtimeState?: unknown | null
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
  taskStatusBreakdown: { status: string; count: number }[]
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

export interface TaskOperationalHistoryEvent {
  id: string
  actorName: string
  actorRole: string | null
  attachmentCount: number
  createdAt: string
  detail: string | null
  mentionCount: number
  summary: string
}

export interface TaskWorkerCurrentTaskContext {
  currentProjectName: string | null
  currentTaskId: string | null
  currentTaskName: string | null
  entryDate: string | null
  matchesCurrentTask: boolean
  startTime: string | null
  state: "active" | "idle" | "unassigned"
  timerStatus: TimerStatus | null
  workerId: string | null
  workerName: string | null
}

export interface TaskOperationalHistorySummary {
  lastActivityAt: string | null
  recentActivity: TaskOperationalHistoryEvent[]
  stats: {
    attachmentCount: number
    mentionCount: number
    messageCount: number
  }
  workerContext: TaskWorkerCurrentTaskContext
}
