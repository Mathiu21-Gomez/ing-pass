"use client"

import { useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockClients, mockUsers } from "@/lib/mock-data"
import type { Task, Activity, TaskStatus } from "@/lib/types"
import { taskSchema, formatZodErrors } from "@/lib/schemas"
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
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Plus,
  User,
  FileText,
  Trash2,
  ChevronRight,
  Lock,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ProjectStatus } from "@/lib/types"

const statusConfig: Record<ProjectStatus, { className: string }> = {
  Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

const taskStatusConfig: Record<TaskStatus, { label: string; className: string }> = {
  abierta: { label: "Abierta", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  cerrada: { label: "Cerrada", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  pendiente_aprobacion: { label: "Pendiente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
}

export default function MisProyectosPage() {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ name: "", description: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Task detail panel
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)

  // Activity input
  const [newActivityName, setNewActivityName] = useState("")
  const [newActivityDesc, setNewActivityDesc] = useState("")
  const [showActivityForm, setShowActivityForm] = useState(false)

  // Local mutable state
  const [localProjects, setLocalProjects] = useState(mockProjects)

  const assignedProjects = localProjects.filter((p) =>
    p.assignedWorkers.includes(user?.id ?? "")
  )

  // ─── Task CRUD ──────────────────────────────────────
  function openTaskDialog(projectId: string) {
    setSelectedProjectId(projectId)
    setTaskForm({ name: "", description: "" })
    setErrors({})
    setIsDialogOpen(true)
  }

  function handleAddTask() {
    const result = taskSchema.safeParse(taskForm)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    if (!selectedProjectId || !user) return

    const newTask: Task = {
      id: `t${Date.now()}`,
      name: taskForm.name,
      description: taskForm.description,
      projectId: selectedProjectId,
      assignedTo: [user.id],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      dueDate: null,
      status: "abierta",
      documents: [],
      activities: [],
    }

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === selectedProjectId
          ? { ...p, tasks: [...p.tasks, newTask] }
          : p
      )
    )

    toast.success("Tarea creada exitosamente")
    setIsDialogOpen(false)
  }

  // ─── Open task detail ───────────────────────────────
  function openDetail(task: Task, projectId: string) {
    setDetailTask(task)
    setDetailProjectId(projectId)
    setNewActivityName("")
    setNewActivityDesc("")
    setShowActivityForm(false)
  }

  // Keep detailTask in sync with localProjects
  function getLatestTask(): Task | null {
    if (!detailTask || !detailProjectId) return null
    const project = localProjects.find((p) => p.id === detailProjectId)
    return project?.tasks.find((t) => t.id === detailTask.id) ?? null
  }

  const currentTask = getLatestTask() ?? detailTask

  // ─── Activity CRUD ──────────────────────────────────
  function handleAddActivity() {
    if (!newActivityName.trim() || !currentTask || !user || !detailProjectId) return

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      taskId: currentTask.id,
      name: newActivityName.trim(),
      description: newActivityDesc.trim() || newActivityName.trim(),
      completed: false,
      dueDate: null,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === detailProjectId
          ? {
            ...p,
            tasks: p.tasks.map((t) =>
              t.id === currentTask.id
                ? { ...t, activities: [...t.activities, newActivity] }
                : t
            ),
          }
          : p
      )
    )

    setNewActivityName("")
    setNewActivityDesc("")
    setShowActivityForm(false)
    toast.success("Actividad agregada")
  }

  function toggleActivity(activityId: string) {
    if (!currentTask || !detailProjectId) return

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === detailProjectId
          ? {
            ...p,
            tasks: p.tasks.map((t) =>
              t.id === currentTask.id
                ? {
                  ...t,
                  activities: t.activities.map((a) =>
                    a.id === activityId ? { ...a, completed: !a.completed } : a
                  ),
                }
                : t
            ),
          }
          : p
      )
    )
  }

  function deleteActivity(activityId: string) {
    if (!currentTask || !detailProjectId) return

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === detailProjectId
          ? {
            ...p,
            tasks: p.tasks.map((t) =>
              t.id === currentTask.id
                ? { ...t, activities: t.activities.filter((a) => a.id !== activityId) }
                : t
            ),
          }
          : p
      )
    )
    toast.success("Actividad eliminada")
  }

  // ─── Close task ─────────────────────────────────────
  function closeTask() {
    if (!currentTask || !detailProjectId) return

    setLocalProjects((prev) =>
      prev.map((p) =>
        p.id === detailProjectId
          ? {
            ...p,
            tasks: p.tasks.map((t) =>
              t.id === currentTask.id ? { ...t, status: "cerrada" as TaskStatus } : t
            ),
          }
          : p
      )
    )
    toast.success("Tarea cerrada")
  }

  // ─── Progress calculation ───────────────────────────
  function calcProgress(task: Task): number {
    if (task.activities.length === 0) return 0
    const completed = task.activities.filter((a) => a.completed).length
    return Math.round((completed / task.activities.length) * 100)
  }

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          {assignedProjects.length} proyectos asignados
        </p>
      </div>

      {assignedProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No tienes proyectos asignados actualmente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 stagger-children">
          {assignedProjects.map((project) => {
            const client = mockClients.find((c) => c.id === project.clientId)
            const start = new Date(project.startDate).getTime()
            const end = new Date(project.endDate).getTime()
            const now = Date.now()
            const timeProgress = project.status === "Finalizado"
              ? 100
              : Math.min(Math.max(Math.round(((now - start) / (end - start)) * 100), 0), 100)

            // Task-based progress
            const totalActivities = project.tasks.reduce((sum, t) => sum + t.activities.length, 0)
            const completedActivities = project.tasks.reduce(
              (sum, t) => sum + t.activities.filter((a) => a.completed).length, 0
            )
            const taskProgress = totalActivities > 0
              ? Math.round((completedActivities / totalActivities) * 100)
              : 0

            return (
              <Card key={project.id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">{client?.name}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", statusConfig[project.status].className)}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{project.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(project.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        {" - "}
                        {new Date(project.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{timeProgress}% avance temporal</span>
                    </div>
                  </div>

                  {/* Task-based progress */}
                  {totalActivities > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progreso de actividades</span>
                        <span className="font-medium text-foreground">
                          {completedActivities}/{totalActivities} · {taskProgress}%
                        </span>
                      </div>
                      <Progress value={taskProgress} className="h-1.5" />
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Tareas del proyecto</p>
                      {project.status === "Activo" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => openTaskDialog(project.id)}
                        >
                          <Plus className="h-3 w-3" />
                          Nueva Tarea
                        </Button>
                      )}
                    </div>
                    {project.tasks.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          No hay tareas aún. ¡Crea la primera!
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {project.tasks.map((task) => {
                          const progress = calcProgress(task)
                          const completedCount = task.activities.filter((a) => a.completed).length
                          const isClosed = task.status === "cerrada"

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
                                isClosed
                                  ? "border-border bg-muted/20 opacity-70"
                                  : "border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/20"
                              )}
                              onClick={() => openDetail(task, project.id)}
                            >
                              {isClosed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={cn("text-sm font-medium truncate", isClosed ? "text-muted-foreground line-through" : "text-foreground")}>
                                    {task.name}
                                  </p>
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", taskStatusConfig[task.status].className)}>
                                    {taskStatusConfig[task.status].label}
                                  </Badge>
                                </div>
                                {task.activities.length > 0 ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[120px]">
                                      <div
                                        className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {completedCount}/{task.activities.length} actividades
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sin actividades</p>
                                )}
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Dialog: Create Task ─────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre de la tarea *</Label>
              <Input
                placeholder="Ej: Revisión de planos"
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Descripción *</Label>
              <Textarea
                placeholder="Breve descripción de la tarea"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={3}
                className={errors.description ? "border-destructive" : ""}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask}>Crear Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Task Detail + Activities ────────── */}
      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {currentTask && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg leading-tight">{currentTask.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {localProjects.find((p) => p.id === detailProjectId)?.name}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 text-xs", taskStatusConfig[currentTask.status].className)}>
                    {taskStatusConfig[currentTask.status].label}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="flex flex-col gap-5">
                {/* Description */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm text-foreground">{currentTask.description}</p>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Creada por</p>
                    <p className="text-xs font-medium text-foreground">
                      {mockUsers.find((u) => u.id === currentTask.createdBy)?.name?.split(" ")[0] ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Fecha</p>
                    <p className="text-xs font-medium text-foreground">
                      {new Date(currentTask.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Actividades</p>
                    <p className="text-xs font-medium text-foreground">
                      {currentTask.activities.filter((a) => a.completed).length}/{currentTask.activities.length}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                {currentTask.activities.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Progreso</span>
                      <span className={cn(
                        "text-xs font-semibold",
                        calcProgress(currentTask) === 100 ? "text-emerald-500" : "text-primary"
                      )}>
                        {calcProgress(currentTask)}%
                      </span>
                    </div>
                    <Progress value={calcProgress(currentTask)} className="h-2" />
                  </div>
                )}

                {/* ─── Activities List ─────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground">Actividades</p>
                    {currentTask.status === "abierta" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 text-xs text-primary"
                        onClick={() => setShowActivityForm(true)}
                      >
                        <Plus className="h-3 w-3" />
                        Agregar
                      </Button>
                    )}
                  </div>

                  {currentTask.activities.length === 0 && !showActivityForm ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                      <ListChecks className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Sin actividades aún
                      </p>
                      {currentTask.status === "abierta" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 gap-1 text-xs"
                          onClick={() => setShowActivityForm(true)}
                        >
                          <Plus className="h-3 w-3" />
                          Agregar primera actividad
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {currentTask.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className={cn(
                            "group flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors",
                            activity.completed ? "bg-emerald-500/5" : "hover:bg-muted/50"
                          )}
                        >
                          <button
                            onClick={() => currentTask.status === "abierta" && toggleActivity(activity.id)}
                            className={cn(
                              "mt-0.5 shrink-0 transition-colors",
                              currentTask.status !== "abierta" && "cursor-default"
                            )}
                            disabled={currentTask.status !== "abierta"}
                          >
                            {activity.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm",
                              activity.completed
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            )}>
                              {activity.name}
                            </p>
                            {activity.description !== activity.name && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                                {activity.description}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                              {mockUsers.find((u) => u.id === activity.createdBy)?.name?.split(" ")[0] ?? ""}
                              {" · "}
                              {new Date(activity.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                          {currentTask.status === "abierta" && (
                            <button
                              onClick={() => deleteActivity(activity.id)}
                              className="opacity-0 group-hover:opacity-100 mt-0.5 p-1 rounded text-muted-foreground/40 hover:text-destructive transition-all"
                              aria-label="Eliminar actividad"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Inline add activity form */}
                      {showActivityForm && currentTask.status === "abierta" && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 mt-1">
                          <Input
                            placeholder="Nombre de la actividad"
                            value={newActivityName}
                            onChange={(e) => setNewActivityName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newActivityName.trim()) {
                                handleAddActivity()
                              }
                              if (e.key === "Escape") {
                                setShowActivityForm(false)
                                setNewActivityName("")
                                setNewActivityDesc("")
                              }
                            }}
                            className="h-8 text-sm mb-2"
                            autoFocus
                          />
                          <Textarea
                            placeholder="Descripción breve (opcional)"
                            value={newActivityDesc}
                            onChange={(e) => setNewActivityDesc(e.target.value)}
                            rows={2}
                            className="text-sm mb-2"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">Enter para agregar · Esc para cancelar</p>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setShowActivityForm(false)
                                  setNewActivityName("")
                                  setNewActivityDesc("")
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={!newActivityName.trim()}
                                onClick={handleAddActivity}
                              >
                                Agregar
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* All completed suggestion */}
                {currentTask.activities.length > 0 &&
                  currentTask.activities.every((a) => a.completed) &&
                  currentTask.status === "abierta" && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          ¡Todas las actividades completadas!
                        </p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60">
                          Puedes cerrar esta tarea
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={closeTask}
                      >
                        Cerrar tarea
                      </Button>
                    </div>
                  )}

                {/* Closed task info */}
                {currentTask.status === "cerrada" && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Esta tarea está cerrada y no se puede modificar
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {currentTask.status === "abierta" && currentTask.activities.length > 0 && !currentTask.activities.every((a) => a.completed) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={closeTask}
                  >
                    Cerrar tarea
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailTask(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
