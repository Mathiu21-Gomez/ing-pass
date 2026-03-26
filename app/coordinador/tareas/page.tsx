"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { ExportDialog } from "@/components/export-dialog"
import type { Task, TaskStatus, Project, User, Tag, Comment, Activity } from "@/lib/types"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Send,
  CheckCircle2,
  Circle,
  Bell,
  Tag as TagIcon,
  X,
  Pencil,
  ArrowUpDown,
  AlertCircle,
  Clock,
  CheckCheck,
  Loader2,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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

// ─── Task Detail Panel (inline expandible) ────────────────────
function TaskDetailPanel({
  task,
  allUsers,
  availableTags,
  isOpen,
  onUpdate,
  onTagsUpdate,
}: {
  task: Task & { _projectName: string; _projectId: string }
  allUsers: User[]
  availableTags: Tag[]
  isOpen: boolean
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
}) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState("")
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [sortDesc, setSortDesc] = useState(true)
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

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      setCommentsLoading(true)
      try {
        const res = await fetch(`/api/tasks/${task.id}/comments`)
        if (res.ok) setComments(await res.json())
      } finally {
        setCommentsLoading(false)
      }
    }
    load()
  }, [isOpen, task.id])

  const sortedComments = [...comments].sort((a, b) =>
    sortDesc
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt)
  )

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

  async function handleAddComment() {
    if (!commentText.trim() || !user) return
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim(), authorId: user.id, parentType: "task" }),
      })
      const newComment = await res.json()
      setComments((prev) => [...prev, newComment])
      setCommentText("")
    } catch {
      toast.error("Error al agregar comentario")
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
        <div className="border-t border-l-4 border-l-primary/30 bg-primary/[0.02]">

          {/* ── Header del panel ── */}
          <div className="px-5 py-2.5 bg-muted/30 border-b flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground">#{task.correlativeId}</span>
            <span className="text-[10px] text-muted-foreground/50">·</span>
            <span className="text-[10px] text-muted-foreground">{task._projectName}</span>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                <SelectTrigger className={cn("w-auto h-7 text-xs border px-2.5 gap-1.5", STATUS_CONFIG[task.status].color)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px]", STATUS_CONFIG[s].color)}>
                        {STATUS_CONFIG[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activities.length > 0 && (
                <div className="flex items-center gap-2 ml-1">
                  <Progress value={progress} className="h-1.5 w-20" />
                  <span className={cn("text-xs font-semibold tabular-nums", progress === 100 ? "text-emerald-500" : "text-primary")}>
                    {progress}%
                  </span>
                </div>
              )}
              <div className="flex -space-x-1">
                {assignedUsers.slice(0, 4).map((u) => (
                  <div key={u.id} title={u.name} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[9px] font-bold text-primary">
                    {u.name.charAt(0)}
                  </div>
                ))}
                {assignedUsers.length === 0 && <span className="text-xs text-muted-foreground/50 italic">Sin asignar</span>}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <Tabs defaultValue="detalles" className="flex flex-col">
            <TabsList className="w-full rounded-none border-b h-10 bg-transparent px-5 justify-start gap-1 shrink-0">
              <TabsTrigger value="detalles" className="text-xs h-8 px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                Detalles
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs h-8 px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                Checklist {activities.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({completedCount}/{activities.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="comentarios" className="text-xs h-8 px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                Comentarios {comments.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({comments.length})</span>}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Detalles */}
            <TabsContent value="detalles" className="mt-0 px-5 py-4 space-y-5">

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Descripción</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setEditingDescription(!editingDescription)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea value={descValue} onChange={(e) => setDescValue(e.target.value)} rows={4} className="text-sm" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingDescription(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSaveDescription}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {task.description || <span className="italic opacity-40">Sin descripción</span>}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Pautas de seguimiento</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setEditingGuidelines(!editingGuidelines)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {editingGuidelines ? (
                  <div className="space-y-2">
                    <Textarea value={guidelinesValue} onChange={(e) => setGuidelinesValue(e.target.value)} rows={3} className="text-sm" placeholder="Instrucciones de seguimiento..." />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingGuidelines(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSaveGuidelines}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {task.guidelines || <span className="italic opacity-40">Sin pautas</span>}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Etiquetas</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowTagSelector(!showTagSelector)}>
                    <TagIcon className="h-3 w-3 mr-1" /> Gestionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.length === 0 && <span className="text-xs text-muted-foreground/40 italic">Sin etiquetas</span>}
                  {taskTags.map((tag) => <TagBadge key={tag.id} tag={tag} onRemove={() => handleTagToggle(tag)} />)}
                </div>
                {showTagSelector && (
                  <div className="rounded-lg border p-2 flex flex-wrap gap-1.5 bg-muted/20">
                    {availableTags.map((tag) => {
                      const selected = taskTags.some((t) => t.id === tag.id)
                      return (
                        <button key={tag.id} onClick={() => handleTagToggle(tag)}
                          className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium text-white transition-opacity", !selected && "opacity-35")}
                          style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </button>
                      )
                    })}
                    {availableTags.length === 0 && <span className="text-xs text-muted-foreground">Sin etiquetas para este proyecto</span>}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Personal asignado</Label>
                <div className="flex flex-wrap gap-2">
                  {assignedUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                        {u.name.charAt(0)}
                      </div>
                      {u.name.split(" ")[0]}
                    </div>
                  ))}
                  {assignedUsers.length === 0 && <span className="text-xs text-muted-foreground/40 italic">Sin asignar</span>}
                </div>
              </div>

              <div>
                {!showAlertForm ? (
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowAlertForm(true)}>
                    <Bell className="h-3.5 w-3.5" /> Configurar alarma
                  </Button>
                ) : (
                  <AlertDialog taskId={task.id} onClose={() => setShowAlertForm(false)} />
                )}
              </div>
            </TabsContent>

            {/* Tab: Checklist */}
            <TabsContent value="checklist" className="mt-0 px-5 py-4">
              {activities.length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30">
                  <Progress value={progress} className="h-2 flex-1" />
                  <span className={cn("text-sm font-bold tabular-nums shrink-0", progress === 100 ? "text-emerald-500" : "text-primary")}>
                    {progress}%
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{completedCount}/{activities.length} pasos</span>
                </div>
              )}
              <div className="space-y-1 mb-4">
                {activities.map((a) => (
                  <div key={a.id}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer",
                      a.completed ? "bg-emerald-500/8" : "hover:bg-muted/40"
                    )}
                    onClick={() => handleToggleActivity(a.id, !a.completed)}
                  >
                    {a.completed
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    }
                    <span className={cn("text-sm flex-1 leading-snug", a.completed && "line-through text-muted-foreground/50")}>
                      {a.name}
                    </span>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-muted-foreground/40 italic text-center py-8">Sin pasos definidos</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()}
                  placeholder="Agregar paso..." className="h-9"
                  disabled={addingCheckItem} />
                <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleAddCheckItem}
                  disabled={!newCheckItem.trim() || addingCheckItem}>
                  {addingCheckItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Comentarios */}
            <TabsContent value="comentarios" className="mt-0 flex flex-col">
              <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
                <p className="text-xs text-muted-foreground">{comments.length} comentario{comments.length !== 1 ? "s" : ""}</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => setSortDesc(!sortDesc)}>
                  <ArrowUpDown className="h-3 w-3" />
                  {sortDesc ? "Más reciente" : "Más antiguo"}
                </Button>
              </div>
              <div className="px-5 space-y-3 pb-2 max-h-64 overflow-y-auto">
                {commentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : sortedComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground/40 italic text-center py-10">Sin comentarios aún</p>
                ) : (
                  sortedComments.map((c) => {
                    const author = allUsers.find((u) => u.id === c.authorId)
                    return (
                      <div key={c.id} className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                          {author?.name?.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-xs font-semibold">{author?.name?.split(" ")[0]}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex gap-2 px-5 py-3 border-t shrink-0">
                <Input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  placeholder="Escribir comentario..." className="h-9" />
                <Button size="sm" className="h-9 px-3" onClick={handleAddComment} disabled={!commentText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </div>
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
}: {
  status: TaskStatus
  tasks: (Task & { _projectName: string; _projectId: string })[]
  allUsers: User[]
  availableTags: Tag[]
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = STATUS_CONFIG[status]

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border", cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length}</span>
      </button>

      {expanded && tasks.length > 0 && (
        <div className="border-t divide-y">
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id
            const assignedUsers = allUsers.filter((u) => task.assignedTo.includes(u.id))
            const completedActs = task.activities.filter((a) => a.completed).length
            const progress = task.activities.length > 0
              ? Math.round((completedActs / task.activities.length) * 100)
              : 0

            return (
              <div key={task.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                    isExpanded ? "bg-primary/5" : "hover:bg-muted/20"
                  )}
                  onClick={() => onToggleTask(task.id)}
                >
                  {/* Correlative ID */}
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold shrink-0 w-8">
                    #{task.correlativeId}
                  </span>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", task.status === "finalizado" && "line-through text-muted-foreground")}>
                        {task.name}
                      </span>
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
                          <span>{new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
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
                          className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-500" : "bg-primary")}
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
export default function CoordinadorTareasPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterProject, setFilterProject] = useState("all")
  const [filterTag, setFilterTag] = useState("all")
  const [filterUser, setFilterUser] = useState("all")
  const [search, setSearch] = useState("")

  // Expanded task (inline panel)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

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

  const myProjects = projects.filter((p) => p.coordinatorId === user?.id || user?.role === "admin")
  const workers = allUsers.filter((u) => u.active)

  // All tasks with project info
  const allTasks = myProjects.flatMap((p) =>
    (p.tasks ?? []).map((t) => ({ ...t, _projectId: p.id, _projectName: p.name }))
  )

  // Apply filters
  const filteredTasks = allTasks.filter((t) => {
    if (filterProject !== "all" && t._projectId !== filterProject) return false
    if (filterTag !== "all" && !(t.tags ?? []).some((tag) => tag.id === filterTag)) return false
    if (filterUser !== "all" && !t.assignedTo.includes(filterUser)) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by status
  const tasksByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = filteredTasks.filter((t) => t.status === status)
    return acc
  }, {} as Record<TaskStatus, typeof filteredTasks>)

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

  async function handleCreateTask() {
    if (!createForm.name.trim() || !createForm.projectId || !user) return
    setCreateLoading(true)
    try {
      const res = await fetch(`/api/projects/${createForm.projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, createdBy: user.id }),
      })
      if (!res.ok) throw new Error()
      const newTask = await res.json()
      setProjects((prev) =>
        prev.map((p) =>
          p.id === createForm.projectId
            ? { ...p, tasks: [...(p.tasks ?? []), newTask] }
            : p
        )
      )
      toast.success(`Tarea #${newTask.correlativeId} creada`)
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
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, projectId: tagProjectId || null }),
      })
      const tag = await res.json()
      setAvailableTags((prev) => [...prev, tag])
      setNewTagName("")
      toast.success("Etiqueta creada")
    } catch {
      toast.error("Error al crear etiqueta")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const tagsForSelectedProject = availableTags.filter(
    (t) => t.projectId === null || t.projectId === createForm.projectId
  )

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gestión de Tareas</h1>
          <p className="text-sm text-muted-foreground">{filteredTasks.length} tareas · {myProjects.length} proyectos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTagManager(true)}>
            <TagIcon className="h-4 w-4 mr-1" /> Etiquetas
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva tarea
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarea..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {myProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etiquetas</SelectItem>
            {availableTags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Usuario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Task board grouped by status */}
      <div className="space-y-3">
        {STATUS_ORDER.map((status) => (
          <StatusGroup
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            allUsers={allUsers}
            availableTags={availableTags}
            expandedTaskId={expandedTaskId}
            onToggleTask={handleToggleTask}
            onUpdate={handleTaskUpdate}
            onTagsUpdate={handleTagsUpdate}
          />
        ))}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Proyecto *</Label>
              <Select value={createForm.projectId} onValueChange={(v) => setCreateForm((f) => ({ ...f, projectId: v, tagIds: [] }))}>
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
              <Label>Asignar a</Label>
              <div className="flex flex-wrap gap-2">
                {workers.map((w) => {
                  const selected = createForm.assignedTo.includes(w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => setCreateForm((f) => ({
                        ...f,
                        assignedTo: selected ? f.assignedTo.filter((u) => u !== w.id) : [...f.assignedTo, w.id],
                      }))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                        selected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-border text-muted-foreground"
                      )}
                    >
                      {w.name.split(" ")[0]}
                    </button>
                  )
                })}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Gestión de Etiquetas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Crear nueva etiqueta</Label>
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nombre de la etiqueta"
                  className="flex-1"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
                <Button onClick={handleCreateTag} disabled={!newTagName.trim()} size="sm" className="h-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Proyecto (opcional — dejar vacío para global)</Label>
                <Select value={tagProjectId} onValueChange={setTagProjectId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Global (todos los proyectos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Global</SelectItem>
                    {myProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Etiquetas existentes</Label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {availableTags.map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                {availableTags.length === 0 && <span className="text-xs text-muted-foreground/50">Sin etiquetas</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTagManager(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
