"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockUsers } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    CheckCircle2,
    Circle,
    AlertCircle,
    User,
    LayoutGrid,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import type { Task, TaskStatus } from "@/lib/types"

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
    abierta: { label: "Abiertas", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    pendiente_aprobacion: { label: "Pendientes", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    cerrada: { label: "Cerradas", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
}

export default function CoordinadorEquipoPage() {
    const { user } = useAuth()
    const [filterProject, setFilterProject] = useState<string>("all")
    const [viewMode, setViewMode] = useState<"team" | "status">("team")

    const myProjects = mockProjects.filter((p) => p.coordinatorId === user?.id)
    const projectsToShow = filterProject === "all" ? myProjects : myProjects.filter((p) => p.id === filterProject)

    // Get all tasks with project info
    const allTasks = projectsToShow.flatMap((p) =>
        p.tasks.map((t) => ({ ...t, _projectName: p.name }))
    )

    // Get unique workers across filtered projects
    const workerIds = [...new Set(projectsToShow.flatMap((p) => p.assignedWorkers))]
    const workers = workerIds
        .map((id) => mockUsers.find((u) => u.id === id))
        .filter(Boolean) as typeof mockUsers

    // Group tasks by worker
    function getTasksForWorker(workerId: string) {
        return allTasks.filter((t) => t.assignedTo.includes(workerId))
    }

    // Group tasks by status
    function getTasksByStatus(status: TaskStatus) {
        return allTasks.filter((t) => t.status === status)
    }

    function TaskCard({ task }: { task: Task & { _projectName: string } }) {
        const assigned = task.assignedTo.map((id) => mockUsers.find((u) => u.id === id)).filter(Boolean)
        const progress = task.activities.length > 0
            ? Math.round((task.activities.filter((a) => a.completed).length / task.activities.length) * 100)
            : -1

        return (
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-2">
                    {task.status === "cerrada" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : task.status === "pendiente_aprobacion" ? (
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                        <Circle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium leading-tight", task.status === "cerrada" && "line-through text-muted-foreground")}>
                            {task.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{task._projectName}</p>
                    </div>
                </div>

                {progress >= 0 && (
                    <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[9px] text-muted-foreground text-right mt-0.5">{progress}%</p>
                    </div>
                )}

                {/* Assigned avatars in status view */}
                {viewMode === "status" && assigned.length > 0 && (
                    <div className="flex -space-x-1.5 mt-2">
                        {assigned.slice(0, 3).map((u) => (
                            <div
                                key={u!.id}
                                className="h-5 w-5 rounded-full bg-primary/10 border border-background flex items-center justify-center text-[8px] font-bold text-primary"
                                title={u!.name}
                            >
                                {u!.name.charAt(0)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Panel por Equipo
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {allTasks.length} tareas · {workers.length} miembros del equipo
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-[200px] h-9">
                        <SelectValue placeholder="Proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los proyectos</SelectItem>
                        {myProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex rounded-lg border border-border overflow-hidden ml-auto">
                    <button
                        onClick={() => setViewMode("team")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                            viewMode === "team" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <User className="h-3.5 w-3.5" />
                        Por persona
                    </button>
                    <button
                        onClick={() => setViewMode("status")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                            viewMode === "status" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Por estado
                    </button>
                </div>
            </div>

            {/* ─── View: By Team Member ─── */}
            {viewMode === "team" && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workers.map((worker) => {
                        const workerTasks = getTasksForWorker(worker.id)
                        const openCount = workerTasks.filter((t) => t.status === "abierta").length
                        const closedCount = workerTasks.filter((t) => t.status === "cerrada").length
                        const pendingCount = workerTasks.filter((t) => t.status === "pendiente_aprobacion").length

                        return (
                            <Card key={worker.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                            {worker.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-sm">{worker.name}</CardTitle>
                                            <p className="text-[11px] text-muted-foreground">{worker.position}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        {openCount > 0 && (
                                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                                                {openCount} abiertas
                                            </Badge>
                                        )}
                                        {pendingCount > 0 && (
                                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                {pendingCount} pendientes
                                            </Badge>
                                        )}
                                        {closedCount > 0 && (
                                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                {closedCount} cerradas
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex flex-col gap-2">
                                        {workerTasks.length === 0 ? (
                                            <p className="text-xs text-muted-foreground/50 text-center py-4">Sin tareas asignadas</p>
                                        ) : (
                                            workerTasks.map((task) => <TaskCard key={task.id} task={task} />)
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}

                    {/* Unassigned tasks */}
                    {allTasks.filter((t) => t.assignedTo.length === 0).length > 0 && (
                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                                        ?
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm text-muted-foreground">Sin asignar</CardTitle>
                                        <p className="text-[11px] text-muted-foreground">Tareas sin usuario asignado</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex flex-col gap-2">
                                    {allTasks.filter((t) => t.assignedTo.length === 0).map((task) => (
                                        <TaskCard key={task.id} task={task} />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ─── View: By Status (Kanban columns) ─── */}
            {viewMode === "status" && (
                <div className="grid gap-4 md:grid-cols-3">
                    {(["abierta", "pendiente_aprobacion", "cerrada"] as TaskStatus[]).map((status) => {
                        const tasks = getTasksByStatus(status)
                        const cfg = statusConfig[status]

                        return (
                            <div key={status}>
                                <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 mb-3", cfg.bg)}>
                                    {status === "cerrada" && <CheckCircle2 className={cn("h-4 w-4", cfg.color)} />}
                                    {status === "abierta" && <Circle className={cn("h-4 w-4", cfg.color)} />}
                                    {status === "pendiente_aprobacion" && <AlertCircle className={cn("h-4 w-4", cfg.color)} />}
                                    <span className={cn("text-sm font-medium", cfg.color)}>{cfg.label}</span>
                                    <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                                        {tasks.length}
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {tasks.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-border p-6 text-center">
                                            <p className="text-xs text-muted-foreground/50">Sin tareas</p>
                                        </div>
                                    ) : (
                                        tasks.map((task) => <TaskCard key={task.id} task={task} />)
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
