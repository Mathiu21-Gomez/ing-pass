"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  LabelList,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AnimatedCounter } from "@/components/animated-counter"
import { dashboardApi, projectsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { DashboardKPIs, Project, TimeEntryEnriched, User } from "@/lib/types"
import { Users, Clock, FolderKanban, TrendingUp, ListChecks, CheckCircle2, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import React, { useCallback, useMemo, useState } from "react"

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  trabajando: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", label: "Trabajando" },
  colacion: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", label: "En Colación" },
  pausado: { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", label: "Pausado" },
  finalizado: { bg: "bg-muted", text: "text-muted-foreground", label: "Finalizado" },
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:           { label: "Pendiente",          color: "hsl(215, 16%, 47%)" },
  en_curso:            { label: "En Curso",            color: "hsl(221, 83%, 53%)" },
  esperando_info:      { label: "Esperando Info",      color: "hsl(43, 96%, 56%)" },
  bloqueado:           { label: "Bloqueado",           color: "hsl(0, 84%, 60%)" },
  listo_para_revision: { label: "Para Revisión",       color: "hsl(270, 60%, 55%)" },
  finalizado:          { label: "Finalizado",          color: "hsl(142, 71%, 45%)" },
  retrasado:           { label: "Retrasado",           color: "hsl(25, 95%, 53%)" },
}

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(35, 92%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(270, 60%, 55%)",
]

const DATE_RANGES = [
  { value: "all", label: "Todo el tiempo" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
  { value: "quarter", label: "Último trimestre" },
]

const emptyKpis: DashboardKPIs = {
  taskStatusBreakdown: [],
  tasksByProject: [],
  coordinatorTasks: 0,
  userCreatedTasks: 0,
  totalTasks: 0,
  totalActivities: 0,
  completedActivities: 0,
  progressByUser: [],
  hoursByProject: [],
  hoursByWorker: [],
  activeWorkersToday: [],
  weeklyTrend: [],
  totalProjects: 0,
  activeProjects: 0,
  totalWorkers: 0,
}

export default function AdminDashboard() {
  const [filterWorkerId, setFilterWorkerId] = useState("all")
  const [filterCoordinatorId, setFilterCoordinatorId] = useState("all")
  const [filterProjectId, setFilterProjectId] = useState("all")
  const [dateRange, setDateRange] = useState("all")

  const fetchProjects = useCallback(() => projectsApi.getAll(), [])
  const fetchUsers = useCallback(() => usersApi.getAll(), [])
  const { data: allProjects } = useApiData(fetchProjects, [] as Project[])
  const { data: allUsers } = useApiData(fetchUsers, [] as User[])

  const workers = useMemo(() => allUsers.filter((u) => u.role === "trabajador" && u.active), [allUsers])
  const coordinators = useMemo(() => allUsers.filter((u) => u.role === "coordinador"), [allUsers])

  const fetchKpis = useCallback(() => {
    const params = new URLSearchParams()
    if (filterWorkerId !== "all") params.set("workerId", filterWorkerId)
    if (filterCoordinatorId !== "all") params.set("coordinatorId", filterCoordinatorId)
    if (filterProjectId !== "all") params.set("projectId", filterProjectId)
    if (dateRange !== "all") params.set("dateRange", dateRange)
    return fetch(`/api/dashboard/kpis?${params}`).then((r) => r.json())
  }, [filterWorkerId, filterCoordinatorId, filterProjectId, dateRange])

  const { data: kpiData } = useApiData(fetchKpis, emptyKpis)

  const hoursByProject = kpiData.hoursByProject
  const hoursByWorker = kpiData.hoursByWorker
  const activeToday = kpiData.activeWorkersToday ?? []
  const kpi = kpiData

  const totalHoursToday = activeToday.reduce((acc: number, e: TimeEntryEnriched) => acc + (e.effectiveHours ?? 0), 0)
  const finishedEntries = activeToday.filter((e: TimeEntryEnriched) => e.status === "finalizado")
  const avgCompliance = Math.round(
    (activeToday.filter((e: TimeEntryEnriched) => e.effectiveHours >= 7.5).length /
      Math.max(finishedEntries.length, 1)) * 100
  )

  const kpis = [
    {
      label: "Trabajadores Activos",
      value: kpiData.totalWorkers,
      numericValue: kpiData.totalWorkers,
      icon: Users,
      detail: `${activeToday.filter((w: TimeEntryEnriched) => w.status === "trabajando").length} conectados ahora`,
    },
    {
      label: "Horas Hoy",
      value: `${totalHoursToday.toFixed(1)}h`,
      numericValue: Math.round(totalHoursToday * 10) / 10,
      suffix: "h",
      icon: Clock,
      detail: `${activeToday.length} jornadas registradas`,
    },
    {
      label: "Proyectos Activos",
      value: kpiData.activeProjects,
      numericValue: kpiData.activeProjects,
      icon: FolderKanban,
      detail: `${kpiData.totalProjects} totales`,
    },
    {
      label: "Cumplimiento",
      value: `${avgCompliance}%`,
      numericValue: avgCompliance,
      suffix: "%",
      icon: TrendingUp,
      detail: "Jornadas de 8h completadas",
    },
  ]

  // Format status breakdown for bar chart
  const statusChartData = (kpiData.taskStatusBreakdown ?? []).map((s: { status: string; count: number }) => ({
    status: TASK_STATUS_CONFIG[s.status]?.label ?? s.status,
    count: s.count,
    fill: TASK_STATUS_CONFIG[s.status]?.color ?? "#888",
  }))

  const hasFilters = filterWorkerId !== "all" || filterCoordinatorId !== "all" || filterProjectId !== "all" || dateRange !== "all"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen general de la operación
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

          <Select value={filterWorkerId} onValueChange={setFilterWorkerId}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Trabajador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los trabajadores</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name.split(" ").slice(0, 2).join(" ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCoordinatorId} onValueChange={setFilterCoordinatorId}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Coordinador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los coordinadores</SelectItem>
              {coordinators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name.split(" ").slice(0, 2).join(" ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProjectId} onValueChange={setFilterProjectId}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name.split(" ").slice(0, 3).join(" ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={() => {
                setFilterWorkerId("all")
                setFilterCoordinatorId("all")
                setFilterProjectId("all")
                setDateRange("all")
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="card-hover overflow-hidden">
            <CardContent className="relative p-5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary/0" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {kpi.label}
                  </p>
                  <AnimatedCounter
                    value={kpi.numericValue}
                    suffix={kpi.suffix ?? ""}
                    className="mt-2 text-3xl font-bold tracking-tight text-foreground number-pop"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
                </div>
                <div className="rounded-xl bg-primary/8 p-3">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task status breakdown */}
      {statusChartData.length > 0 && (
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Distribución de Tareas por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(
                statusChartData.map((s: { status: string; count: number; fill: string }) => [s.status, { label: s.status, color: s.fill }])
              )}
              className="h-[200px]"
            >
              <BarChart data={statusChartData} margin={{ top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                  width={30}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusChartData.map((entry: { status: string; count: number; fill: string }, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={11} fill="hsl(var(--foreground))" />
                </Bar>
              </BarChart>
            </ChartContainer>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 justify-center">
              {statusChartData.map((s: { status: string; count: number; fill: string }) => (
                <div key={s.status} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                  <span className="text-xs text-muted-foreground">{s.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hours by Worker */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas por Trabajador {dateRange !== "all" ? `(${DATE_RANGES.find((r) => r.value === dateRange)?.label})` : "(Total)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ hours: { label: "Horas", color: CHART_COLORS[0] } }}
              className="h-[280px]"
            >
              <BarChart data={hoursByWorker} layout="vertical" margin={{ left: -15 }}>
                <YAxis
                  type="category"
                  dataKey="worker"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={90}
                />
                <XAxis type="number" tickLine={false} tickMargin={10} axisLine={false} hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="hours"
                  fill={CHART_COLORS[0]}
                  radius={4}
                  barSize={14}
                  shape={<CustomGlowingBar />}
                  background={{ fill: "hsl(var(--muted)/0.3)", radius: 4 }}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hours by Project (Pie) */}
        <Card className="card-hover flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribución de Horas por Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={Object.fromEntries(
                hoursByProject.map((p: { project: string; hours: number }, i: number) => [p.project, { label: p.project, color: CHART_COLORS[i % CHART_COLORS.length] }])
              )}
              className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="project" hideLabel />} />
                <Pie
                  data={hoursByProject}
                  dataKey="hours"
                  nameKey="project"
                  innerRadius={30}
                  cornerRadius={8}
                  paddingAngle={4}
                >
                  {hoursByProject.map((_: { project: string; hours: number }, i: number) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="hours"
                    stroke="none"
                    fontSize={12}
                    fontWeight={500}
                    fill="currentColor"
                    formatter={(value: number) => `${value}h`}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-3 justify-center pb-4">
              {hoursByProject.map((p: { project: string; hours: number }, i: number) => (
                <div key={p.project} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{p.project.split(" ").slice(0, 2).join(" ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend + Active Workers */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tendencia Semanal (Total Horas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ hours: { label: "Horas", color: CHART_COLORS[1] } }}
              className="h-[260px]"
            >
              <LineChart data={kpiData.weeklyTrend} margin={{ left: 12, right: 12, top: 30, bottom: 10 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Line
                  dataKey="hours"
                  type="linear"
                  stroke={CHART_COLORS[1]}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={<PingingDot />}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trabajadores Activos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeToday.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No hay trabajadores activos hoy
                    </TableCell>
                  </TableRow>
                ) : (
                  activeToday.map((entry: TimeEntryEnriched) => {
                    const sc = statusColors[entry.status] ?? statusColors.finalizado
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{entry.userName.split(" ").slice(0, 2).join(" ")}</p>
                          <p className="text-xs text-muted-foreground">{entry.userPosition}</p>
                        </TableCell>
                        <TableCell className="text-sm">{entry.projectName.split(" ").slice(0, 2).join(" ")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.taskName}</TableCell>
                        <TableCell className="font-mono text-sm font-medium">{entry.effectiveHours}h</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", sc.bg, sc.text, entry.status === "trabajando" && "status-dot-live")}>
                            {sc.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total Trabajadores Activos</TableCell>
                  <TableCell className="font-medium">{activeToday.length}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Task completion + Origin */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Cumplimiento de Tareas por Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {kpi.tasksByProject.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
              ) : (
                kpi.tasksByProject.map((p: DashboardKPIs["tasksByProject"][number]) => (
                  <div key={p.projectId}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium truncate">{p.projectName}</p>
                      <span className="text-xs text-muted-foreground">{p.closedTasks}/{p.totalTasks}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", p.completionRate === 100 ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${p.completionRate}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Origen de Tareas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-primary/5 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-primary">{kpi.coordinatorTasks}</p>
                  <p className="text-xs text-muted-foreground">Por Coordinador</p>
                </div>
                <div className="rounded-lg border border-border bg-amber-500/5 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{kpi.userCreatedTasks}</p>
                  <p className="text-xs text-muted-foreground">Por Usuarios</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Actividades completadas</span>
                  <span className="font-medium text-foreground">{kpi.completedActivities}/{kpi.totalActivities}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${kpi.totalActivities > 0 ? Math.round((kpi.completedActivities / kpi.totalActivities) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const CustomGlowingBar = (
  props: React.SVGProps<SVGRectElement> & { dataKey?: string; glowOpacity?: number }
) => {
  const { fill, x, y, width, height, radius } = props
  return (
    <>
      <rect x={x} y={y} rx={typeof radius === "number" ? radius : 4} width={width} height={height} stroke="none" fill={fill} filter="url(#glow-chart-hours)" />
      <defs>
        <filter id="glow-chart-hours" x="-200%" y="-200%" width="600%" height="600%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </>
  )
}

const PingingDot = (props: React.SVGProps<SVGCircleElement>) => {
  const { cx, cy, stroke } = props
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={stroke} />
      <circle cx={cx} cy={cy} r={4} stroke={stroke} fill="none" strokeWidth="1" opacity="0.8">
        <animate attributeName="r" values="4;12" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  )
}
