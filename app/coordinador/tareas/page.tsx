"use client"

import { useState, useEffect, useRef, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { ExportDialog } from "@/components/export-dialog"
import type { Task, TaskStatus, Project, User, Tag, Activity } from "@/lib/types"
import { ChatPanel } from "@/components/chat-panel"
import { TaskOperationalHistory } from "@/components/task-operational-history"
import { SharedLinksPanel } from "@/components/shared-links-panel"
import {
  TaskShellBoard,
  TaskShellDetailGrid,
  TaskShellHeader,
  TaskShellMetaGrid,
  TaskShellMetaItem,
  TaskShellPanel,
  TaskShellStatCard,
} from "@/components/task-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog as ConfirmDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Bell,
  Tag as TagIcon,
  X,
  Pencil,
  AlertCircle,
  Clock,
  CheckCheck,
  Loader2,
  Download,
  ListTodo,
  CalendarDays,
  FileText,
  FolderKanban,
  Users,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TASK_SORT_DIRECTION,
  DEFAULT_TASK_SORT_KEY,
  DEFAULT_TASK_VIEW,
  DEFAULT_GROUP_BY,
  filterTasksByView,
  getStatusesForView,
  getTaskViewForStatus,
  groupTasksByStatus,
  groupTasksBy,
  sortTasks,
  TASK_SORT_LABELS,
  TASK_VIEW_LABELS,
  GROUP_BY_LABELS,
  type TaskSortDirection,
  type TaskSortKey,
  type TaskView,
  type GroupByKey,
} from "@/lib/task-board"
import { formatCorrelativeId, isTaskOverdue } from "@/lib/task-display"
import { toast } from "sonner"
import { isProjectCoordinator } from "@/lib/project-membership"

