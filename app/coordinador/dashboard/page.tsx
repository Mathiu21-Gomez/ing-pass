"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { projectsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, User } from "@/lib/types"
import { useAuth } from "@/lib/contexts/auth-context"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    LabelList,
} from "recharts"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { FolderKanban, CheckCircle2, Users, TrendingUp, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback, useMemo } from "react"

const PIE_COLORS = ["hsl(221, 83%, 53%)", "hsl(35, 92%, 55%)"]

export default function CoordinadorDashboard() {
    const { user } = useAuth()

    const fetchProjects = useCallback(() => projectsApi.getAll(), [])
    const fetchUsers = useCallback(() => usersApi.getAll(), [])
    const { data: allProjects } = useApiData(fetchProjects, [] as Project[])
    const { data: allUsers } = useApiData(fetchUsers, [] as User[])

    // Only projects assigned to this coordinator
    const myProjects = useMemo(() => allProjects.filter((p) => p.coordinatorId === user?.id), [allProjects, user])

    // Summary stats
    const allMyTasks = myProjects.flatMap((p) => p.tasks)
    const totalTasks = allMyTasks.length
    const closedTasks = allMyTasks.filter((t) => t.status === "finalizado").length
    const pendingTasks = allMyTasks.filter((t) => t.status === "listo_para_revision").length
    const openTasks = allMyTasks.filter((t) => t.status === "pendiente" || t.status === "en_curso").length
    const totalWorkers = [...new Set(myProjects.flatMap((p) => p.assignedWorkers))].length

    // Chart data
    const taskByProjectData = myProjects.map((p) => ({
        name: p.name.split(" ").slice(0, 2).join(" "),
        completadas: p.tasks.filter((t) => t.status === "finalizado").length,
        abiertas: p.tasks.filter((t) => t.status !== "finalizado").length,
    }))

    // Pie chart: tasks created by coordinator vs created by users (only this coordinator's projects)
    const myCoordinatorTasks = allMyTasks.filter((t) => t.createdBy === user?.id).length
    const myUserCreatedTasks = allMyTasks.filter((t) => t.createdBy !== user?.id).length
    const pieData = [
        { name: "Coordinador", value: myCoordinatorTasks },
        { name: "Usuarios", value: myUserCreatedTasks },
    ]

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Dashboard Coordinador
                </h1>
                <p className="text-sm text-muted-foreground">
                    Bienvenido, {user?.name?.split(" ")[0]}. Tienes {myProjects.length} proyectos y {pendingTasks > 0 ? `${pendingTasks} tarea${pendingTasks > 1 ? 's' : ''} lista${pendingTasks > 1 ? 's' : ''} para revisión` : `${openTasks} tarea${openTasks !== 1 ? 's' : ''} en curso`}.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger-children">
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Proyectos</p>
                                <p className="text-2xl font-bold mt-1">{myProjects.length}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FolderKanban className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Tareas Finalizadas</p>
                                <p className="text-2xl font-bold mt-1 text-emerald-600">{closedTasks}/{totalTasks}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Usuarios Activos</p>
                                <p className="text-2xl font-bold mt-1">{totalWorkers}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Actividades</p>
                                <p className="text-2xl font-bold mt-1">
                                    {allMyTasks.flatMap(t => t.activities).filter(a => a.completed).length}/{allMyTasks.flatMap(t => t.activities).length}
                                </p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <ListChecks className="h-5 w-5 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Cumplimiento por Proyecto */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Cumplimiento de Tareas por Proyecto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{ completadas: { label: "Completadas", color: "hsl(160, 60%, 45%)" }, abiertas: { label: "Abiertas", color: "hsl(221, 83%, 53%)" } }} className="h-[200px] w-full">
                            <BarChart data={taskByProjectData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="completadas" fill="hsl(160, 60%, 45%)" stackId="a" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="abiertas" fill="hsl(221, 83%, 53%)" stackId="a" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Tareas Originales vs Creadas */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Tareas Originales vs Creadas por Usuarios</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <ChartContainer config={{ coordinador: { label: "Coordinador", color: PIE_COLORS[0] }, usuarios: { label: "Usuarios", color: PIE_COLORS[1] } }} className="h-[200px] w-full">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i]} />
                                    ))}
                                    <LabelList dataKey="name" position="outside" className="text-xs fill-foreground" offset={12} />
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Avance por Usuario */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Avance por Usuario
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-3">
                        {(() => {
                            const workerIds = [...new Set(myProjects.flatMap(p => p.assignedWorkers))]
                            return workerIds.map((wid) => {
                                const wu = allUsers.find(u => u.id === wid)
                                if (!wu) return null
                                const workerTasks = allMyTasks.filter(t => t.assignedTo.includes(wid))
                                const closed = workerTasks.filter(t => t.status === "finalizado").length
                                const total = workerTasks.length
                                const rate = total > 0 ? Math.round((closed / total) * 100) : 0
                                return (
                                    <div key={wid} className="flex items-center gap-4">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                                            {wu.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-medium text-foreground truncate">{wu.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] h-5">
                                                        {closed}/{total} tareas
                                                    </Badge>
                                                    <span className={cn(
                                                        "text-xs font-semibold",
                                                        rate >= 70 ? "text-emerald-500" : rate >= 40 ? "text-amber-500" : "text-muted-foreground"
                                                    )}>
                                                        {rate}%
                                                    </span>
                                                </div>
                                            </div>
                                            <Progress value={rate} className="h-1.5" />
                                        </div>
                                    </div>
                                )
                            }).filter(Boolean)
                        })()}
                    </div>
                </CardContent>
            </Card>
        </div >
    )
}
