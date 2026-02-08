"use client"

import { useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockClients } from "@/lib/mock-data"
import type { Task } from "@/lib/types"
import { taskSchema, formatZodErrors } from "@/lib/schemas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Calendar, CheckCircle2, Clock, ListChecks, Plus, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ProjectStatus } from "@/lib/types"

const statusConfig: Record<ProjectStatus, { className: string }> = {
  Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

export default function MisProyectosPage() {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ name: "", description: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // In real app, this would be managed by a global state or API
  const [localProjects, setLocalProjects] = useState(mockProjects)

  const assignedProjects = localProjects.filter((p) =>
    p.assignedWorkers.includes(user?.id ?? "")
  )

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
      createdBy: user.id,
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
            const progress = project.status === "Finalizado"
              ? 100
              : Math.min(Math.max(Math.round(((now - start) / (end - start)) * 100), 0), 100)

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
                      <span>{progress}% avance temporal</span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

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
                        {project.tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            </div>
                            {task.createdBy === user?.id && (
                              <span title="Creada por ti">
                                <User className="h-3 w-3 text-primary/50" />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog for adding new task */}
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
              <Input
                placeholder="Breve descripción de la tarea"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
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
    </div>
  )
}
