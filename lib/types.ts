export type UserRole = "admin" | "trabajador"

export type ProjectStatus = "Activo" | "Pausado" | "Finalizado"

export type TimerStatus = "trabajando" | "colacion" | "pausado" | "finalizado" | "inactivo"

export interface Client {
  id: string
  name: string
  rut: string
  contact: string
  email: string
  address: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  position: string
  active: boolean
  avatar?: string
}

export interface Task {
  id: string
  name: string
  description: string
  projectId: string
}

export interface Project {
  id: string
  name: string
  description: string
  clientId: string
  startDate: string
  endDate: string
  status: ProjectStatus
  tasks: Task[]
  assignedWorkers: string[]
}

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
  progressPercentage: number  // 0-100 manual progress set by worker
  pauseCount: number          // number of times paused during the day
  progressJustification: string  // justification/reason for the progress percentage
}

export interface DaySummary {
  date: string
  hoursWorked: number
  hoursRemaining: number
  lunchDuration: number
  project: string
  tasks: string[]
  status: TimerStatus
}

export interface HourlyProgress {
  hour: number           // 1, 2, 3, etc.
  timestamp: Date        // When this milestone was reached
  description: string    // Worker's description of progress
  percentage: number     // Progress percentage (12.5%, 25%, etc.)
}
