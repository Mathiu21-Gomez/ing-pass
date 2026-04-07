"use client"

import { useState, useCallback, useMemo } from "react"
import { projectsApi, clientsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, ProjectStatus, Client, User } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { projectSchema, formatZodErrors } from "@/lib/schemas"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DeleteConfirmation } from "@/components/delete-confirmation"
import { Progress } from "@/components/ui/progress"
import { TaskShellHeader, TaskShellPanel } from "@/components/task-shell"
import { Plus, Pencil, Trash2, Search, Calendar, Users, ListTodo, FolderKanban, FileText, Building2, Tag, CalendarDays, Star, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { SharedLinksPanel } from "@/components/shared-links-panel"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getProjectCoordinatorIds } from "@/lib/project-membership"

const statusConfig: Record<ProjectStatus, { className: string }> = {
  Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

const statusSheetConfig: Record<ProjectStatus, {
  gradient: string
  avatarGradient: string
  badge: string
}> = {
  Activo: {
    gradient: "from-emerald-500 to-teal-400",
    avatarGradient: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  Pausado: {
    gradient: "from-amber-500 to-orange-400",
    avatarGradient: "from-amber-500 to-orange-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  Finalizado: {
    gradient: "from-slate-400 to-slate-500",
    avatarGradient: "from-slate-400 to-slate-500",
    badge: "bg-muted text-muted-foreground border-border",
  },
}

export default function ProyectosPage() {
  const fetchProjects = useCallback(() => projectsApi.getAll(), [])
  const fetchClients = useCallback(() => clientsApi.getAll(), [])
  const fetchUsers = useCallback(() => usersApi.getAll(), [])
  const { data: apiProjects } = useApiData(fetchProjects, [] as Project[])
  const { data: clients } = useApiData(fetchClients, [] as Client[])
  const { data: users } = useApiData(fetchUsers, [] as User[])
  const crud = useCrud<Project>(apiProjects)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [progressEditProject, setProgressEditProject] = useState<Project | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [form, setForm] = useState({
    name: "",
    description: "",
    clientId: "",
    coordinatorId: "",
    coordinatorIds: [] as string[],
    stage: "Planificación",
    startDate: "",
    endDate: "",
    status: "Activo" as ProjectStatus,
    assignedWorkers: [] as string[],
    leaderIds: [] as string[],
  })
  const [workerComboOpen, setWorkerComboOpen] = useState(false)
  const [workerSearch, setWorkerSearch] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const workers = useMemo(() => users.filter((u) => u.role === "trabajador" && u.active), [users])
  const coordinators = useMemo(() => users.filter((u) => u.role === "coordinador" && u.active), [users])

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
      coordinatorIds: [],
      stage: "Planificación",
      startDate: "",
      endDate: "",
      status: "Activo",
      assignedWorkers: [],
      leaderIds: [],
    })
    setWorkerSearch("")
    setErrors({})
    crud.openCreate()
  }

  function openEdit(project: Project) {
    const leaderIds = (project.projectMembers ?? [])
      .filter((m) => m.role === "lider")
      .map((m) => m.userId)
    setForm({
      name: project.name,
      description: project.description,
      clientId: project.clientId,
      coordinatorId: project.coordinatorId,
      coordinatorIds: getProjectCoordinatorIds(project),
      stage: project.stage,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      assignedWorkers: project.assignedWorkers,
      leaderIds,
    })
    setWorkerSearch("")
    setErrors({})
    crud.openEdit(project)
  }

  async function handleSave() {
    const result = projectSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corregí los errores del formulario")
      return
    }

    try {
      if (crud.editing) {
        const payload = {
          ...form,
          coordinatorId: form.coordinatorIds[0] ?? form.coordinatorId,
          leaderIds: form.leaderIds,
          tasks: crud.editing.tasks,
          documents: crud.editing.documents,
          urls: crud.editing.urls,
        }
        await projectsApi.update(crud.editing.id, payload)
        crud.update(crud.editing.id, payload)
        toast.success("Proyecto actualizado")
      } else {
        const newProject = await projectsApi.create({
          ...form,
          coordinatorId: form.coordinatorIds[0] ?? form.coordinatorId,
          leaderIds: form.leaderIds,
          progress: 0,
        } as Omit<Project, "id" | "tasks" | "documents" | "urls">)
        crud.add(newProject)
        toast.success("Proyecto creado")
      }
      crud.closeDialog()
    } catch {
      toast.error("Error al guardar el proyecto")
    }
  }

  async function handleDelete() {
    if (crud.deleteConfirmId) {
      try {
        await projectsApi.delete(crud.deleteConfirmId)
        crud.remove(crud.deleteConfirmId)
        toast.success("Proyecto eliminado")
      } catch {
        toast.error("Error al eliminar el proyecto")
      }
    }
  }

  function toggleWorker(workerId: string) {
    setForm((prev) => ({
      ...prev,
      assignedWorkers: prev.assignedWorkers.includes(workerId)
        ? prev.assignedWorkers.filter((w) => w !== workerId)
        : [...prev.assignedWorkers, workerId],
      // remove from leaderIds if being deselected
      leaderIds: prev.assignedWorkers.includes(workerId)
        ? prev.leaderIds.filter((id) => id !== workerId)
        : prev.leaderIds,
    }))
  }

  function toggleLeader(workerId: string) {
    setForm((prev) => ({
      ...prev,
      leaderIds: prev.leaderIds.includes(workerId)
        ? prev.leaderIds.filter((id) => id !== workerId)
        : [...prev.leaderIds, workerId],
    }))
  }

  function toggleCoordinator(coordinatorId: string) {
    setForm((prev) => {
      const coordinatorIds = prev.coordinatorIds.includes(coordinatorId)
        ? prev.coordinatorIds.filter((id) => id !== coordinatorId)
        : [...prev.coordinatorIds, coordinatorId]

      return {
        ...prev,
        coordinatorIds,
        coordinatorId: coordinatorIds[0] ?? "",
      }
    })
  }

  async function handleUpdateProgress() {
    if (!progressEditProject) return
    try {
      const res = await fetch(`/api/projects/${progressEditProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: progressValue }),
      })
      if (!res.ok) throw new Error()
      crud.update(progressEditProject.id, { progress: progressValue })
      setProgressEditProject(null)
      toast.success("Avance actualizado")
    } catch {
      toast.error("Error al actualizar el avance")
    }
  }

  const projectToDelete = crud.items.find((p) => p.id === crud.deleteConfirmId)

  // Live preview values for Sheet header
  const previewStatusConfig = statusSheetConfig[form.status] ?? statusSheetConfig.Activo
  const previewInitials = form.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="page-enter space-y-5">
      <TaskShellHeader
        eyebrow="Gestión"
        title="Proyectos"
        description={`${crud.items.filter((p) => p.status === "Activo").length} activo${crud.items.filter((p) => p.status === "Activo").length === 1 ? "" : "s"} de ${crud.items.length} proyecto${crud.items.length === 1 ? "" : "s"} registrado${crud.items.length === 1 ? "" : "s"}.`}
        actions={
          <Button size="sm" className="gap-2 rounded-xl" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Nuevo proyecto
          </Button>
        }
      />

      {/* Sheet at page level — controlled by crud.dialogOpen */}
      <Sheet open={crud.dialogOpen} onOpenChange={(open) => { if (!open) crud.closeDialog() }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-xl overflow-hidden">
          {/* Status gradient strip — updates live as status changes */}
          <div className={cn("h-1.5 w-full shrink-0 bg-gradient-to-r transition-all duration-500", previewStatusConfig.gradient)} />

          {/* Header with live project avatar */}
          <SheetHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-md transition-all duration-300",
                previewStatusConfig.avatarGradient
              )}>
                {previewInitials || <FolderKanban className="h-6 w-6" />}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <SheetTitle className="text-base">
                  {crud.editing ? "Editar proyecto" : "Nuevo proyecto"}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {crud.editing
                    ? `Modificando "${crud.editing.name}".`
                    : "Completá los datos para registrar un nuevo proyecto."}
                </SheetDescription>
                <span className={cn(
                  "mt-1 inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all duration-300",
                  previewStatusConfig.badge
                )}>
                  {form.status} · {form.stage}
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* Section: Proyecto */}
            <div className="px-6 pt-5 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Proyecto</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-name">Nombre del proyecto *</Label>
                  <div className="relative">
                    <FolderKanban className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="p-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: Torre BIM Central"
                      className={cn("h-11 pl-10", errors.name && "border-destructive")}
                    />
                  </div>
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-client">Cliente *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                      <SelectTrigger className={cn("h-11 pl-10", errors.clientId && "border-destructive")}>
                        <SelectValue placeholder="Seleccioná un cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-description">Descripción *</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Textarea
                      id="p-description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      placeholder="Describí el alcance y objetivo del proyecto."
                      className={cn("pl-10 resize-none", errors.description && "border-destructive")}
                    />
                  </div>
                  {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Configuración */}
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Configuración</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Etapa *</Label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                      <SelectTrigger className={cn("h-11 pl-10", errors.stage && "border-destructive")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Planificación">Planificación</SelectItem>
                        <SelectItem value="Diseño">Diseño</SelectItem>
                        <SelectItem value="Construcción">Construcción</SelectItem>
                        <SelectItem value="Cierre">Cierre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.stage && <p className="text-xs text-destructive">{errors.stage}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={(v: ProjectStatus) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Activo">Activo</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                      <SelectItem value="Finalizado">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Fechas */}
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Fechas</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-start">Fecha de inicio *</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="p-start"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className={cn("h-11 pl-10", errors.startDate && "border-destructive")}
                    />
                  </div>
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-end">Fecha de fin *</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="p-end"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className={cn("h-11 pl-10", errors.endDate && "border-destructive")}
                    />
                  </div>
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Equipo */}
            <div className="px-6 py-4 pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Equipo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Coordinadores *</Label>
                  <div className={cn(
                    "rounded-xl border bg-muted/20 p-2 space-y-0.5 max-h-44 overflow-y-auto",
                    errors.coordinatorIds ? "border-destructive" : "border-border/60"
                  )}>
                    {coordinators.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-1">Sin coordinadores activos.</p>
                    ) : coordinators.map((coordinator) => (
                      <label
                        key={coordinator.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                          form.coordinatorIds.includes(coordinator.id)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border shrink-0"
                          checked={form.coordinatorIds.includes(coordinator.id)}
                          onChange={() => toggleCoordinator(coordinator.id)}
                        />
                        <span className="truncate">{coordinator.name}</span>
                      </label>
                    ))}
                  </div>
                  {errors.coordinatorIds && <p className="text-xs text-destructive">{errors.coordinatorIds}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Colaboradores *</Label>
                  <Popover open={workerComboOpen} onOpenChange={setWorkerComboOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex h-9 w-full items-center gap-2 rounded-xl border bg-background px-3 text-xs text-left transition-colors hover:bg-muted/50",
                          errors.assignedWorkers ? "border-destructive" : "border-border/60"
                        )}
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {form.assignedWorkers.length > 0
                            ? `${form.assignedWorkers.length} colaborador${form.assignedWorkers.length > 1 ? "es" : ""} seleccionado${form.assignedWorkers.length > 1 ? "s" : ""}`
                            : "Buscar colaborador..."}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Buscar por nombre..."
                          value={workerSearch}
                          onValueChange={setWorkerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Sin resultados.</CommandEmpty>
                          <CommandGroup>
                            {workers.map((w) => (
                              <CommandItem
                                key={w.id}
                                value={w.name}
                                onSelect={() => toggleWorker(w.id)}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  form.assignedWorkers.includes(w.id)
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border"
                                )}>
                                  {form.assignedWorkers.includes(w.id) && (
                                    <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span className="truncate">{w.name}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{w.position ?? ""}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {/* Selected workers chips */}
                  {form.assignedWorkers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {form.assignedWorkers.map((wId) => {
                        const w = workers.find((u) => u.id === wId)
                        if (!w) return null
                        const isLeader = form.leaderIds.includes(wId)
                        return (
                          <span
                            key={wId}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              isLeader
                                ? "border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-400"
                                : "border-border/60 bg-muted/50 text-foreground"
                            )}
                          >
                            <button
                              type="button"
                              title={isLeader ? "Quitar líder" : "Marcar como líder"}
                              onClick={() => toggleLeader(wId)}
                              className="shrink-0 -ml-0.5"
                            >
                              <Star className={cn("h-3 w-3", isLeader ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500")} />
                            </button>
                            <span className="truncate max-w-[80px]">{w.name.split(" ")[0]}</span>
                            <button
                              type="button"
                              onClick={() => toggleWorker(wId)}
                              className="shrink-0 text-muted-foreground hover:text-destructive -mr-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {errors.assignedWorkers && <p className="text-xs text-destructive">{errors.assignedWorkers}</p>}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  <ListTodo className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                  La coordinación queda definida por proyecto y los colaboradores siguen disponibles para operar tareas en su contexto.
                </p>
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t border-border bg-muted/20 px-6 py-4 flex-row gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={crud.closeDialog}>Cancelar</Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              {crud.editing ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TaskShellPanel title="Filtros">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscá por nombre o descripción..."
              value={crud.search}
              onChange={(e) => crud.setSearch(e.target.value)}
              className="h-9 rounded-xl pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-xl text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="Pausado">Pausado</SelectItem>
              <SelectItem value="Finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TaskShellPanel>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          <FolderKanban className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">Sin proyectos</p>
          <p className="mt-1 text-xs">
            {crud.search || statusFilter !== "all"
              ? "Ningún proyecto coincide con los filtros aplicados."
              : "Todavía no hay proyectos registrados. Creá el primero."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 stagger-children">
          {filtered.map((project) => {
            const client = clients.find((c) => c.id === project.clientId)
            const assignedUsers = users.filter((u) => project.assignedWorkers.includes(u.id))
            const projectCoordinatorIds = getProjectCoordinatorIds(project)
            const projectCoordinators = users.filter((u) => projectCoordinatorIds.includes(u.id))
            const tasks = project.tasks ?? []
            const finalizadas = tasks.filter((t) => t.status === "finalizado").length
            const autoProgress = tasks.length > 0 ? Math.round((finalizadas / tasks.length) * 100) : null
            const progress = autoProgress !== null ? autoProgress : (project.progress ?? 0)
            const isAuto = autoProgress !== null
            const isEditing = crud.editing?.id === project.id && crud.dialogOpen

            const cardInitials = project.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()
            const cardStatusCfg = statusSheetConfig[project.status] ?? statusSheetConfig.Activo

            return (
              <div
                key={project.id}
                className={cn(
                  "group relative flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden",
                  "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                  isEditing ? "ring-2 ring-primary/25 border-primary/30" : "border-border/70"
                )}
              >
                {/* Status gradient strip */}
                <div className={cn("h-1.5 w-full bg-gradient-to-r shrink-0", cardStatusCfg.gradient)} />

                <div className="flex flex-1 flex-col p-5 gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                        cardStatusCfg.avatarGradient
                      )}>
                        {cardInitials || <FolderKanban className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground leading-tight truncate">{client?.name ?? "Sin cliente"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] mr-1", statusConfig[project.status].className)}>
                        {project.status}
                      </Badge>
                      <button
                        onClick={() => openEdit(project)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => crud.confirmDelete(project.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stage + description panel */}
                  <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Etapa</span>
                      <span className="text-xs font-medium text-foreground">{project.stage}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{project.description}</p>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Avance{isAuto && <span className="ml-1 opacity-50">(auto)</span>}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-foreground">{progress}%</span>
                        <button
                          onClick={() => { setProgressEditProject(project); setProgressValue(project.progress ?? 0) }}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Editar avance manual"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  {/* Dates + team row */}
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>
                        {new Date(project.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(project.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {assignedUsers.slice(0, 4).map((u) => (
                          <div
                            key={u.id}
                            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary text-[9px] font-bold text-primary-foreground"
                            title={u.name}
                          >
                            {u.name.charAt(0)}
                          </div>
                        ))}
                        {assignedUsers.length > 4 && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium text-muted-foreground">
                            +{assignedUsers.length - 4}
                          </div>
                        )}
                      </div>
                      <span>{assignedUsers.length} asig.</span>
                    </div>
                  </div>

                  {/* Coordinators + tasks */}
                  {(projectCoordinators.length > 0 || tasks.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {projectCoordinators.map((coordinator) => (
                        <Badge key={coordinator.id} variant="outline" className="text-[10px] rounded-full">
                          Coord. {coordinator.name}
                        </Badge>
                      ))}
                      {tasks.map((task) => (
                        <span
                          key={task.id}
                          className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {task.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Shared links */}
                  <div className="border-t border-border/50 pt-3 mt-auto">
                    <SharedLinksPanel apiBase={`/api/projects/${project.id}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DeleteConfirmation
        open={!!crud.deleteConfirmId}
        onOpenChange={(open) => !open && crud.cancelDelete()}
        onConfirm={handleDelete}
        title="¿Eliminar proyecto?"
        description="Se eliminarán todas las tareas y entradas de tiempo asociadas."
        itemName={projectToDelete?.name}
      />

      <Dialog open={!!progressEditProject} onOpenChange={(open) => !open && setProgressEditProject(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar avance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground truncate">{progressEditProject?.name}</p>

            {(() => {
              const t = progressEditProject?.tasks ?? []
              const fin = t.filter((x) => x.status === "finalizado").length
              const auto = t.length > 0 ? Math.round((fin / t.length) * 100) : null
              return auto !== null ? (
                <div className="rounded-xl border bg-muted/30 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Calculado por tareas <span className="opacity-60">({fin}/{t.length} finalizadas)</span></span>
                  <span className="font-semibold tabular-nums">{auto}%</span>
                </div>
              ) : null
            })()}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ajuste manual</span>
                <span className="font-semibold tabular-nums text-lg">{progressValue}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progressValue}
                onChange={(e) => setProgressValue(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <Progress value={progressValue} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressEditProject(null)}>Cancelar</Button>
            <Button onClick={handleUpdateProgress}>Guardar manual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
