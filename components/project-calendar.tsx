"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isToday,
  startOfDay,
  startOfMonth,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  Loader2,
  Users,
} from "lucide-react"

import { projectsApi, clientsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, Client, User } from "@/lib/types"
import { TaskShellHeader, TaskShellPanel } from "@/components/task-shell"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { getProjectCoordinatorIds } from "@/lib/project-membership"

// ── Helpers ───────────────────────────────────────────────────────────

function toDayKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function getSafeDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : startOfDay(d)
}

function getDateLabel(date: Date) {
  if (isToday(date)) return "Hoy"
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Activo: { label: "Activo", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  Pausado: { label: "Pausado", className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  Finalizado: { label: "Finalizado", className: "border-border bg-muted text-muted-foreground" },
}

// ── Types ─────────────────────────────────────────────────────────────

type CalendarEntry = {
  project: Project
  type: "start" | "end"
  date: Date
}

type DayEntries = {
  starts: Project[]
  ends: Project[]
}

// ── Sub-components ────────────────────────────────────────────────────

function ProjectCard({
  project,
  clients,
  users,
  type,
  basePath,
}: {
  project: Project
  clients: Client[]
  users: User[]
  type: "start" | "end"
  basePath: string
}) {
  const router = useRouter()
  const client = clients.find((c) => c.id === project.clientId)
  const coordinatorIds = getProjectCoordinatorIds(project)
  const coordinators = users.filter((u) => coordinatorIds.includes(u.id))
  const workers = users.filter((u) => project.assignedWorkers.includes(u.id))
  const tasks = project.tasks ?? []
  const finalizadas = tasks.filter((t) => t.status === "finalizado").length
  const autoProgress = tasks.length > 0 ? Math.round((finalizadas / tasks.length) * 100) : null
  const progress = autoProgress ?? (project.progress ?? 0)
  const isOverdue = project.status !== "Finalizado" && isBefore(new Date(project.endDate), new Date())
  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.Activo

  function handleClick() {
    router.push(`${basePath}/tareas`)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group w-full rounded-2xl border border-border/60 bg-card/90 px-4 py-4 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-md"
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full shrink-0",
                type === "start" ? "bg-primary" : isOverdue ? "bg-red-500" : "bg-emerald-500"
              )}
            />
            <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] rounded-full", statusCfg.className)}>
              {statusCfg.label}
            </Badge>
            {isOverdue && project.status !== "Finalizado" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200/70 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                Vencido
              </span>
            ) : null}
            <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              {project.stage}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary/60" />
      </div>

      {/* Description */}
      {project.description ? (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{project.description}</p>
      ) : null}

      {/* Dates row */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3 shrink-0 text-primary/60" />
          <span>Inicio: {format(new Date(project.startDate), "d MMM yyyy", { locale: es })}</span>
        </div>
        <div className={cn("flex items-center gap-1.5", isOverdue && project.status !== "Finalizado" && "text-red-500 dark:text-red-400")}>
          <CalendarCheck2 className="h-3 w-3 shrink-0" />
          <span>Entrega: {format(new Date(project.endDate), "d MMM yyyy", { locale: es })}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Avance {autoProgress !== null ? <span className="opacity-50">(auto)</span> : null}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Client */}
      {client ? (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{client.name}</span>
        </div>
      ) : null}

      {/* People */}
      <div className="flex items-center gap-2">
        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
        <div className="flex -space-x-1.5">
          {[...coordinators, ...workers].slice(0, 5).map((u) => (
            <div
              key={u.id}
              title={`${u.name} (${u.role === "coordinador" ? "Coord." : "Colab."})`}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white",
                u.role === "coordinador" ? "bg-amber-500" : "bg-primary"
              )}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {coordinators.length + workers.length > 5 ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium text-muted-foreground">
              +{coordinators.length + workers.length - 5}
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {coordinators.length} coord. · {workers.length} colab.
        </span>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────

interface ProjectCalendarProps {
  basePath: string
  title?: string
  description?: string
}

export function ProjectCalendar({
  basePath,
  title = "Calendario",
  description = "Vista mensual de proyectos con fechas de inicio y entrega. Seleccioná un día para ver el detalle.",
}: ProjectCalendarProps) {
  const fetchProjects = useCallback(() => projectsApi.getAll(), [])
  const fetchClients = useCallback(() => clientsApi.getAll(), [])
  const fetchUsers = useCallback(() => usersApi.getAll(), [])

  const { data: projects, loading: loadingProjects } = useApiData(fetchProjects, [] as Project[])
  const { data: clients } = useApiData(fetchClients, [] as Client[])
  const { data: users } = useApiData(fetchUsers, [] as User[])

  const today = useMemo(() => startOfDay(new Date()), [])

  // ── Build calendar entries ──
  const allEntries = useMemo((): CalendarEntry[] => {
    const entries: CalendarEntry[] = []
    for (const project of projects) {
      const startDate = getSafeDate(project.startDate)
      const endDate = getSafeDate(project.endDate)
      if (startDate) entries.push({ project, type: "start", date: startDate })
      if (endDate) entries.push({ project, type: "end", date: endDate })
    }
    return entries
  }, [projects])

  // ── Group entries by day key ──
  const entriesByDay = useMemo(() => {
    const map = new Map<string, DayEntries>()
    for (const entry of allEntries) {
      const key = toDayKey(entry.date)
      const existing = map.get(key) ?? { starts: [], ends: [] }
      if (entry.type === "start") existing.starts.push(entry.project)
      else existing.ends.push(entry.project)
      map.set(key, existing)
    }
    return map
  }, [allEntries])

  // ── Modifiers for calendar ──
  const startDates = useMemo(() => allEntries.filter((e) => e.type === "start").map((e) => e.date), [allEntries])
  const endDates = useMemo(() => allEntries.filter((e) => e.type === "end").map((e) => e.date), [allEntries])

  // ── Calendar state ──
  const upcomingDate = useMemo(() => {
    const upcoming = allEntries
      .filter((e) => e.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    return upcoming?.date ?? today
  }, [allEntries, today])

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(upcomingDate)
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [month, setMonth] = useState<Date>(startOfMonth(upcomingDate))

  useEffect(() => {
    setSelectedDate((prev) => prev ?? upcomingDate)
    setMonth(startOfMonth(upcomingDate))
  }, [upcomingDate])

  const focusDate = hoveredDate ?? selectedDate ?? today
  const focusKey = toDayKey(focusDate)
  const focusEntries = entriesByDay.get(focusKey) ?? { starts: [], ends: [] }
  const totalFocusCount = focusEntries.starts.length + focusEntries.ends.length

  // ── Stats ──
  const activeCount = projects.filter((p) => p.status === "Activo").length
  const monthEnd = endOfMonth(new Date())
  const finishingThisMonth = projects.filter(
    (p) => p.status === "Activo" && !isAfter(new Date(p.endDate), monthEnd) && !isBefore(new Date(p.endDate), today)
  ).length
  const overdueCount = projects.filter(
    (p) => p.status !== "Finalizado" && isBefore(new Date(p.endDate), today)
  ).length

  if (loadingProjects) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="page-enter space-y-5">
      <TaskShellHeader
        eyebrow="Planificación"
        title={title}
        description={description}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card-accent rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{projects.length}</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Total</p>
        </div>
        <div className="stat-card-accent rounded-2xl border border-emerald-200/70 bg-card/95 p-4 shadow-sm dark:border-emerald-900/60">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-2">
              <CalendarDays className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{activeCount}</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Activos</p>
        </div>
        <div className="stat-card-accent rounded-2xl border border-amber-200/70 bg-card/95 p-4 shadow-sm dark:border-amber-900/60">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{finishingThisMonth}</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Cierran este mes</p>
        </div>
        <div className={cn(
          "stat-card-accent rounded-2xl border bg-card/95 p-4 shadow-sm",
          overdueCount > 0 ? "border-red-200/70 dark:border-red-900/60" : "border-border/70"
        )}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-2">
              <AlertTriangle className={cn("h-4 w-4", overdueCount > 0 ? "text-red-500" : "text-muted-foreground")} />
            </div>
            <span className={cn("text-2xl font-semibold tracking-tight", overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              {overdueCount}
            </span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Vencidos</p>
        </div>
      </div>

      {/* Calendar + detail side by side on large screens */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Calendar panel */}
        <TaskShellPanel title="Mapa mensual de proyectos" description="Puntos azules indican inicio, puntos naranjas indican entrega.">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90 p-2 shadow-sm">
            <Calendar
              mode="single"
              locale={es}
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date ?? today)}
              month={month}
              onMonthChange={setMonth}
              modifiers={{ starts: startDates, ends: endDates }}
              modifiersClassNames={{
                starts: "font-semibold",
                ends: "font-semibold",
              }}
              onDayMouseEnter={(date) => setHoveredDate(startOfDay(date))}
              onDayMouseLeave={() => setHoveredDate(null)}
              className="mx-auto w-full p-1"
              classNames={{
                months: "flex w-full flex-col",
                month: "w-full space-y-4",
                table: "w-full border-collapse",
                head_cell: "w-full rounded-md text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70",
                row: "mt-2 grid grid-cols-7",
                cell: "relative h-12 p-0 text-center text-sm",
                day: "h-12 w-full rounded-xl p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground",
                day_today: "border border-primary/30 bg-primary/10 text-primary",
              }}
              components={{
                DayContent: ({ date }) => {
                  const key = toDayKey(startOfDay(date))
                  const dayEntries = entriesByDay.get(key)
                  const hasStarts = (dayEntries?.starts.length ?? 0) > 0
                  const hasEnds = (dayEntries?.ends.length ?? 0) > 0

                  return (
                    <div className="relative flex h-12 w-full flex-col items-center justify-center gap-0.5">
                      <span>{date.getDate()}</span>
                      {(hasStarts || hasEnds) ? (
                        <div className="flex items-center gap-0.5">
                          {hasStarts ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Inicio de proyecto" />
                          ) : null}
                          {hasEnds ? (
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                dayEntries!.ends.some(
                                  (p) => p.status !== "Finalizado" && isBefore(new Date(p.endDate), today)
                                )
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                              )}
                              title="Entrega de proyecto"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                },
              }}
            />
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Inicio de proyecto
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Fecha de entrega
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Entrega vencida
            </div>
          </div>
        </TaskShellPanel>

        {/* Day detail panel */}
        <TaskShellPanel
          title={hoveredDate ? "Vista rápida" : "Fecha seleccionada"}
          description={
            <span className="capitalize">{getDateLabel(focusDate)}</span>
          }
          actions={
            <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {totalFocusCount} evento{totalFocusCount === 1 ? "" : "s"}
            </span>
          }
        >
          <div className="space-y-4">
            {focusEntries.starts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Arrancan en esta fecha
                </div>
                {focusEntries.starts.map((project) => (
                  <ProjectCard
                    key={`start-${project.id}`}
                    project={project}
                    clients={clients}
                    users={users}
                    type="start"
                    basePath={basePath}
                  />
                ))}
              </div>
            ) : null}

            {focusEntries.ends.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Cierran en esta fecha
                </div>
                {focusEntries.ends.map((project) => (
                  <ProjectCard
                    key={`end-${project.id}`}
                    project={project}
                    clients={clients}
                    users={users}
                    type="end"
                    basePath={basePath}
                  />
                ))}
              </div>
            ) : null}

            {totalFocusCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-6 w-6 opacity-30" />
                Sin proyectos en esta fecha.
              </div>
            ) : null}
          </div>
        </TaskShellPanel>
      </div>
    </div>
  )
}
