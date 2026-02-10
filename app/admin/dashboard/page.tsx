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
import React from "react"

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
        {/* Hours by Worker - Glowing Bar Chart */}
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
              }}
              className="h-[280px]"
            >
              <BarChart
                accessibilityLayer
                data={hoursByWorker}
                layout="vertical"
                margin={{ left: -15 }}
              >
                <YAxis
                  type="category"
                  dataKey="worker"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={90}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  hide
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
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

        {/* Hours by Project (Rounded Pie) */}
        <Card className="card-hover flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribución de Horas por Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={Object.fromEntries(
                hoursByProject.map((p, i) => [
                  p.project,
                  { label: p.project, color: CHART_COLORS[i % CHART_COLORS.length] },
                ])
              )}
              className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="project" hideLabel />}
                />
                <Pie
                  data={hoursByProject}
                  dataKey="hours"
                  nameKey="project"
                  innerRadius={30}
                  cornerRadius={8}
                  paddingAngle={4}
                >
                  {hoursByProject.map((_, i) => (
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
        {/* Weekly Trend - Pinging Dot Chart */}
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
              className="h-[260px]"
            >
              <LineChart
                accessibilityLayer
                data={weeklyTrend}
                margin={{ left: 12, right: 12, top: 30, bottom: 10 }}
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  hide
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
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
    </div>
  )
}

// Custom glowing bar component for chart
const CustomGlowingBar = (
  props: React.SVGProps<SVGRectElement> & {
    dataKey?: string;
    glowOpacity?: number;
  }
) => {
  const { fill, x, y, width, height, radius } = props;

  return (
    <>
      <rect
        x={x}
        y={y}
        rx={typeof radius === "number" ? radius : 4}
        width={width}
        height={height}
        stroke="none"
        fill={fill}
        filter="url(#glow-chart-hours)"
      />
      <defs>
        <filter
          id="glow-chart-hours"
          x="-200%"
          y="-200%"
          width="600%"
          height="600%"
        >
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </>
  );
};

// Pinging dot component for line chart
const PingingDot = (props: React.SVGProps<SVGCircleElement>) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Main dot */}
      <circle cx={cx} cy={cy} r={4} fill={stroke} />
      {/* Ping animation circles */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        stroke={stroke}
        fill="none"
        strokeWidth="1"
        opacity="0.8"
      >
        <animate
          attributeName="r"
          values="4;12"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};
