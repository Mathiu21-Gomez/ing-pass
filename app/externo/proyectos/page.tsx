"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import { projectsApi, clientsApi, usersApi, tasksApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, Client, User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    FolderKanban,
    CheckCircle2,
    Circle,
    Clock,
    ExternalLink,
    FileText,
    Users,
    Plus,
    AlertCircle,
    Hash,
    MessageSquare,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatPanel } from "@/components/chat-panel"
import { cn } from "@/lib/utils"
import { useState, useCallback, useMemo } from "react"
import type { Task } from "@/lib/types"
import { toast } from "sonner"

const statusConfig: Record<string, { className: string }> = {
    Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

const taskStatusConfig: Record<string, { label: string; className: string }> = {
    pendiente: { label: "Abierta", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
    finalizado: { label: "Cerrada", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    listo_para_revision: { label: "Pendiente aprobación", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
}

export default function ExternoProyectosPage() {
    const { user } = useAuth()

    const fetchProjects = useCallback(() => projectsApi.getAll(), [])
    const fetchClients = useCallback(() => clientsApi.getAll(), [])
    const fetchUsers = useCallback(() => usersApi.getAll(), [])
    const { data: allApiProjects } = useApiData(fetchProjects, [] as Project[])
    const { data: allClients } = useApiData(fetchClients, [] as Client[])
    const { data: allUsers } = useApiData(fetchUsers, [] as User[])

    const [localProjects, setLocalProjects] = useState<Project[]>([])
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [selectedProjectName, setSelectedProjectName] = useState("")

    // Sync from API when data arrives
    useMemo(() => {
        if (allApiProjects.length > 0 && localProjects.length === 0) {
            setLocalProjects(allApiProjects)
        }
    }, [allApiProjects])

    // Create task dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [createProjectId, setCreateProjectId] = useState("")
    const [newTaskForm, setNewTaskForm] = useState({ name: "", description: "", referenceId: "" })

    // Find client associated with this external user
    const client = useMemo(() => allClients.find((c) => c.email === user?.email), [allClients, user])

    // Get projects for this client
    const clientProjects = useMemo(() => client
        ? localProjects.filter((p) => p.clientId === client.id)
        : localProjects.filter((p) => p.assignedWorkers.includes(user?.id ?? "")), [client, localProjects, user])

    function calcProgress(task: Task): number {
        if (task.activities.length === 0) return 0
        return Math.round((task.activities.filter((a) => a.completed).length / task.activities.length) * 100)
    }

    function calcProjectProgress(tasks: Task[]): number {
        const totalActivities = tasks.flatMap((t) => t.activities)
        if (totalActivities.length === 0) return 0
        return Math.round((totalActivities.filter((a) => a.completed).length / totalActivities.length) * 100)
    }

    // ─── Create task with pendiente_aprobacion ────
    async function handleCreateTask() {
        if (!newTaskForm.name.trim() || !createProjectId || !user) return

        try {
            const created = await projectsApi.createTask(createProjectId, {
                name: newTaskForm.name,
                description: newTaskForm.description,
                assignedTo: [],
                createdBy: user.id,
            })

            // API creates with "pendiente" by default — update to "listo_para_revision"
            const updated = await tasksApi.update(created.id, { status: "listo_para_revision" })

            const newTask: Task = {
                ...created,
                status: updated.status ?? "listo_para_revision",
                documents: [],
                activities: [],
            }

            setLocalProjects((prev) =>
                prev.map((p) =>
                    p.id === createProjectId
                        ? { ...p, tasks: [...p.tasks, newTask] }
                        : p
                )
            )

            toast.success("Tarea enviada para aprobación del coordinador")
            setShowCreateDialog(false)
            setNewTaskForm({ name: "", description: "", referenceId: "" })
            setCreateProjectId("")
        } catch {
            toast.error("Error al crear tarea")
        }
    }

    function openCreateFor(projectId: string) {
        setCreateProjectId(projectId)
        setShowCreateDialog(true)
    }

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Mis Proyectos
                </h1>
                <p className="text-sm text-muted-foreground">
                    Bienvenido, {user?.name?.split(" ")[0]}. Aquí puedes ver el avance de tus proyectos.
                </p>
            </div>

            {clientProjects.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No tienes proyectos asignados</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-4 stagger-children">
                    {clientProjects.map((project) => {
                        const coordinator = allUsers.find((u) => u.id === project.coordinatorId)
                        const projectProgress = calcProjectProgress(project.tasks)
                        const closedTasks = project.tasks.filter((t) => t.status === "finalizado").length
                        const pendingTasks = project.tasks.filter((t) => t.status === "listo_para_revision").length

                        return (
                            <Card key={project.id} className="card-hover">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <CardTitle className="text-base">{project.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                                        </div>
                                        <Badge variant="outline" className={cn("shrink-0 text-xs", statusConfig[project.status]?.className)}>
                                            {project.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-0 p-0">
                                <Tabs defaultValue="avance">
                                  <div className="px-6 pt-2 pb-0 border-b border-border">
                                    <TabsList className="h-8 bg-transparent gap-1 p-0">
                                      <TabsTrigger value="avance" className="h-7 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3">
                                        Avance
                                      </TabsTrigger>
                                      <TabsTrigger value="consultas" className="h-7 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Consultas
                                      </TabsTrigger>
                                    </TabsList>
                                  </div>
                                  <TabsContent value="avance" className="mt-0 px-6 py-4">
                                  <div className="flex flex-col gap-4">
                                    {/* Project info grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Etapa</p>
                                            <p className="text-xs font-medium">{project.stage}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Coordinador</p>
                                            <p className="text-xs font-medium">{coordinator?.name?.split(" ")[0] ?? "—"}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Tareas</p>
                                            <p className="text-xs font-medium">{closedTasks}/{project.tasks.length} completadas</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Equipo</p>
                                            <p className="text-xs font-medium">{project.assignedWorkers.length} personas</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-muted-foreground">Avance general</span>
                                            <span className={cn("text-xs font-semibold", projectProgress === 100 ? "text-emerald-500" : "text-primary")}>
                                                {projectProgress}%
                                            </span>
                                        </div>
                                        <Progress value={projectProgress} className="h-2" />
                                    </div>

                                    {/* Documents */}
                                    {project.documents.length > 0 && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Documentos compartidos</p>
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

                                    {/* Tasks list */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-muted-foreground">Tareas del proyecto</p>
                                            {project.status === "Activo" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 gap-1 text-xs"
                                                    onClick={() => openCreateFor(project.id)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                    Solicitar tarea
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {project.tasks.map((task) => {
                                                const progress = calcProgress(task)
                                                return (
                                                    <div
                                                        key={task.id}
                                                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                                        onClick={() => { setSelectedTask(task); setSelectedProjectName(project.name) }}
                                                    >
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
                                                        {task.status === "listo_para_revision" && (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-600 border-amber-500/20">
                                                                Pendiente
                                                            </Badge>
                                                        )}
                                                        {task.activities.length > 0 && (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {task.activities.filter((a) => a.completed).length}/{task.activities.length}
                                                                </span>
                                                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Pending approval notice */}
                                    {pendingTasks > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            {pendingTasks} tarea{pendingTasks > 1 ? "s" : ""} pendiente{pendingTasks > 1 ? "s" : ""} de aprobación del coordinador
                                        </div>
                                    )}
                                  </div>
                                  </TabsContent>
                                  <TabsContent value="consultas" className="mt-0 px-4 py-4">
                                    <ChatPanel
                                      projectId={project.id}
                                      isClientMessage={true}
                                      title="Consultas al equipo"
                                      placeholder="Escribí tu consulta o comentario..."
                                    />
                                    <p className="text-xs text-muted-foreground text-center mt-2">
                                      Tus mensajes son visibles solo para admin y coordinadores del proyecto.
                                    </p>
                                  </TabsContent>
                                </Tabs>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* ─── Create Task Dialog ──────────── */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" />
                            Solicitar Nueva Tarea
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            La tarea quedará pendiente hasta que el coordinador la apruebe.
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Nombre de la tarea *</Label>
                            <Input
                                placeholder="Ej: Revisar informe de avance semanal"
                                value={newTaskForm.name}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, name: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Descripción</Label>
                            <Textarea
                                placeholder="Describe lo que necesitas..."
                                value={newTaskForm.description}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="flex items-center gap-1 text-muted-foreground">
                                <Hash className="h-3 w-3" />
                                ID de referencia (documento/trabajo externo)
                            </Label>
                            <Input
                                placeholder="Ej: DOC-2024-0145, PLN-A-003..."
                                value={newTaskForm.referenceId}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, referenceId: e.target.value })}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateTask} disabled={!newTaskForm.name.trim()}>
                            Enviar solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Task Detail Dialog with Comments ──── */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    {selectedTask && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {selectedTask.status === "finalizado" ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    ) : selectedTask.status === "listo_para_revision" ? (
                                        <AlertCircle className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <Circle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                    {selectedTask.name}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground">{selectedProjectName}</p>
                            </DialogHeader>

                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-muted-foreground">{selectedTask.description}</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Estado</p>
                                        <Badge variant="outline" className={cn("text-[10px]", taskStatusConfig[selectedTask.status]?.className)}>
                                            {taskStatusConfig[selectedTask.status]?.label}
                                        </Badge>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Actividades</p>
                                        <p className="text-xs font-medium">
                                            {selectedTask.activities.filter((a) => a.completed).length}/{selectedTask.activities.length}
                                        </p>
                                    </div>
                                </div>

                                {selectedTask.activities.length > 0 && (
                                    <>
                                        <Progress value={calcProgress(selectedTask)} className="h-2" />
                                        <div className="flex flex-col gap-1">
                                            {selectedTask.activities.map((a) => (
                                                <div key={a.id} className="flex items-center gap-2 px-2 py-1">
                                                    {a.completed ? (
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                    ) : (
                                                        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    )}
                                                    <span className={cn("text-xs", a.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                                                        {a.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Comunicación */}
                                <div className="border-t border-border pt-4">
                                    <ChatPanel
                                        taskId={selectedTask.id}
                                        title="Comunicación"
                                        placeholder="Escribí un mensaje sobre esta tarea..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button variant="outline" onClick={() => setSelectedTask(null)}>Cerrar</Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
