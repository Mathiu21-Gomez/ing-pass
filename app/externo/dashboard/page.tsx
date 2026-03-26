"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import { projectsApi, clientsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, Client, User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    FolderKanban,
    CheckCircle2,
    Clock,
    Users,
    FileText,
    ExternalLink,
    Circle,
    AlertCircle,
    TrendingUp,
    Calendar,
    Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback, useMemo } from "react"

const statusConfig: Record<string, { className: string; label: string }> = {
    Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", label: "Activo" },
    Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Pausado" },
    Finalizado: { className: "bg-muted text-muted-foreground border-border", label: "Finalizado" },
}

const taskStatusConfig: Record<string, { label: string; className: string }> = {
    pendiente: { label: "Abierta", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
    finalizado: { label: "Cerrada", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    listo_para_revision: { label: "Pendiente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
}

export default function ExternoDashboardPage() {
    const { user } = useAuth()

    const fetchProjects = useCallback(() => projectsApi.getAll(), [])
    const fetchClients = useCallback(() => clientsApi.getAll(), [])
    const fetchUsers = useCallback(() => usersApi.getAll(), [])
    const { data: allProjects } = useApiData(fetchProjects, [] as Project[])
    const { data: allClients } = useApiData(fetchClients, [] as Client[])
    const { data: allUsers } = useApiData(fetchUsers, [] as User[])

    const client = useMemo(() => allClients.find((c) => c.email === user?.email), [allClients, user])
    const clientProjects = useMemo(() => client
        ? allProjects.filter((p) => p.clientId === client.id)
        : allProjects.filter((p) => p.assignedWorkers.includes(user?.id ?? "")), [client, allProjects, user])

    // Global KPIs
    const totalTasks = clientProjects.reduce((sum, p) => sum + p.tasks.length, 0)
    const closedTasks = clientProjects.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "finalizado").length, 0)
    const totalActivities = clientProjects.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.activities.length, 0), 0)
    const completedActivities = clientProjects.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.activities.filter((a) => a.completed).length, 0), 0)
    const globalProgress = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0
    const activeProjects = clientProjects.filter((p) => p.status === "Activo").length

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Resumen de avance de tus proyectos, {user?.name?.split(" ")[0]}.
                </p>
            </div>

            {/* Global KPIs */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger-children">
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Proyectos Activos</p>
                                <p className="text-2xl font-bold mt-1">{activeProjects}</p>
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
                                <p className="text-xs text-muted-foreground">Avance General</p>
                                <p className="text-2xl font-bold mt-1">{globalProgress}%</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Tareas Completadas</p>
                                <p className="text-2xl font-bold mt-1">{closedTasks}/{totalTasks}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Actividades</p>
                                <p className="text-2xl font-bold mt-1">{completedActivities}/{totalActivities}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Layers className="h-5 w-5 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Per-project detail */}
            {clientProjects.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No tienes proyectos asignados</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-5 stagger-children">
                    {clientProjects.map((project) => {
                        const coordinator = allUsers.find((u) => u.id === project.coordinatorId)
                        const workers = project.assignedWorkers.map((wId) => allUsers.find((u) => u.id === wId)).filter(Boolean)
                        const pTotalAct = project.tasks.reduce((s, t) => s + t.activities.length, 0)
                        const pCompAct = project.tasks.reduce((s, t) => s + t.activities.filter((a) => a.completed).length, 0)
                        const pProgress = pTotalAct > 0 ? Math.round((pCompAct / pTotalAct) * 100) : 0
                        const pClosedTasks = project.tasks.filter((t) => t.status === "finalizado").length
                        const pPendingTasks = project.tasks.filter((t) => t.status === "listo_para_revision").length

                        const start = new Date(project.startDate)
                        const end = new Date(project.endDate)
                        const now = new Date()
                        const timeProgress = project.status === "Finalizado"
                            ? 100
                            : Math.min(Math.max(Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100), 0), 100)

                        return (
                            <Card key={project.id} className="card-hover overflow-hidden">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <CardTitle className="text-lg">{project.name}</CardTitle>
                                            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                                        </div>
                                        <Badge variant="outline" className={cn("shrink-0 text-xs", statusConfig[project.status]?.className)}>
                                            {project.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-5">
                                    {/* Info grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Layers className="h-3 w-3 text-muted-foreground" />
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Etapa</p>
                                            </div>
                                            <p className="text-sm font-medium">{project.stage}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Users className="h-3 w-3 text-muted-foreground" />
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coordinador</p>
                                            </div>
                                            <p className="text-sm font-medium">{coordinator?.name?.split(" ").slice(0, 2).join(" ") ?? "—"}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Periodo</p>
                                            </div>
                                            <p className="text-sm font-medium">
                                                {start.toLocaleDateString("es-CL", { month: "short", year: "numeric" })} – {end.toLocaleDateString("es-CL", { month: "short", year: "numeric" })}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Users className="h-3 w-3 text-muted-foreground" />
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Equipo</p>
                                            </div>
                                            <p className="text-sm font-medium">{workers.length} personas</p>
                                        </div>
                                    </div>

                                    {/* Progress bars */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-muted-foreground">Avance de actividades</span>
                                                <span className={cn("text-xs font-bold", pProgress === 100 ? "text-emerald-500" : "text-primary")}>{pProgress}%</span>
                                            </div>
                                            <Progress value={pProgress} className="h-2.5" />
                                            <p className="text-[10px] text-muted-foreground mt-1">{pCompAct} de {pTotalAct} actividades completadas</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-muted-foreground">Avance temporal</span>
                                                <span className={cn("text-xs font-bold", timeProgress > 80 ? "text-amber-500" : "text-muted-foreground")}>{timeProgress}%</span>
                                            </div>
                                            <Progress value={timeProgress} className="h-2.5" />
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {timeProgress >= 100 ? "Plazo vencido" : `${Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} días restantes`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Team */}
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Equipo asignado</p>
                                        <div className="flex flex-wrap gap-2">
                                            {workers.map((w) => w && (
                                                <div key={w.id} className="flex items-center gap-2 rounded-full bg-muted/50 border border-border px-2.5 py-1">
                                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                                        {w.name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs text-foreground">{w.name.split(" ").slice(0, 2).join(" ")}</span>
                                                    <span className="text-[10px] text-muted-foreground">{w.position}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tasks summary */}
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Tareas ({pClosedTasks}/{project.tasks.length} completadas)
                                        </p>
                                        <div className="flex flex-col gap-1">
                                            {project.tasks.map((task) => {
                                                const tAct = task.activities.length
                                                const tComp = task.activities.filter((a) => a.completed).length
                                                const tProg = tAct > 0 ? Math.round((tComp / tAct) * 100) : 0
                                                return (
                                                    <div key={task.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                                                        {task.status === "finalizado" ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                                        ) : task.status === "listo_para_revision" ? (
                                                            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                                        ) : (
                                                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        )}
                                                        <span className={cn("text-sm flex-1 truncate", task.status === "finalizado" && "line-through text-muted-foreground")}>
                                                            {task.name}
                                                        </span>
                                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", taskStatusConfig[task.status]?.className)}>
                                                            {taskStatusConfig[task.status]?.label}
                                                        </Badge>
                                                        {tAct > 0 && (
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-[10px] text-muted-foreground">{tComp}/{tAct}</span>
                                                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full", tProg === 100 ? "bg-emerald-500" : "bg-primary")}
                                                                        style={{ width: `${tProg}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Documents */}
                                    {project.documents.length > 0 && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Documentos compartidos</p>
                                            <div className="flex flex-wrap gap-2">
                                                {project.documents.map((doc) => (
                                                    <div key={doc.id} className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-border px-2.5 py-1.5">
                                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="text-xs text-foreground">{doc.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{doc.sizeBytes}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* URLs */}
                                    {project.urls.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {project.urls.map((u, i) => (
                                                <a
                                                    key={i}
                                                    href={u.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    {u.label}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pending notice */}
                                    {pPendingTasks > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            {pPendingTasks} tarea{pPendingTasks > 1 ? "s" : ""} pendiente{pPendingTasks > 1 ? "s" : ""} de aprobación
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
