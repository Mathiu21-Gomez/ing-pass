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
  AreaChart,
  Area,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AnimatedCounter } from "@/components/animated-counter"
import {
  getHoursByProject,
  getHoursByWorker,
  getActiveWorkersToday,
  mockUsers,
  mockProjects,
  mockTimeEntries,
} from "@/lib/mock-data"
import { Users, Clock, FolderKanban, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  trabajando: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", label: "Trabajando" },
  colacion: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", label: "En Colación" },
  pausado: { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", label: "Pausado" },
  finalizado: { bg: "bg-muted", text: "text-muted-foreground", label: "Finalizado" },
}

// Compute colors in JS for Recharts
const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(35, 92%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(270, 60%, 55%)",
]

export default function AdminDashboard() {
  const hoursByProject = getHoursByProject()
  const hoursByWorker = getHoursByWorker()
  const activeToday = getActiveWorkersToday()

  const activeWorkers = mockUsers.filter((u) => u.role === "trabajador" && u.active).length
  const activeProjects = mockProjects.filter((p) => p.status === "Activo").length
  const totalHoursToday = activeToday.reduce((acc, e) => acc + e.effectiveHours, 0)
  const avgCompliance = Math.round(
    (mockTimeEntries.filter((e) => e.effectiveHours >= 7.5).length /
      Math.max(mockTimeEntries.filter((e) => e.status === "finalizado").length, 1)) *
    100
  )

  // Weekly trend data
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie"]
  const weeklyTrend = weekDays.map((day, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (4 - i))
    const dateStr = d.toISOString().split("T")[0]
    const entries = mockTimeEntries.filter((e) => e.date === dateStr)
    const totalHours = entries.reduce((acc, e) => acc + e.effectiveHours, 0)
    return { day, hours: Math.round(totalHours * 10) / 10 }
  })

  const kpis = [
    {
      label: "Trabajadores Activos",
      value: activeWorkers,
      numericValue: activeWorkers,
      icon: Users,
      detail: `${activeToday.filter((w) => w.status === "trabajando").length} conectados ahora`,
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
      value: activeProjects,
      numericValue: activeProjects,
      icon: FolderKanban,
      detail: `${mockProjects.length} totales`,
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general de la operación
        </p>
      </div>

      {/* KPI Cards con stagger animation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="card-hover overflow-hidden">
            <CardContent className="relative p-5">
              {/* Línea superior de acento corporativo */}
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

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hours by Worker */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas por Trabajador (Semanal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                hours: { label: "Horas", color: CHART_COLORS[0] },
                target: { label: "Meta", color: "hsl(var(--muted-foreground))" },
              }}
              className="h-[280px]"
            >
              <BarChart data={hoursByWorker} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="worker" type="category" width={90} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hours by Project (Pie) */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribución de Horas por Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(
                hoursByProject.map((p, i) => [
                  p.project,
                  { label: p.project, color: CHART_COLORS[i % CHART_COLORS.length] },
                ])
              )}
              className="h-[280px]"
            >
              <PieChart>
                <Pie
                  data={hoursByProject}
                  dataKey="hours"
                  nameKey="project"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={55}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {hoursByProject.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-3 justify-center">
              {hoursByProject.map((p, i) => (
                <div key={p.project} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">{p.project.split(" ").slice(0, 2).join(" ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend + Active Workers */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Trend */}
        <Card className="lg:col-span-1 card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tendencia Semanal (Total Horas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                hours: { label: "Horas", color: CHART_COLORS[1] },
              }}
              className="h-[200px]"
            >
              <AreaChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke={CHART_COLORS[1]}
                  fill={CHART_COLORS[1]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Active Workers Table */}
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
                {activeToday.map((entry) => {
                  const sc = statusColors[entry.status] ?? statusColors.finalizado
                  const isWorking = entry.status === "trabajando"
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.userName.split(" ").slice(0, 2).join(" ")}</p>
                          <p className="text-xs text-muted-foreground">{entry.userPosition}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{entry.projectName.split(" ").slice(0, 2).join(" ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.taskName}</TableCell>
                      <TableCell className="font-mono text-sm font-medium text-foreground">{entry.effectiveHours}h</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            sc.bg,
                            sc.text,
                            isWorking && "status-dot-live"
                          )}
                        >
                          {sc.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
