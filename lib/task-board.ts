import type { Task, TaskStatus } from "@/lib/types"
import { isTaskOverdue } from "@/lib/task-display"

export type TaskSortKey = "statusDate" | "dueDate" | "createdAt" | "id" | "name" | "status" | "urgency"
export type TaskSortDirection = "asc" | "desc"
export type TaskView = "active" | "review" | "completed" | "history"

type TaskLike = Task & {
  statusChangedAt?: string | null
  updatedAt?: string | null
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "en_curso",
  "pendiente",
  "retrasado",
  "bloqueado",
  "esperando_info",
  "listo_para_revision",
  "finalizado",
]

export const ACTIVE_TASK_STATUSES = new Set<TaskStatus>([
  "en_curso",
  "pendiente",
  "retrasado",
  "bloqueado",
  "esperando_info",
])

export const REVIEW_TASK_STATUSES = new Set<TaskStatus>(["listo_para_revision"])
export const COMPLETED_TASK_STATUSES = new Set<TaskStatus>(["finalizado"])
export const HISTORY_TASK_STATUSES = new Set<TaskStatus>(["listo_para_revision", "finalizado"])

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  active: "Activas",
  review: "En revision",
  completed: "Finalizadas",
  history: "Historial",
}

// Weight map for urgency-first sort (lower = more urgent)
const TASK_URGENCY_WEIGHT: Record<TaskStatus, number> = {
  bloqueado: 0,
  retrasado: 1,
  en_curso: 2,
  pendiente: 3,
  esperando_info: 4,
  listo_para_revision: 5,
  finalizado: 6,
}

export const TASK_SORT_LABELS: Record<TaskSortKey, string> = {
  dueDate: "Fecha de entrega",
  createdAt: "Fecha de creacion",
  statusDate: "Fecha de estatus",
  id: "ID",
  name: "Nombre",
  status: "Estatus",
  urgency: "Urgencia",
}

export const DEFAULT_TASK_SORT_KEY: TaskSortKey = "dueDate"
export const DEFAULT_TASK_SORT_DIRECTION: TaskSortDirection = "asc"
export const DEFAULT_TASK_VIEW: TaskView = "active"

function getTimestamp(value: string | Date | null | undefined) {
  if (!value) return Number.NaN
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime()
}

function compareNumbers(a: number, b: number) {
  return a - b
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true })
}

export function getTaskStatusDate(task: TaskLike) {
  return task.statusChangedAt ?? task.updatedAt ?? task.createdAt ?? null
}

export function getTaskViewForStatus(status: TaskStatus): TaskView {
  if (REVIEW_TASK_STATUSES.has(status)) return "review"
  if (COMPLETED_TASK_STATUSES.has(status)) return "completed"
  return "active"
}

export function getStatusesForView(view: TaskView): TaskStatus[] {
  switch (view) {
    case "active":
      return TASK_STATUS_ORDER.filter((status) => ACTIVE_TASK_STATUSES.has(status))
    case "review":
      return TASK_STATUS_ORDER.filter((status) => REVIEW_TASK_STATUSES.has(status))
    case "completed":
      return TASK_STATUS_ORDER.filter((status) => COMPLETED_TASK_STATUSES.has(status))
    case "history":
      return TASK_STATUS_ORDER.filter((status) => HISTORY_TASK_STATUSES.has(status))
  }
}

export function filterTasksByView<T extends TaskLike>(tasks: T[], view: TaskView) {
  return tasks.filter((task) => {
    if (view === "active") return ACTIVE_TASK_STATUSES.has(task.status)
    if (view === "review") return REVIEW_TASK_STATUSES.has(task.status)
    if (view === "completed") return COMPLETED_TASK_STATUSES.has(task.status)
    return HISTORY_TASK_STATUSES.has(task.status)
  })
}

