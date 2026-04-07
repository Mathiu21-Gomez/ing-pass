"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, format, isToday, isTomorrow, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock, CalendarDays, FolderKanban } from "lucide-react"

import { TaskShellPanel } from "@/components/task-shell"
import { Calendar } from "@/components/ui/calendar"
import type { TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type CalendarTask = {
  id: string
  name: string
  description: string
  dueDate: string | null
  status: TaskStatus
  _projectName: string
}

interface TaskCalendarPanelProps {
  tasks: CalendarTask[]
  onTaskSelect?: (taskId: string) => void
  selectedTaskId?: string | null
  title?: string
  description?: string
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  en_curso: "En curso",
  pendiente: "Pendiente",
  retrasado: "Retrasado",
  bloqueado: "Bloqueado",
  esperando_info: "Esperando info",
  listo_para_revision: "Revision",
  finalizado: "Finalizado",
}

const STATUS_TONES: Record<TaskStatus, string> = {
  en_curso: "border-blue-200/70 bg-blue-500/10 text-blue-700 dark:border-blue-900/50 dark:text-blue-300",
  pendiente: "border-slate-200/70 bg-slate-500/10 text-slate-700 dark:border-slate-800/80 dark:text-slate-300",
  retrasado: "border-red-200/70 bg-red-500/10 text-red-700 dark:border-red-900/50 dark:text-red-300",
  bloqueado: "border-orange-200/70 bg-orange-500/10 text-orange-700 dark:border-orange-900/50 dark:text-orange-300",
  esperando_info: "border-yellow-200/70 bg-yellow-500/10 text-yellow-700 dark:border-yellow-900/50 dark:text-yellow-300",
  listo_para_revision: "border-violet-200/70 bg-violet-500/10 text-violet-700 dark:border-violet-900/50 dark:text-violet-300",
  finalizado: "border-emerald-200/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300",
}

function toDayKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function getSafeDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return startOfDay(parsed)
}

function getSummaryDateLabel(date: Date) {
  if (isToday(date)) return "Hoy"
  if (isTomorrow(date)) return "Mañana"
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

function getTaskPreview(task: CalendarTask) {
  const value = task.description.trim()
  if (!value) return "Sin resumen operativo cargado."
  return value.length > 110 ? `${value.slice(0, 107)}...` : value
}

export function TaskCalendarPanel({
  tasks,
  onTaskSelect,
  selectedTaskId,
  title = "Panel calendario",
  description = "Mapa mensual de entregas de la vista actual, con foco diario para seguimiento rápido.",
}: TaskCalendarPanelProps) {
  const today = useMemo(() => startOfDay(new Date()), [])

  const scheduledTasks = useMemo(() => {
    return tasks
      .map((task) => {
        const dueDate = getSafeDate(task.dueDate)
        return dueDate ? { task, dueDate } : null
      })
      .filter((entry): entry is { task: CalendarTask; dueDate: Date } => Boolean(entry))
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
  }, [tasks])

  const upcomingDate = useMemo(() => {
    const nextTask = scheduledTasks.find(({ dueDate }) => dueDate.getTime() >= today.getTime())
    return nextTask?.dueDate ?? scheduledTasks[0]?.dueDate ?? today
  }, [scheduledTasks, today])

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(upcomingDate)
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)

  useEffect(() => {
    setSelectedDate((current) => current ?? upcomingDate)
  }, [upcomingDate])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()

    for (const { task, dueDate } of scheduledTasks) {
      const key = toDayKey(dueDate)
      const existing = map.get(key)
      if (existing) {
        existing.push(task)
      } else {
        map.set(key, [task])
      }
    }

    return map
  }, [scheduledTasks])

  const dueDates = useMemo(() => scheduledTasks.map(({ dueDate }) => dueDate), [scheduledTasks])

  const summaryDate = hoveredDate ?? selectedDate ?? upcomingDate
  const summaryTasks = tasksByDay.get(toDayKey(summaryDate)) ?? []
  const withoutDueDateCount = tasks.length - scheduledTasks.length
  const upcomingCount = scheduledTasks.filter(({ dueDate }) => dueDate >= today && dueDate <= addDays(today, 6)).length
  const todayCount = tasksByDay.get(toDayKey(today))?.length ?? 0

  return (
    <TaskShellPanel title={title} description={description}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-2xl font-semibold tracking-tight">{todayCount}</span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Hoy</p>
          </div>
          <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-2xl font-semibold tracking-tight">{upcomingCount}</span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Próximos 7d</p>
          </div>
          <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-2xl font-semibold tracking-tight">{withoutDueDateCount}</span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Sin fecha</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90 p-2 shadow-sm">
          <Calendar
            mode="single"
            locale={es}
            selected={selectedDate}
            onSelect={(date) => setSelectedDate(date ?? upcomingDate)}
            month={selectedDate ?? upcomingDate}
            onMonthChange={(date) => setSelectedDate(date)}
            modifiers={{ hasTasks: dueDates }}
            modifiersClassNames={{ hasTasks: "bg-primary/5 font-semibold text-primary" }}
            onDayMouseEnter={(date) => setHoveredDate(startOfDay(date))}
            onDayMouseLeave={() => setHoveredDate(null)}
            className="mx-auto w-full p-1"
            classNames={{
              months: "flex w-full flex-col",
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_cell: "w-full rounded-md text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70",
              row: "mt-2 grid grid-cols-7",
              cell: "relative h-11 p-0 text-center text-sm",
              day: "h-11 w-full rounded-xl p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground",
              day_today: "border border-primary/30 bg-primary/10 text-primary",
            }}
            components={{
              DayContent: ({ date }) => {
                const count = tasksByDay.get(toDayKey(date))?.length ?? 0

                return (
                  <div className="relative flex h-11 w-full items-center justify-center">
                    <span>{date.getDate()}</span>
                    {count > 0 ? (
                      <span className="absolute bottom-1 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                        {count > 3 ? "3+" : count}
                      </span>
                    ) : null}
                  </div>
                )
              },
            }}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {hoveredDate ? "Resumen rápido" : "Fecha seleccionada"}
              </p>
              <p className="mt-1 text-sm font-medium capitalize text-foreground">{getSummaryDateLabel(summaryDate)}</p>
            </div>
            <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {summaryTasks.length} tarea{summaryTasks.length === 1 ? "" : "s"}
            </span>
          </div>

          {summaryTasks.length > 0 ? (
            <div className="space-y-2">
              {summaryTasks.map((task) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            {task._projectName}
                          </span>
                          <span>{format(new Date(task.dueDate ?? summaryDate), "d MMM", { locale: es })}</span>
                        </div>
                      </div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATUS_TONES[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{getTaskPreview(task)}</p>
                  </>
                )

                return onTaskSelect ? (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskSelect(task.id)}
                    className={cn(
                      "w-full rounded-2xl border border-border/60 bg-background px-3 py-3 text-left transition-all transition-colors hover:border-primary/30 hover:bg-primary/[0.03]",
                      selectedTaskId === task.id && "border-primary/40 bg-primary/[0.05]"
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={task.id} className="rounded-2xl border border-border/60 bg-background px-3 py-3">
                    {content}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              Sin fecha comprometida para este día.
            </div>
          )}
        </div>
      </div>
    </TaskShellPanel>
  )
}
