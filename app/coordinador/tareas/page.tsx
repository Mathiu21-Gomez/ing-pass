"use client"

import { useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockUsers, mockComments, getCommentsFor } from "@/lib/mock-data"
import type { Task, Comment, TaskStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Plus,
    Search,
    Filter,
    CheckCircle2,
    Circle,
    MessageSquare,
    ArrowRightLeft,
    Users,
    Send,
    Clock,
    FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
    abierta: { label: "Abierta", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
    cerrada: { label: "Cerrada", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    pendiente_aprobacion: { label: "Pendiente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
}

export default function CoordinadorTareasPage() {
    const { user } = useAuth()
    const [localProjects, setLocalProjects] = useState(mockProjects)
    const [localComments, setLocalComments] = useState(mockComments)

    // Filters
    const [filterProject, setFilterProject] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterUser, setFilterUser] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")

    // Create task dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newTaskForm, setNewTaskForm] = useState({ name: "", description: "", projectId: "", assignedTo: [] as string[] })

    // Detail dialog
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")

    // Comment input
    const [commentText, setCommentText] = useState("")

    // Transfer dialog
    const [showTransferDialog, setShowTransferDialog] = useState(false)
    const [transferTaskId, setTransferTaskId] = useState<string>("")
    const [transferTo, setTransferTo] = useState<string>("")

    // Projects for this coordinator
    const myProjects = localProjects.filter((p) => p.coordinatorId === user?.id)
    const allWorkers = mockUsers.filter((u) => u.role === "trabajador" && u.active)

    // Get all tasks across projects
    const allTasks = myProjects.flatMap((p) =>
        p.tasks.map((t) => ({ ...t, _projectId: p.id, _projectName: p.name }))
    )

    // Filtered tasks
    const filteredTasks = allTasks.filter((t) => {
        if (filterProject !== "all" && t._projectId !== filterProject) return false
        if (filterStatus !== "all" && t.status !== filterStatus) return false
        if (filterUser !== "all" && !t.assignedTo.includes(filterUser)) return false
        if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    // Get latest version of selected task
    function getLatestTask(): (Task & { _projectId: string; _projectName: string }) | null {
        if (!selectedTask) return null
        return filteredTasks.find((t) => t.id === selectedTask.id) ?? allTasks.find((t) => t.id === selectedTask.id) ?? null
    }

    const currentTask = getLatestTask()

    // ─── Create Task ──────────────────────
    function handleCreateTask() {
        if (!newTaskForm.name.trim() || !newTaskForm.projectId || !user) return

        const newTask: Task = {
            id: `t${Date.now()}`,
            name: newTaskForm.name,
            description: newTaskForm.description,
            projectId: newTaskForm.projectId,
            assignedTo: newTaskForm.assignedTo,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            dueDate: null,
            status: "abierta",
            documents: [],
            activities: [],
        }

        setLocalProjects((prev) =>
            prev.map((p) =>
                p.id === newTaskForm.projectId
                    ? { ...p, tasks: [...p.tasks, newTask] }
                    : p
            )
        )

        toast.success("Tarea creada y asignada")
        setShowCreateDialog(false)
        setNewTaskForm({ name: "", description: "", projectId: "", assignedTo: [] })
    }

    // ─── Transfer Task ────────────────────
    function handleTransfer() {
        if (!transferTaskId || !transferTo) return

        setLocalProjects((prev) =>
            prev.map((p) => ({
                ...p,
                tasks: p.tasks.map((t) =>
                    t.id === transferTaskId
                        ? { ...t, assignedTo: [...t.assignedTo.filter((u) => u !== transferTo), transferTo] }
                        : t
                ),
            }))
        )

        const targetUser = mockUsers.find((u) => u.id === transferTo)
        toast.success(`Tarea transferida a ${targetUser?.name}`)
        setShowTransferDialog(false)
        setTransferTaskId("")
        setTransferTo("")
    }

    // ─── Add Comment ──────────────────────
    function handleAddComment() {
        if (!commentText.trim() || !currentTask || !user) return

        const newComment: Comment = {
            id: `com${Date.now()}`,
            parentType: "task",
            parentId: currentTask.id,
            authorId: user.id,
            text: commentText.trim(),
            createdAt: new Date().toISOString(),
        }

        setLocalComments((prev) => [...prev, newComment])
        setCommentText("")
        toast.success("Comentario agregado")
    }

    // ─── Close / Approve task ─────────────
    function handleStatusChange(taskId: string, newStatus: TaskStatus) {
        setLocalProjects((prev) =>
            prev.map((p) => ({
                ...p,
                tasks: p.tasks.map((t) =>
                    t.id === taskId ? { ...t, status: newStatus } : t
                ),
            }))
        )
        toast.success(newStatus === "cerrada" ? "Tarea cerrada" : "Estado actualizado")
    }

    // ─── Toggle assignedTo user ───────────
    function toggleAssignUser(userId: string) {
        setNewTaskForm((prev) => ({
            ...prev,
            assignedTo: prev.assignedTo.includes(userId)
                ? prev.assignedTo.filter((u) => u !== userId)
                : [...prev.assignedTo, userId],
        }))
    }

    // Get comments for a task
    function getTaskComments(taskId: string): Comment[] {
        return localComments
            .filter((c) => c.parentType === "task" && c.parentId === taskId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }

    // Progress calc
    function calcProgress(task: Task): number {
        if (task.activities.length === 0) return 0
        return Math.round((task.activities.filter((a) => a.completed).length / task.activities.length) * 100)
    }

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestión de Tareas</h1>
                    <p className="text-sm text-muted-foreground">{filteredTasks.length} tareas en tus proyectos</p>
                </div>
                <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4" />
                    Nueva Tarea
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar tarea..."
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={filterProject} onValueChange={setFilterProject}>
                            <SelectTrigger className="w-[180px] h-9">
                                <SelectValue placeholder="Proyecto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los proyectos</SelectItem>
                                {myProjects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="abierta">Abierta</SelectItem>
                                <SelectItem value="cerrada">Cerrada</SelectItem>
                                <SelectItem value="pendiente_aprobacion">Pendiente</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="w-[160px] h-9">
                                <SelectValue placeholder="Usuario" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los usuarios</SelectItem>
                                {allWorkers.map((w) => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Task List */}
            <div className="flex flex-col gap-2 stagger-children">
                {filteredTasks.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No se encontraron tareas</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredTasks.map((task) => {
                        const progress = calcProgress(task)
                        const assignedUsers = mockUsers.filter((u) => task.assignedTo.includes(u.id))
                        const comments = getTaskComments(task.id)

                        return (
                            <Card
                                key={task.id}
                                className="card-hover cursor-pointer"
                                onClick={() => { setSelectedTask(task); setSelectedProjectId(task._projectId) }}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center gap-4">
                                        {task.status === "cerrada" ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className={cn("text-sm font-medium truncate", task.status === "cerrada" && "line-through text-muted-foreground")}>
                                                    {task.name}
                                                </p>
                                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", statusConfig[task.status].className)}>
                                                    {statusConfig[task.status].label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span>{task._projectName}</span>
                                                {task.activities.length > 0 && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{task.activities.filter((a) => a.completed).length}/{task.activities.length} act.</span>
                                                    </>
                                                )}
                                                {comments.length > 0 && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <MessageSquare className="h-3 w-3" /> {comments.length}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {/* Assigned users avatars */}
                                        <div className="flex -space-x-2 shrink-0">
                                            {assignedUsers.slice(0, 3).map((u) => (
                                                <div
                                                    key={u.id}
                                                    className="h-7 w-7 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary"
                                                    title={u.name}
                                                >
                                                    {u.name.charAt(0)}
                                                </div>
                                            ))}
                                            {assignedUsers.length > 3 && (
                                                <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                                    +{assignedUsers.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        {/* Progress bar mini */}
                                        {task.activities.length > 0 && (
                                            <div className="w-16 shrink-0">
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground text-center mt-0.5">{progress}%</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            {/* ─── Create Task Dialog ──────────── */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crear Nueva Tarea</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Proyecto *</Label>
                            <Select value={newTaskForm.projectId} onValueChange={(v) => setNewTaskForm({ ...newTaskForm, projectId: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar proyecto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {myProjects.filter((p) => p.status === "Activo").map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Nombre de la tarea *</Label>
                            <Input
                                placeholder="Ej: Revisión de planos"
                                value={newTaskForm.name}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, name: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Descripción</Label>
                            <Textarea
                                placeholder="Breve descripción..."
                                value={newTaskForm.description}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                                rows={2}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Asignar a</Label>
                            <div className="flex flex-wrap gap-2">
                                {allWorkers.map((w) => {
                                    const isSelected = newTaskForm.assignedTo.includes(w.id)
                                    return (
                                        <button
                                            key={w.id}
                                            onClick={() => toggleAssignUser(w.id)}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                                                isSelected
                                                    ? "bg-primary/10 border-primary/30 text-primary"
                                                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold",
                                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                                            )}>
                                                {w.name.charAt(0)}
                                            </div>
                                            {w.name.split(" ")[0]}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateTask} disabled={!newTaskForm.name.trim() || !newTaskForm.projectId}>
                            Crear Tarea
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Task Detail Dialog ──────────── */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    {currentTask && (
                        <>
                            <DialogHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <DialogTitle className="text-lg leading-tight">{currentTask.name}</DialogTitle>
                                        <p className="text-xs text-muted-foreground mt-1">{currentTask._projectName}</p>
                                    </div>
                                    <Badge variant="outline" className={cn("shrink-0 text-xs", statusConfig[currentTask.status].className)}>
                                        {statusConfig[currentTask.status].label}
                                    </Badge>
                                </div>
                            </DialogHeader>

                            <div className="flex flex-col gap-4">
                                {/* Description */}
                                <p className="text-sm text-muted-foreground">{currentTask.description}</p>

                                {/* Info */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Creada por</p>
                                        <p className="text-xs font-medium">
                                            {mockUsers.find((u) => u.id === currentTask.createdBy)?.name?.split(" ")[0] ?? "—"}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Fecha</p>
                                        <p className="text-xs font-medium">
                                            {new Date(currentTask.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Actividades</p>
                                        <p className="text-xs font-medium">
                                            {currentTask.activities.filter((a) => a.completed).length}/{currentTask.activities.length}
                                        </p>
                                    </div>
                                </div>

                                {/* Assigned Users */}
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Asignados</p>
                                    <div className="flex flex-wrap gap-2">
                                        {currentTask.assignedTo.map((uid) => {
                                            const u = mockUsers.find((u) => u.id === uid)
                                            return u ? (
                                                <div key={uid} className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs">
                                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                                        {u.name.charAt(0)}
                                                    </div>
                                                    {u.name}
                                                </div>
                                            ) : null
                                        })}
                                        {currentTask.status === "abierta" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 gap-1 text-xs text-primary"
                                                onClick={() => {
                                                    setTransferTaskId(currentTask.id)
                                                    setShowTransferDialog(true)
                                                }}
                                            >
                                                <ArrowRightLeft className="h-3 w-3" />
                                                Transferir
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Progress */}
                                {currentTask.activities.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-muted-foreground">Progreso</span>
                                            <span className={cn("text-xs font-semibold", calcProgress(currentTask) === 100 ? "text-emerald-500" : "text-primary")}>
                                                {calcProgress(currentTask)}%
                                            </span>
                                        </div>
                                        <Progress value={calcProgress(currentTask)} className="h-2" />
                                    </div>
                                )}

                                {/* Activities preview */}
                                {currentTask.activities.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Actividades</p>
                                        <div className="flex flex-col gap-1">
                                            {currentTask.activities.map((a) => (
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
                                    </div>
                                )}

                                {/* Comments */}
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Comentarios ({getTaskComments(currentTask.id).length})
                                    </p>
                                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                        {getTaskComments(currentTask.id).length === 0 ? (
                                            <p className="text-xs text-muted-foreground/50 text-center py-3">Sin comentarios aún</p>
                                        ) : (
                                            getTaskComments(currentTask.id).map((c) => {
                                                const author = mockUsers.find((u) => u.id === c.authorId)
                                                return (
                                                    <div key={c.id} className="flex gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">
                                                            {author?.name.charAt(0) ?? "?"}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-medium">{author?.name?.split(" ")[0]}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {new Date(c.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{c.text}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                    {/* Add comment */}
                                    <div className="flex gap-2 mt-3">
                                        <Input
                                            placeholder="Escribir comentario..."
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                                            className="h-8 text-xs"
                                        />
                                        <Button size="sm" className="h-8 px-3" onClick={handleAddComment} disabled={!commentText.trim()}>
                                            <Send className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2">
                                {currentTask.status === "pendiente_aprobacion" && (
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                        onClick={() => handleStatusChange(currentTask.id, "abierta")}
                                    >
                                        Aprobar tarea
                                    </Button>
                                )}
                                {currentTask.status === "abierta" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => handleStatusChange(currentTask.id, "cerrada")}
                                    >
                                        Cerrar tarea
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setSelectedTask(null)}>Cerrar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ─── Transfer Dialog ─────────────── */}
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                            Transferir Tarea
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Transferir a</Label>
                            <Select value={transferTo} onValueChange={setTransferTo}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar usuario" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allWorkers.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancelar</Button>
                        <Button onClick={handleTransfer} disabled={!transferTo}>Transferir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