// ─── Status Config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode; order: number }> = {
  en_curso:           { label: "En Curso",              color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",    icon: <Loader2 className="h-3.5 w-3.5" />,      order: 1 },
  pendiente:          { label: "Pendiente",             color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20", icon: <Circle className="h-3.5 w-3.5" />,       order: 2 },
  retrasado:          { label: "Retrasado",             color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",         icon: <AlertCircle className="h-3.5 w-3.5" />,  order: 3 },
  bloqueado:          { label: "Bloqueado",             color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20", icon: <AlertCircle className="h-3.5 w-3.5" />, order: 4 },
  esperando_info:     { label: "Esperando información", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", icon: <Clock className="h-3.5 w-3.5" />,    order: 5 },
  listo_para_revision:{ label: "Listo para revisión",  color: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20", icon: <CheckCircle2 className="h-3.5 w-3.5" />, order: 6 },
  finalizado:         { label: "Finalizado",            color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: <CheckCheck className="h-3.5 w-3.5" />, order: 7 },
}

const STATUS_ORDER = (Object.keys(STATUS_CONFIG) as TaskStatus[]).sort(
  (a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order
)

const COORDINATOR_STORAGE_KEY = "task-board:coordinador"

const STATUS_LEFT_BORDER: Record<TaskStatus, string> = {
  en_curso: "border-l-blue-500",
  pendiente: "border-l-slate-400",
  retrasado: "border-l-red-500",
  bloqueado: "border-l-orange-500",
  esperando_info: "border-l-yellow-500",
  listo_para_revision: "border-l-violet-500",
  finalizado: "border-l-emerald-500",
}

const TAG_PRESET_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#f97316","#64748b"]

// ─── Tag Badge ─────────────────────────────────────────────────
function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

// ─── Alert Dialog (set reminder) ───────────────────────────────
function AlertDialog({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const [alertDate, setAlertDate] = useState("")
  const [alertTime, setAlertTime] = useState("09:00")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!alertDate) { toast.error("Seleccioná una fecha"); return }
    setSaving(true)
    try {
      const alertAt = new Date(`${alertDate}T${alertTime}:00`)
      await fetch(`/api/tasks/${taskId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertAt: alertAt.toISOString(), message }),
      })
      toast.success("Alarma configurada")
      onClose()
    } catch {
      toast.error("Error al configurar alarma")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <p className="text-sm font-medium flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" /> Configurar alarma
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={alertDate} onChange={(e) => setAlertDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hora</Label>
          <Input type="time" value={alertTime} onChange={(e) => setAlertTime(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Mensaje (opcional)</Label>
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Recordatorio..." className="h-8 text-xs" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar alarma"}
        </Button>
      </div>
    </div>
  )
}

function TaskDetailPanel({
  task,
  allUsers,
  availableTags,
  isOpen,
  onUpdate,
  onTagsUpdate,
  onDelete,
}: {
  task: Task & { _projectName: string; _projectId: string }
  allUsers: User[]
  availableTags: Tag[]
  isOpen: boolean
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
  onDelete: (taskId: string) => void
}) {
  const { user } = useAuth()
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editingGuidelines, setEditingGuidelines] = useState(false)
  const [descValue, setDescValue] = useState(task.description)
  const [guidelinesValue, setGuidelinesValue] = useState(task.guidelines ?? "")
  const [taskTags, setTaskTags] = useState<Tag[]>(task.tags ?? [])
  const [activities, setActivities] = useState<Activity[]>(task.activities)
  const [newCheckItem, setNewCheckItem] = useState("")
  const [addingCheckItem, setAddingCheckItem] = useState(false)
  const [mentionableUsers, setMentionableUsers] = useState<{ id: string; name: string }[]>([])
  const [supportIds, setSupportIds] = useState<string[]>(task.supportIds ?? [])
  const [supportPopoverOpen, setSupportPopoverOpen] = useState(false)

  useEffect(() => {
    setSupportIds(task.supportIds ?? [])
  }, [task.id, task.supportIds])

  async function handleSupportToggle(userId: string) {
    const next = supportIds.includes(userId)
      ? supportIds.filter((id) => id !== userId)
      : [...supportIds, userId]
    setSupportIds(next)
    setSupportPopoverOpen(false)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportIds: next }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(task.id, { supportIds: updated.supportIds ?? next })
      } else {
        setSupportIds(task.supportIds ?? [])
      }
    } catch {
      setSupportIds(task.supportIds ?? [])
    }
  }

  useEffect(() => {
    if (!isOpen) return

    fetch(`/api/tasks/${task.id}/mentionable`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setMentionableUsers(Array.isArray(data) ? data : []))
      .catch(() => setMentionableUsers([]))
  }, [isOpen, task.id])

  useEffect(() => {
    setDescValue(task.description)
    setGuidelinesValue(task.guidelines ?? "")
    setTaskTags(task.tags ?? [])
    setActivities(task.activities)
  }, [task.activities, task.description, task.guidelines, task.id, task.tags])

  async function handleStatusChange(newStatus: TaskStatus) {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      onUpdate(task.id, { status: newStatus })
      toast.success("Estado actualizado")
    } catch {
      toast.error("Error al actualizar estado")
    }
  }

  async function handleSaveDescription() {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue }),
      })
      onUpdate(task.id, { description: descValue })
      setEditingDescription(false)
      toast.success("Descripción actualizada")
    } catch {
      toast.error("Error al actualizar")
    }
  }

  async function handleSaveGuidelines() {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: guidelinesValue }),
      })
      onUpdate(task.id, { guidelines: guidelinesValue })
      setEditingGuidelines(false)
      toast.success("Pautas actualizadas")
    } catch {
      toast.error("Error al actualizar")
    }
  }

  async function handleTagToggle(tag: Tag) {
    const has = taskTags.some((t) => t.id === tag.id)
    const newTags = has ? taskTags.filter((t) => t.id !== tag.id) : [...taskTags, tag]
    setTaskTags(newTags)
    await fetch(`/api/tasks/${task.id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: newTags.map((t) => t.id) }),
    })
    onTagsUpdate(task.id, newTags)
  }

  async function handleToggleActivity(activityId: string, completed: boolean) {
    try {
      const res = await fetch(`/api/tasks/${task.id}/activities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, completed }),
      })
      const updated = await res.json()
      setActivities((prev) => prev.map((a) => (a.id === activityId ? updated : a)))
    } catch {
      toast.error("Error al actualizar checklist")
    }
  }

  async function handleAddCheckItem() {
    if (!newCheckItem.trim() || !user || addingCheckItem) return
    setAddingCheckItem(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCheckItem.trim(), description: "" }),
      })
      if (!res.ok) { toast.error("Error al agregar paso"); return }
      const newActivity = await res.json()
      setActivities((prev) => [...prev, newActivity])
      setNewCheckItem("")
    } catch {
      toast.error("Error al agregar paso")
    } finally {
      setAddingCheckItem(false)
    }
  }

  const completedCount = activities.filter((a) => a.completed).length
  const progress = activities.length > 0 ? Math.round((completedCount / activities.length) * 100) : 0
  const assignedUsers = allUsers.filter((u) => task.assignedTo.includes(u.id))

  return (
    <div
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden min-h-0">
        <div className={cn("rounded-b-2xl border-t border-l-4 bg-primary/[0.02] px-4 py-4", STATUS_LEFT_BORDER[task.status])}>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">{formatCorrelativeId(task._projectName, task.correlativeId)}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{task._projectName}</span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                <SelectTrigger className={cn("h-8 w-auto gap-1.5 border px-2.5 text-xs", STATUS_CONFIG[task.status].color)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", STATUS_CONFIG[s].color)}>
                        {STATUS_CONFIG[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activities.length > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/35 px-3 py-1">
                  <div className="w-20">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{progress}%</span>
                </div>
              )}
              <div className="flex -space-x-1">
                {assignedUsers.slice(0, 4).map((u) => (
                  <div key={u.id} title={u.name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[9px] font-bold text-primary">
                    {u.name.charAt(0)}
                  </div>
                ))}
                {assignedUsers.length === 0 ? <span className="text-xs italic text-muted-foreground/50">Sin asignar</span> : null}
              </div>
            </div>
          </div>
          <TaskShellDetailGrid
            info={
              <TaskShellPanel
                title="Información de tarea"
                description="Contexto, responsables, documentos, pautas y fecha comprometida para coordinar la ejecución."
                actions={!showAlertForm ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowAlertForm(true)}>
                      <Bell className="h-3.5 w-3.5" /> Configurar alarma
                    </Button>
                    <ConfirmDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 text-xs text-destructive hover:text-destructive hover:border-destructive/50">
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar tarea</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vas a eliminar permanentemente <strong>{formatCorrelativeId(task._projectName, task.correlativeId)} — {task.name}</strong>.
                            Se perderán todos los comentarios, actividades y documentos asociados.
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(task.id)}
                          >
                            Eliminar tarea
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </ConfirmDialog>
                  </div>
                ) : null}
              >
                <div className="space-y-5">
                  {showAlertForm ? <AlertDialog taskId={task.id} onClose={() => setShowAlertForm(false)} /> : null}

                  <TaskShellMetaGrid>
                    <TaskShellMetaItem icon={FolderKanban} label="Proyecto" value={task._projectName} />
                    <TaskShellMetaItem icon={CalendarDays} label="Inicio" value={new Date(task.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })} />
                    <TaskShellMetaItem icon={CalendarDays} label="Entrega" value={task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha comprometida"} />
                    <TaskShellMetaItem
                      icon={UserCheck}
                      label="Responsable"
                      value={assignedUsers.length > 0 ? assignedUsers.map((u) => u.name.split(" ").slice(0, 2).join(" ")).join(", ") : "Sin responsable"}
                      className="sm:col-span-2"
                    />
                    <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                          <UserPlus className="h-3.5 w-3.5" />
                          Equipo de apoyo
                        </div>
                        <Popover open={supportPopoverOpen} onOpenChange={setSupportPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                              <Plus className="h-3 w-3" /> Agregar
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0" align="end">
                            <Command>
                              <CommandInput placeholder="Buscar trabajador..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>Sin resultados</CommandEmpty>
                                <CommandGroup>
                                  {allUsers
                                    .filter((u) => u.role === "trabajador" && u.active && !task.assignedTo.includes(u.id))
                                    .map((u) => (
                                      <CommandItem
                                        key={u.id}
                                        value={u.name}
                                        onSelect={() => { void handleSupportToggle(u.id) }}
                                        className="gap-2"
                                      >
                                        <div className={cn("h-2 w-2 rounded-full border", supportIds.includes(u.id) ? "bg-primary border-primary" : "border-muted-foreground/40")} />
                                        <span className="text-sm">{u.name}</span>
                                        {u.position ? <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[80px]">{u.position}</span> : null}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                        {supportIds.length === 0 ? (
                          <span className="text-sm italic text-muted-foreground/50">Sin trabajadores de apoyo</span>
                        ) : (
                          supportIds.map((uid) => {
                            const u = allUsers.find((u) => u.id === uid)
                            if (!u) return null
                            return (
                              <span key={uid} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium">
                                {u.name.split(" ").slice(0, 2).join(" ")}
                                <button
                                  type="button"
                                  onClick={() => { void handleSupportToggle(uid) }}
                                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </TaskShellMetaGrid>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Descripción</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingDescription((value) => !value)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editingDescription ? (
                      <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-3">
                        <Textarea value={descValue} onChange={(e) => setDescValue(e.target.value)} rows={4} className="text-sm" />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setDescValue(task.description); setEditingDescription(false) }}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveDescription}>Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {task.description || <span className="italic text-muted-foreground">Sin descripción</span>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Pautas</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingGuidelines((value) => !value)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editingGuidelines ? (
                      <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-3">
                        <Textarea value={guidelinesValue} onChange={(e) => setGuidelinesValue(e.target.value)} rows={3} className="text-sm" placeholder="Instrucciones de seguimiento..." />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setGuidelinesValue(task.guidelines ?? ""); setEditingGuidelines(false) }}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveGuidelines}>Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {task.guidelines || <span className="italic text-muted-foreground">Sin pautas</span>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Etiquetas</p>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setShowTagSelector((value) => !value)}>
                        <TagIcon className="h-3 w-3" /> Gestionar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {taskTags.length === 0 ? <span className="text-xs italic text-muted-foreground/50">Sin etiquetas</span> : null}
                      {taskTags.map((tag) => <TagBadge key={tag.id} tag={tag} onRemove={() => handleTagToggle(tag)} />)}
                    </div>
                    {showTagSelector ? (
                      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/60 bg-muted/25 p-3">
                        {availableTags.map((tag) => {
                          const selected = taskTags.some((taskTag) => taskTag.id === tag.id)
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleTagToggle(tag)}
                              className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium text-white transition-opacity", !selected && "opacity-35")}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </button>
                          )
                        })}
                        {availableTags.length === 0 ? <span className="text-xs text-muted-foreground">Sin etiquetas para este proyecto</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Documentos</p>
                      {task.documents.length > 0 ? (
                        <div className="space-y-2">
                          {task.documents.map((document) => (
                            <div key={document.id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-foreground">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {document.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">Sin documentos adjuntos en la tarea.</div>
                      )}
                    </div>
                    <SharedLinksPanel apiBase={`/api/tasks/${task.id}`} />
                  </div>
                </div>
              </TaskShellPanel>
            }
            checklist={
              <TaskShellPanel
                title="Lista de control"
                description={activities.length > 0 ? `${completedCount}/${activities.length} pasos completados.` : "Todavia no hay pasos definidos para esta tarea."}
                actions={activities.length > 0 ? <span className={cn("text-xs font-semibold", progress === 100 ? "text-emerald-500" : "text-primary")}>{progress}%</span> : null}
              >
                <div className="space-y-4">
                  {activities.length > 0 ? <Progress value={progress} className="h-2" /> : null}
                  <div className="space-y-1">
                    {activities.map((activity) => (
                      <div key={activity.id} className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-colors", activity.completed ? "bg-emerald-500/5" : "bg-muted/25 hover:bg-muted/40")}>
                        <button type="button" onClick={() => handleToggleActivity(activity.id, !activity.completed)} className="mt-px shrink-0">
                          {activity.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                        </button>
                        <span className={cn("flex-1 text-sm leading-snug", activity.completed && "line-through text-muted-foreground/50")}>{activity.name}</span>
                      </div>
                    ))}
                    {activities.length === 0 ? <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">Sin pasos definidos.</div> : null}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()} placeholder="Agregar paso..." className="h-9 text-sm" disabled={addingCheckItem} />
                    <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleAddCheckItem} disabled={!newCheckItem.trim() || addingCheckItem}>
                      {addingCheckItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </TaskShellPanel>
            }
            history={
              <TaskShellPanel
                title="Historial operativo"
                description="Rastro resumido de adjuntos, menciones, actividad reciente y foco actual del responsable."
              >
                <TaskOperationalHistory taskId={task.id} />
              </TaskShellPanel>
            }
            conversation={
              <TaskShellPanel title="Conversación" description="Chat de tarea, menciones y seguimiento operativo ligado al contexto actual.">
                <ChatPanel
                  taskId={task.id}
                  useTaskChat={true}
                  mentionableUsers={mentionableUsers}
                  title="Chat de tarea"
                  placeholder="Escribi un mensaje... (@ para mencionar)"
                  allowImages={true}
                  className="rounded-xl border-0"
                />
              </TaskShellPanel>
            }
          />
        </div>
      </div>
    </div>
  )
}

// ─── Generic Group ─────────────────────────────────────────────
function GenericGroup({
  groupKey,
  label,
  tasks,
  allUsers,
  availableTags,
  expandedTaskId,
  onToggleTask,
  onUpdate,
  onTagsUpdate,
  onDeleteTask,
}: {
  groupKey: string
  label: string
  tasks: (Task & { _projectName: string; _projectId: string })[]
  allUsers: User[]
  availableTags: Tag[]
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
  onDeleteTask: (taskId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  if (tasks.length === 0) return null

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums shrink-0">{tasks.length} tarea{tasks.length !== 1 ? "s" : ""}</span>
      </button>

      {expanded && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id
            const assignedUsers = allUsers.filter((u) => task.assignedTo.includes(u.id))
            const completedActs = task.activities.filter((a) => a.completed).length
            const progress = task.activities.length > 0
              ? Math.round((completedActs / task.activities.length) * 100)
              : 0
            const overdue = isTaskOverdue(task)

            return (
              <div key={task.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 pl-3 pr-4 py-3 cursor-pointer transition-all border-l-4",
                    STATUS_LEFT_BORDER[task.status],
                    isExpanded ? "bg-primary/[0.04]" : "hover:bg-muted/30"
                  )}
                  onClick={() => onToggleTask(task.id)}
                >
                  <span className="text-[10px] font-mono font-semibold shrink-0 bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
                    {formatCorrelativeId(task._projectName, task.correlativeId)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", task.status === "finalizado" && "line-through text-muted-foreground")}>
                        {task.name}
                      </span>
                      {overdue && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 shrink-0">
                          <Clock className="h-3 w-3" /> vencida
                        </span>
                      )}
                      {task.tags?.slice(0, 2).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border", STATUS_CONFIG[task.status].color)}>
                        {STATUS_CONFIG[task.status].label}
                      </span>
                      <span>·</span>
                      <span>{task._projectName}</span>
                      {task.dueDate && (
                        <>
                          <span>·</span>
                          <span className={cn(overdue && "text-red-500 font-medium")}>
                            {new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {task.activities.length > 0 && (
                    <div className="w-12 shrink-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex -space-x-1.5 shrink-0">
                    {assignedUsers.slice(0, 3).map((u) => (
                      <div key={u.id} title={u.name} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[9px] font-bold text-primary">
                        {u.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded ? "rotate-180 text-primary" : "text-muted-foreground")} />
                </div>
                <TaskDetailPanel
                  isOpen={isExpanded}
                  task={task}
                  allUsers={allUsers}
                  availableTags={availableTags.filter((t) => t.projectId === null || t.projectId === task._projectId)}
                  onUpdate={onUpdate}
                  onTagsUpdate={onTagsUpdate}
                  onDelete={onDeleteTask}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Status Group ──────────────────────────────────────────────
function StatusGroup({
  status,
  tasks,
  allUsers,
  availableTags,
  expandedTaskId,
  onToggleTask,
  onUpdate,
  onTagsUpdate,
  onDeleteTask,
}: {
  status: TaskStatus
  tasks: (Task & { _projectName: string; _projectId: string })[]
  allUsers: User[]
  availableTags: Tag[]
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
  onDeleteTask: (taskId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = STATUS_CONFIG[status]

  return (
    <div className={cn("rounded-xl border-l-4 border border-border/70 bg-card overflow-hidden shadow-sm", STATUS_LEFT_BORDER[status])}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border", cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">{tasks.length} tarea{tasks.length !== 1 ? "s" : ""}</span>
      </button>

      {expanded && tasks.length > 0 && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id
            const assignedUsers = allUsers.filter((u) => task.assignedTo.includes(u.id))
            const completedActs = task.activities.filter((a) => a.completed).length
            const progress = task.activities.length > 0
              ? Math.round((completedActs / task.activities.length) * 100)
              : 0
            const overdue = isTaskOverdue(task)

            return (
              <div key={task.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 pl-3 pr-4 py-3 cursor-pointer transition-all",
                    isExpanded ? "bg-primary/[0.04]" : "hover:bg-muted/30"
                  )}
                  onClick={() => onToggleTask(task.id)}
                >
                  {/* Correlative ID */}
                  <span className="text-[10px] font-mono font-semibold shrink-0 bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
                    {formatCorrelativeId(task._projectName, task.correlativeId)}
                  </span>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", task.status === "finalizado" && "line-through text-muted-foreground")}>
                        {task.name}
                      </span>
                      {overdue && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 shrink-0">
                          <Clock className="h-3 w-3" /> vencida
                        </span>
                      )}
                      {task.tags?.slice(0, 3).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                      {(task.tags?.length ?? 0) > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{task.tags!.length - 3}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{task._projectName}</span>
                      {task.dueDate && (
                        <>
                          <span>·</span>
                          <span className={cn(overdue && "text-red-500 font-medium")}>
                            {new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                          </span>
                        </>
                      )}
                      {task.activities.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{completedActs}/{task.activities.length} pasos</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress mini */}
                  {task.activities.length > 0 && (
                    <div className="w-12 shrink-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Assignees */}
                  <div className="flex -space-x-1.5 shrink-0">
                    {assignedUsers.slice(0, 3).map((u) => (
                      <div
                        key={u.id}
                        title={u.name}
                        className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[9px] font-bold text-primary"
                      >
                        {u.name.charAt(0)}
                      </div>
                    ))}
                  </div>

                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded ? "rotate-180 text-primary" : "text-muted-foreground")} />
                </div>
                <TaskDetailPanel
                  isOpen={isExpanded}
                  task={task}
                  allUsers={allUsers}
                  availableTags={availableTags.filter((t) => t.projectId === null || t.projectId === task._projectId)}
                  onUpdate={onUpdate}
                  onTagsUpdate={onTagsUpdate}
                  onDelete={onDeleteTask}
                />
              </div>
            )
          })}
        </div>
      )}

      {expanded && tasks.length === 0 && (
        <div className="border-t px-4 py-3 text-xs text-muted-foreground/50">
          Sin tareas en este estado
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
function CoordinadorTareasPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterProject, setFilterProject] = useState("all")
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set())
  const [filterUser, setFilterUser] = useState("all")
  const [search, setSearch] = useState("")
  const [currentView, setCurrentView] = useState<TaskView>(DEFAULT_TASK_VIEW)
  const [sortKey, setSortKey] = useState<TaskSortKey>(DEFAULT_TASK_SORT_KEY)
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>(DEFAULT_TASK_SORT_DIRECTION)
  const [groupBy, setGroupBy] = useState<GroupByKey>(DEFAULT_GROUP_BY)

  // Expanded task (inline panel)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const handledTargetRef = useRef<string | null>(null)
  const handledNotificationRef = useRef<string | null>(null)

  const requestedTaskId = searchParams.get("task")
  const requestedNotificationId = searchParams.get("notification")

  // Create task dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "", description: "", projectId: "", assignedTo: [] as string[], tagIds: [] as string[],
  })
  const [createLoading, setCreateLoading] = useState(false)

  // Tag manager
  const [showTagManager, setShowTagManager] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#6366f1")
  const [tagProjectId, setTagProjectId] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(COORDINATOR_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        view: TaskView
        sortKey: TaskSortKey
        sortDirection: TaskSortDirection
        groupBy: GroupByKey
      }>

      if (parsed.view) setCurrentView(parsed.view)
      if (parsed.sortKey) setSortKey(parsed.sortKey)
      if (parsed.sortDirection) setSortDirection(parsed.sortDirection)
      if (parsed.groupBy) setGroupBy(parsed.groupBy)
    } catch {
      window.localStorage.removeItem(COORDINATOR_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    window.localStorage.setItem(
      COORDINATOR_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        view: currentView,
        sortKey,
        sortDirection,
        groupBy,
      })
    )
  }, [currentView, sortDirection, sortKey, groupBy])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [pRes, uRes, tRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/users"),
          fetch("/api/tags"),
        ])
        const [pData, uData, tData] = await Promise.all([pRes.json(), uRes.json(), tRes.json()])
        setProjects(Array.isArray(pData) ? pData : [])
        setAllUsers(Array.isArray(uData) ? uData : [])
        setAvailableTags(Array.isArray(tData) ? tData : [])
      } catch {
        toast.error("Error al cargar datos")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!requestedNotificationId || handledNotificationRef.current === requestedNotificationId) {
      return
    }

    handledNotificationRef.current = requestedNotificationId
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [requestedNotificationId] }),
    }).catch(() => {})
  }, [requestedNotificationId])

  const myProjects = projects.filter((p) => user?.role === "admin" || isProjectCoordinator(p, user?.id))
  const workers = allUsers.filter((u) => u.active && u.role === "trabajador")
  const selectedProject = myProjects.find((p) => p.id === createForm.projectId)
  const workersForForm = allUsers.filter(
    (u) => u.active && u.role === "trabajador" && (selectedProject?.assignedWorkers ?? []).includes(u.id)
  )

  // All tasks with project info
  const allTasks = myProjects.flatMap((p) =>
    (p.tasks ?? []).map((t) => ({ ...t, _projectId: p.id, _projectName: p.name }))
  )

  useEffect(() => {
    if (loading || !requestedTaskId) {
      if (!requestedTaskId) handledTargetRef.current = null
      return
    }

    const targetTask = allTasks.find((task) => task.id === requestedTaskId)
    if (!targetTask) return

    if (handledTargetRef.current === requestedTaskId) return

    handledTargetRef.current = requestedTaskId
    setFilterProject("all")
    setFilterTags(new Set())
    setFilterUser("all")
    setSearch("")
    setCurrentView(getTaskViewForStatus(targetTask.status))
    setExpandedTaskId(requestedTaskId)
  }, [allTasks, loading, requestedTaskId])

  // Apply filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (filterProject !== "all" && task._projectId !== filterProject) return false
      if (filterTags.size > 0 && !(task.tags ?? []).some((tag) => filterTags.has(tag.id))) return false
      if (filterUser !== "all" && !task.assignedTo.includes(filterUser)) return false
      if (search && !task.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allTasks, filterProject, filterTags, filterUser, search])

  const activeCount = useMemo(() => filterTasksByView(allTasks, "active").length, [allTasks])
  const reviewCount = useMemo(() => filterTasksByView(allTasks, "review").length, [allTasks])
  const completedCount = useMemo(() => filterTasksByView(allTasks, "completed").length, [allTasks])
  const historyCount = useMemo(() => filterTasksByView(allTasks, "history").length, [allTasks])

  const viewStatuses = useMemo(() => getStatusesForView(currentView), [currentView])
  const visibleTasks = useMemo(() => {
    return sortTasks(filterTasksByView(filteredTasks, currentView), sortKey, sortDirection)
  }, [currentView, filteredTasks, sortDirection, sortKey])

  const groupedTasks = useMemo(() => {
    return groupTasksByStatus(visibleTasks, viewStatuses)
  }, [viewStatuses, visibleTasks])

  const genericGroups = useMemo(() => {
    if (groupBy === "status") return []
    return groupTasksBy(visibleTasks, groupBy)
  }, [groupBy, visibleTasks])

  function handleToggleTask(taskId: string) {
    setExpandedTaskId((prev) => prev === taskId ? null : taskId)
  }

  // Update task in local state
  function handleTaskUpdate(taskId: string, updates: Partial<Task>) {
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        tasks: (p.tasks ?? []).map((t) => t.id === taskId ? { ...t, ...updates } : t),
      }))
    )
  }

  function handleTagsUpdate(taskId: string, newTags: Tag[]) {
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        tasks: (p.tasks ?? []).map((t) => t.id === taskId ? { ...t, tags: newTags } : t),
      }))
    )
  }

  async function handleDeleteTask(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      if (!res.ok) return
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: (p.tasks ?? []).filter((t) => t.id !== taskId),
        }))
      )
      if (expandedTaskId === taskId) setExpandedTaskId(null)
      toast.success("Tarea eliminada")
    } catch {
      toast.error("Error al eliminar tarea")
    }
  }

  async function handleCreateTask() {
    if (!createForm.name.trim() || !createForm.projectId || !user) return
    setCreateLoading(true)
    try {
      const res = await fetch(`/api/projects/${createForm.projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, createdBy: user.id }),
      })
      if (!res.ok) {
        toast.error("Error al crear tarea")
        return
      }
      const newTask = await res.json()
      setProjects((prev) =>
        prev.map((p) =>
          p.id === createForm.projectId
            ? { ...p, tasks: [...(p.tasks ?? []), newTask] }
            : p
        )
      )
      toast.success(`Tarea ${formatCorrelativeId(selectedProject?.name ?? "", newTask.correlativeId)} creada`)
      setShowCreate(false)
      setCreateForm({ name: "", description: "", projectId: "", assignedTo: [], tagIds: [] })
    } catch {
      toast.error("Error al crear tarea")
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim() || !user) return
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, projectId: tagProjectId === "__global__" || !tagProjectId ? null : tagProjectId }),
      })
      const tag = await res.json()
      setAvailableTags((prev) => [...prev, tag])
      setNewTagName("")
      toast.success("Etiqueta creada")
    } catch {
      toast.error("Error al crear etiqueta")
    }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      await fetch(`/api/tags/${tagId}`, { method: "DELETE" })
      setAvailableTags((prev) => prev.filter((t) => t.id !== tagId))
      toast.success("Etiqueta eliminada")
    } catch {
      toast.error("Error al eliminar etiqueta")
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-32 rounded-lg skeleton-shimmer" />
            <div className="h-4 w-48 rounded skeleton-shimmer" />
          </div>
          <div className="h-9 w-28 rounded-md skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    )
  }

  const tagsForSelectedProject = availableTags.filter(
    (t) => t.projectId === null || t.projectId === createForm.projectId
  )

  return (
    <div className="page-enter space-y-5">
      {/* Header — full width */}
      <TaskShellHeader
        eyebrow="Sprint 3"
        title="Gestión de tareas"
        description={`${visibleTasks.length} visibles, ${myProjects.length} proyectos propios y ${historyCount} tareas en historial.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTagManager(true)}>
              <TagIcon className="mr-1 h-4 w-4" /> Etiquetas
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nueva tarea
            </Button>
          </>
        }
      />

      {/* Stats — horizontal row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TaskShellStatCard label="Activas" value={activeCount} icon={ListTodo} tone="info" active={currentView === "active"} onClick={() => setCurrentView("active")} />
        <TaskShellStatCard label="Revisión" value={reviewCount} icon={CheckCircle2} tone="warning" active={currentView === "review"} onClick={() => setCurrentView("review")} />
        <TaskShellStatCard label="Finalizadas" value={completedCount} icon={CheckCheck} tone="success" active={currentView === "completed"} onClick={() => setCurrentView("completed")} />
        <TaskShellStatCard label="Historial" value={historyCount} icon={Clock} active={currentView === "history"} onClick={() => setCurrentView("history")} />
      </div>

      {/* Filter toolbar — compact */}
      <TaskShellPanel title="Shell de filtros" description="Ordená el tablero por proyecto, etiquetas, responsable y criterio operativo.">
        <div className="space-y-3">
          {/* Row 1: view tabs + search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(["active", "review", "completed", "history"] as TaskView[]).map((view) => {
                const count = view === "active" ? activeCount : view === "review" ? reviewCount : view === "completed" ? completedCount : historyCount
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCurrentView(view)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-all", currentView === view ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
                  >
                    {TASK_VIEW_LABELS[view]} · {count}
                  </button>
                )
              })}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar tarea..." className="h-9 rounded-xl pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {/* Row 2: selects + clear — horizontal flex-wrap */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue placeholder="Proyecto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {myProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {availableTags.map((tag) => {
                  const active = filterTags.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setFilterTags((prev) => {
                        const next = new Set(prev)
                        if (next.has(tag.id)) next.delete(tag.id)
                        else next.add(tag.id)
                        return next
                      })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                        active
                          ? "border-transparent text-white shadow-sm"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                      )}
                      style={active ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue placeholder="Responsable" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as TaskSortKey)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_SORT_LABELS) as TaskSortKey[]).map((key) => <SelectItem key={key} value={key}>{TASK_SORT_LABELS[key]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as TaskSortDirection)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue placeholder="Dirección" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascendente</SelectItem>
                <SelectItem value="desc">Descendente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByKey)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue placeholder="Agrupar por" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_BY_LABELS) as GroupByKey[]).map((key) => <SelectItem key={key} value={key}>{GROUP_BY_LABELS[key]}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterProject !== "all" || filterTags.size > 0 || filterUser !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-muted-foreground"
                onClick={() => { setFilterProject("all"); setFilterTags(new Set()); setFilterUser("all"); setSearch("") }}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
          </div>
        </div>
      </TaskShellPanel>

      {/* Task board — full width */}
      <TaskShellBoard>
        {visibleTasks.length === 0 ? (
          <TaskShellPanel title={TASK_VIEW_LABELS[currentView]} description="No hay tareas en esta vista con los filtros actuales.">
            <div className="py-6 text-sm text-muted-foreground">Ajustá el shell o cambiá de vista para recuperar tareas.</div>
          </TaskShellPanel>
        ) : groupBy === "status" ? (
          groupedTasks.map(({ status, tasks: statusTasks }) => (
            <StatusGroup
              key={status}
              status={status}
              tasks={statusTasks}
              allUsers={allUsers}
              availableTags={availableTags}
              expandedTaskId={expandedTaskId}
              onToggleTask={handleToggleTask}
              onUpdate={handleTaskUpdate}
              onTagsUpdate={handleTagsUpdate}
              onDeleteTask={handleDeleteTask}
            />
          ))
        ) : (
          genericGroups.map(({ key, label, tasks: groupTasks }) => (
            <GenericGroup
              key={key}
              groupKey={key}
              label={label}
              tasks={groupTasks}
              allUsers={allUsers}
              availableTags={availableTags}
              expandedTaskId={expandedTaskId}
              onToggleTask={handleToggleTask}
              onUpdate={handleTaskUpdate}
              onTagsUpdate={handleTagsUpdate}
              onDeleteTask={handleDeleteTask}
            />
          ))
        )}
      </TaskShellBoard>

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Proyecto *</Label>
              <Select value={createForm.projectId} onValueChange={(v) => setCreateForm((f) => ({ ...f, projectId: v, tagIds: [], assignedTo: [] }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
                <SelectContent>
                  {myProjects.filter((p) => p.status === "Activo").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Revisión de planos" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-foreground">Coordinación:</span> vos
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Pool del proyecto:</span>{" "}
                    {selectedProject ? `${workersForForm.length} trabajador${workersForForm.length === 1 ? "" : "es"}` : "—"}
                  </div>
                </div>
                <Select
                  value={createForm.assignedTo[0] ?? "none"}
                  onValueChange={(value) => setCreateForm((form) => ({
                    ...form,
                    assignedTo: value === "none" ? [] : [value],
                  }))}
                  disabled={!selectedProject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar trabajador responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin responsable por ahora</SelectItem>
                    {workersForForm.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} - {worker.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Regla Sprint 5: cada tarea queda con un solo trabajador responsable.</p>
              </div>
            </div>
            {createForm.projectId && tagsForSelectedProject.length > 0 && (
              <div className="space-y-1.5">
                <Label>Etiquetas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tagsForSelectedProject.map((tag) => {
                    const selected = createForm.tagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setCreateForm((f) => ({
                          ...f,
                          tagIds: selected ? f.tagIds.filter((id) => id !== tag.id) : [...f.tagIds, tag.id],
                        }))}
                        className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium text-white transition-opacity", !selected && "opacity-40")}
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={!createForm.name.trim() || !createForm.projectId || createLoading}>
              {createLoading ? "Creando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        context="tasks"
        filters={{ projectId: filterProject }}
        data={allTasks as unknown as Record<string, unknown>[]}
        projects={myProjects.map((p) => ({ id: p.id, name: p.name }))}
      />

      {/* Tag Manager Dialog */}
      <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestión de Etiquetas</DialogTitle>
            <DialogDescription className="text-xs">Creá y organizá las etiquetas para clasificar tareas.</DialogDescription>
          </DialogHeader>

          {/* Form */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Nueva etiqueta</p>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nombre de la etiqueta"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag() }}
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-9 w-9 rounded-md border cursor-pointer p-0.5 bg-transparent"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TAG_PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={cn("h-5 w-5 rounded-full border-2 transition-transform hover:scale-110", newTagColor === color ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Select value={tagProjectId} onValueChange={setTagProjectId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Global — todos los proyectos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global — todos los proyectos</SelectItem>
                {myProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Preview:</span>
                {newTagName.trim()
                  ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: newTagColor }}>{newTagName}</span>
                  : <span className="text-[11px] text-muted-foreground/40 italic">ingresá un nombre</span>
                }
              </div>
              <Button onClick={handleCreateTag} disabled={!newTagName.trim()} size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> Crear
              </Button>
            </div>
          </div>

          {/* Existing tags */}
          {availableTags.length > 0 ? (
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {availableTags.filter((t) => t.projectId === null).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Global</p>
                  <div className="space-y-0.5">
                    {availableTags.filter((t) => t.projectId === null).map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40 group">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        <button onClick={() => handleDeleteTag(tag.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {myProjects.filter((p) => availableTags.some((t) => t.projectId === p.id)).map((project) => (
                <div key={project.id}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">{project.name}</p>
                  <div className="space-y-0.5">
                    {availableTags.filter((t) => t.projectId === project.id).map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40 group">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        <button onClick={() => handleDeleteTag(tag.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground/50 text-sm">Sin etiquetas todavía</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagManager(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CoordinadorTareasPage() {
  return (
    <Suspense>
      <CoordinadorTareasPageContent />
    </Suspense>
  )
}
