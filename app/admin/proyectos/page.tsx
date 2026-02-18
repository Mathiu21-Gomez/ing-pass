"use client"

import { useState } from "react"
import { mockProjects, mockClients, mockUsers } from "@/lib/mock-data"
import type { Project, ProjectStatus } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { projectSchema, formatZodErrors } from "@/lib/schemas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DeleteConfirmation } from "@/components/delete-confirmation"
import { Progress } from "@/components/ui/progress"
import { Plus, Pencil, Trash2, Search, Calendar, Users, ListTodo } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const statusConfig: Record<ProjectStatus, { className: string }> = {
  Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

export default function ProyectosPage() {
  const crud = useCrud<Project>(mockProjects)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [form, setForm] = useState({
    name: "",
    description: "",
    clientId: "",
    coordinatorId: "",
    stage: "Planificación",
    startDate: "",
    endDate: "",
    status: "Activo" as ProjectStatus,
    assignedWorkers: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const workers = mockUsers.filter((u) => u.role === "trabajador" && u.active)
  const coordinators = mockUsers.filter((u) => u.role === "coordinador" && u.active)

  const filtered = crud.filteredItems.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(crud.search.toLowerCase()) ||
      p.description.toLowerCase().includes(crud.search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function openNew() {
    setForm({
      name: "",
      description: "",
      clientId: "",
      coordinatorId: "",
      stage: "Planificación",
      startDate: "",
      endDate: "",
      status: "Activo",
      assignedWorkers: [],
    })
    setErrors({})
    crud.openCreate()
  }

  function openEdit(project: Project) {
    setForm({
      name: project.name,
      description: project.description,
      clientId: project.clientId,
      coordinatorId: project.coordinatorId,
      stage: project.stage,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      assignedWorkers: project.assignedWorkers,
    })
    setErrors({})
    crud.openEdit(project)
  }

  function handleSave() {
    const result = projectSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    if (crud.editing) {
      crud.update(crud.editing.id, { ...form, tasks: crud.editing.tasks, documents: crud.editing.documents, urls: crud.editing.urls })
      toast.success("Proyecto actualizado")
    } else {
      const newProject: Project = {
        id: `p${Date.now()}`,
        ...form,
        tasks: [],
        documents: [],
        urls: [],
      }
      crud.add(newProject)
      toast.success("Proyecto creado")
    }
    crud.closeDialog()
  }

  function handleDelete() {
    if (crud.deleteConfirmId) {
      crud.remove(crud.deleteConfirmId)
      toast.success("Proyecto eliminado")
    }
  }

  function toggleWorker(workerId: string) {
    setForm((prev) => ({
      ...prev,
      assignedWorkers: prev.assignedWorkers.includes(workerId)
        ? prev.assignedWorkers.filter((w) => w !== workerId)
        : [...prev.assignedWorkers, workerId],
    }))
  }

  function getProjectProgress(project: Project) {
    const start = new Date(project.startDate).getTime()
    const end = new Date(project.endDate).getTime()
    const now = Date.now()
    if (project.status === "Finalizado") return 100
    return Math.min(Math.max(Math.round(((now - start) / (end - start)) * 100), 0), 100)
  }

  const projectToDelete = crud.items.find((p) => p.id === crud.deleteConfirmId)

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {crud.items.filter((p) => p.status === "Activo").length} activos de {crud.items.length} proyectos
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proyectos..."
            value={crud.search}
            onChange={(e) => crud.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Activo">Activo</SelectItem>
            <SelectItem value="Pausado">Pausado</SelectItem>
            <SelectItem value="Finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        {filtered.map((project) => {
          const client = mockClients.find((c) => c.id === project.clientId)
          const assignedUsers = mockUsers.filter((u) => project.assignedWorkers.includes(u.id))
          const progress = getProjectProgress(project)

          return (
            <Card key={project.id} className="card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge variant="outline" className={cn("text-xs", statusConfig[project.status].className)}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{client?.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(project)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => crud.confirmDelete(project.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(project.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    {" - "}
                    {new Date(project.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progreso temporal</span>
                    <span className="font-medium text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex -space-x-2">
                    {assignedUsers.slice(0, 4).map((u) => (
                      <div
                        key={u.id}
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-primary-foreground"
                        title={u.name}
                      >
                        {u.name.charAt(0)}
                      </div>
                    ))}
                    {assignedUsers.length > 4 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                        +{assignedUsers.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{assignedUsers.length} asignados</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {project.tasks.map((task) => (
                    <span
                      key={task.id}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {task.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={crud.dialogOpen} onOpenChange={crud.setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{crud.editing ? "Editar Proyecto" : "Nuevo Proyecto"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre del proyecto *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Descripción *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={errors.description ? "border-destructive" : ""}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger className={errors.clientId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {mockClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Coordinador *</Label>
                <Select value={form.coordinatorId} onValueChange={(v) => setForm({ ...form, coordinatorId: v })}>
                  <SelectTrigger className={errors.coordinatorId ? "border-destructive" : ""}>
                    <SelectValue placeholder="Seleccionar coordinador" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.coordinatorId && <p className="text-xs text-destructive">{errors.coordinatorId}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Etapa *</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger className={errors.stage ? "border-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planificación">Planificación</SelectItem>
                    <SelectItem value="Diseño">Diseño</SelectItem>
                    <SelectItem value="Construcción">Construcción</SelectItem>
                    <SelectItem value="Cierre">Cierre</SelectItem>
                  </SelectContent>
                </Select>
                {errors.stage && <p className="text-xs text-destructive">{errors.stage}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Fecha inicio *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={errors.startDate ? "border-destructive" : ""}
                />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fecha fin *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className={errors.endDate ? "border-destructive" : ""}
                />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v: ProjectStatus) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Pausado">Pausado</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Asignar Trabajadores *</Label>
              <div className={cn("rounded-lg border p-3", errors.assignedWorkers ? "border-destructive" : "border-border")}>
                <div className="flex flex-col gap-2">
                  {workers.map((w) => (
                    <label
                      key={w.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        form.assignedWorkers.includes(w.id)
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={form.assignedWorkers.includes(w.id)}
                        onChange={() => toggleWorker(w.id)}
                      />
                      <span>{w.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{w.position}</span>
                    </label>
                  ))}
                </div>
              </div>
              {errors.assignedWorkers && <p className="text-xs text-destructive">{errors.assignedWorkers}</p>}
            </div>

            {/* Note about task creation */}
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                <ListTodo className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
                Las tareas son creadas por los trabajadores asignados al proyecto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={crud.closeDialog}>Cancelar</Button>
            <Button onClick={handleSave}>{crud.editing ? "Guardar Cambios" : "Crear Proyecto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        open={!!crud.deleteConfirmId}
        onOpenChange={(open) => !open && crud.cancelDelete()}
        onConfirm={handleDelete}
        title="¿Eliminar proyecto?"
        description="Se eliminarán todas las tareas y entradas de tiempo asociadas."
        itemName={projectToDelete?.name}
      />
    </div>
  )
}