export function sortTasks<T extends TaskLike>(
  tasks: T[],
  sortKey: TaskSortKey,
  sortDirection: TaskSortDirection
) {
  const direction = sortDirection === "asc" ? 1 : -1

  return [...tasks].sort((left, right) => {
    let result = 0

    if (sortKey === "dueDate") {
      const leftValue = getTimestamp(left.dueDate)
      const rightValue = getTimestamp(right.dueDate)
      const leftMissing = Number.isNaN(leftValue)
      const rightMissing = Number.isNaN(rightValue)

      if (leftMissing && rightMissing) result = 0
      else if (leftMissing) result = 1
      else if (rightMissing) result = -1
      else result = compareNumbers(leftValue, rightValue)
    }

    if (sortKey === "createdAt") {
      result = compareNumbers(getTimestamp(left.createdAt), getTimestamp(right.createdAt))
    }

    if (sortKey === "statusDate") {
      result = compareNumbers(getTimestamp(getTaskStatusDate(left)), getTimestamp(getTaskStatusDate(right)))
    }

    if (sortKey === "id") {
      result = compareNumbers(left.correlativeId, right.correlativeId)
    }

    if (sortKey === "name") {
      result = compareText(left.name, right.name)
    }

    if (sortKey === "status") {
      result = compareNumbers(
        TASK_STATUS_ORDER.indexOf(left.status),
        TASK_STATUS_ORDER.indexOf(right.status)
      )
    }

    if (sortKey === "urgency") {
      const leftOverdue = isTaskOverdue(left) ? 1 : 0
      const rightOverdue = isTaskOverdue(right) ? 1 : 0
      const leftWeight = (TASK_URGENCY_WEIGHT[left.status] ?? 99) + leftOverdue * -0.5
      const rightWeight = (TASK_URGENCY_WEIGHT[right.status] ?? 99) + rightOverdue * -0.5
      result = compareNumbers(leftWeight, rightWeight)
    }

    if (result === 0) {
      result = compareNumbers(left.correlativeId, right.correlativeId)
    }

    if (result === 0) {
      result = compareText(left.name, right.name)
    }

    return result * direction
  })
}

export function groupTasksByStatus<T extends TaskLike>(tasks: T[], statuses: TaskStatus[]) {
  return statuses
    .map((status) => ({
      status,
      tasks: tasks.filter((task) => task.status === status),
    }))
    .filter((group) => group.tasks.length > 0)
}

export type GroupByKey = "status" | "project" | "priority" | "dueDate"

export const GROUP_BY_LABELS: Record<GroupByKey, string> = {
  status: "Estado",
  project: "Proyecto",
  priority: "Prioridad",
  dueDate: "Fecha de término",
}

export const DEFAULT_GROUP_BY: GroupByKey = "status"

type GroupableTask = TaskLike & {
  _projectId?: string
  _projectName?: string
  priority?: number | null
  dueDate?: string | null
}

export function groupTasksBy<T extends GroupableTask>(
  tasks: T[],
  groupBy: Exclude<GroupByKey, "status">
): Array<{ key: string; label: string; tasks: T[] }> {
  if (groupBy === "project") {
    const map = new Map<string, T[]>()
    for (const t of tasks) {
      const key = t._projectId ?? "__sin_proyecto__"
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()]
      .map(([k, ts]) => ({ key: k, label: ts[0]._projectName ?? "Sin proyecto", tasks: ts }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"))
  }

  if (groupBy === "priority") {
    const PRIORITY_LABELS: Record<string, string> = {
      "4": "Crítica",
      "3": "Alta",
      "2": "Media",
      "1": "Baja",
      "0": "Sin prioridad",
    }
    const map = new Map<string, T[]>()
    for (const t of tasks) {
      const key = String(t.priority ?? 0)
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([k, ts]) => ({ key: k, label: PRIORITY_LABELS[k] ?? `Prioridad ${k}`, tasks: ts }))
  }

  if (groupBy === "dueDate") {
    const today = new Date(new Date().toDateString())
    const in7  = new Date(today); in7.setDate(today.getDate() + 7)
    const in14 = new Date(today); in14.setDate(today.getDate() + 14)
    const in30 = new Date(today); in30.setDate(today.getDate() + 30)

    type BucketKey = "overdue" | "week1" | "week2" | "month" | "later" | "no_date"
    const BUCKET_LABELS: Record<BucketKey, string> = {
      overdue:  "Vencidas",
      week1:    "Esta semana",
      week2:    "Próximas dos semanas",
      month:    "Este mes",
      later:    "Más adelante",
      no_date:  "Sin fecha",
    }
    const ORDER: BucketKey[] = ["overdue", "week1", "week2", "month", "later", "no_date"]
    const buckets: Record<BucketKey, T[]> = {
      overdue: [], week1: [], week2: [], month: [], later: [], no_date: [],
    }

    for (const t of tasks) {
      if (!t.dueDate) { buckets.no_date.push(t); continue }
      const due = new Date(t.dueDate)
      if (due < today && t.status !== "finalizado") buckets.overdue.push(t)
      else if (due < in7)  buckets.week1.push(t)
      else if (due < in14) buckets.week2.push(t)
      else if (due < in30) buckets.month.push(t)
      else                 buckets.later.push(t)
    }

    return ORDER
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ key: k, label: BUCKET_LABELS[k], tasks: buckets[k] }))
  }

  return []
}
