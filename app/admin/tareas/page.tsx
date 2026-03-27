"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { ExportDialog } from "@/components/export-dialog"
import type { Task, TaskStatus, Project, User, Tag, Comment, Activity } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  FolderKanban,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Status Config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode; order: number }> = {
  en_curso:            { label: "En Curso",              color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",       icon: <Loader2 className="h-3.5 w-3.5" />,        order: 1 },
  pendiente:           { label: "Pendiente",             color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",    icon: <Circle className="h-3.5 w-3.5" />,         order: 2 },
  retrasado:           { label: "Retrasado",             color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",            icon: <AlertCircle className="h-3.5 w-3.5" />,    order: 3 },
  bloqueado:           { label: "Bloqueado",             color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",icon: <AlertCircle className="h-3.5 w-3.5" />,    order: 4 },
  esperando_info:      { label: "Esperando info",        color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",icon: <Clock className="h-3.5 w-3.5" />,          order: 5 },
  listo_para_revision: { label: "Para revisión",        color: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",icon: <CheckCircle2 className="h-3.5 w-3.5" />,   order: 6 },
  finalizado:          { label: "Finalizado",            color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: <CheckCheck className="h-3.5 w-3.5" />, order: 7 },
}

const STATUS_ORDER = (Object.keys(STATUS_CONFIG) as TaskStatus[]).sort(
  (a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order
)

const STATUS_LEFT_BORDER: Record<TaskStatus, string> = {
  en_curso:            "border-l-blue-500",
  pendiente:           "border-l-slate-400",
  retrasado:           "border-l-red-500",
  bloqueado:           "border-l-orange-500",
  esperando_info:      "border-l-yellow-500",
  listo_para_revision: "border-l-violet-500",
  finalizado:          "border-l-emerald-500",
}

// ─── Tag Badge ──────────────────────────────────────────────────
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

// ─── Alert Dialog ───────────────────────────────────────────────
function AlertDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
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

// ─── Task Detail Panel (inline expandible) ──────────────────────
function TaskDetailPanel({
  task,
  allUsers,
  availableTags,
  isOpen,
  onUpdate,
  onTagsUpdate,
}: {
  task: Task & { _projectName: string; _projectId: string; _coordinatorName: string }
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
    sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
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
      if (updated.taskStatusChanged && updated.newTaskStatus) {
        onUpdate(task.id, { status: updated.newTaskStatus as TaskStatus })
      }
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
        <div className={cn("border-t border-l-4 bg-primary/[0.02]", STATUS_LEFT_BORDER[task.status])}>

          {/* ── Info bar ── */}
          <div className="px-5 py-2.5 bg-muted/30 border-b border-border/50 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-muted-foreground">#{task.correlativeId}</span>
            <span className="text-[10px] text-muted-foreground/50">·</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />{task._projectName}
            </span>
            <span className="text-[10px] text-muted-foreground/50">·</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />{task._coordinatorName}
            </span>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                <SelectTrigger className={cn("h-7 w-auto text-xs border px-2.5 gap-1.5", STATUS_CONFIG[task.status].color)}>
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
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{progress}%</span>
                </div>
              )}
              <div className="flex -space-x-1.5">
                {assignedUsers.slice(0, 5).map((u) => (
                  <div key={u.id} title={u.name} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[9px] font-bold text-primary">
                    {u.name.charAt(0)}
                  </div>
                ))}
                {assignedUsers.length === 0 && (
                  <span className="text-xs text-muted-foreground/50 italic">Sin asignar</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Cuerpo 2 columnas ── */}
          <div className="grid grid-cols-2 divide-x">

            {/* IZQUIERDA: descripción, pautas, etiquetas, alarma */}
            <div className="p-5 space-y-5">

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Descripción</p>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Pautas</p>
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

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Etiquetas</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {taskTags.length === 0 && <span className="text-xs text-muted-foreground/40 italic">Sin etiquetas</span>}
                  {taskTags.map((tag) => <TagBadge key={tag.id} tag={tag} onRemove={() => handleTagToggle(tag)} />)}
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 -ml-1" onClick={() => setShowTagSelector(!showTagSelector)}>
                  <TagIcon className="h-3 w-3 mr-1" /> Gestionar
                </Button>
                {showTagSelector && (
                  <div className="mt-2 rounded-lg border p-2 flex flex-wrap gap-1.5 bg-muted/20">
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

              <div>
                {!showAlertForm ? (
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowAlertForm(true)}>
                    <Bell className="h-3.5 w-3.5" /> Configurar alarma
                  </Button>
                ) : (
                  <AlertDialog taskId={task.id} onClose={() => setShowAlertForm(false)} />
                )}
              </div>
            </div>

            {/* DERECHA: checklist */}
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Lista de control{activities.length > 0 && ` (${completedCount}/${activities.length})`}
                  </p>
                  {activities.length > 0 && (
                    <span className={cn("text-xs font-bold tabular-nums", progress === 100 ? "text-emerald-500" : "text-primary")}>
                      {progress}%
                    </span>
                  )}
                </div>
                {activities.length > 0 && <Progress value={progress} className="h-2 mb-3" />}
                <div className="space-y-0.5">
                  {activities.map((a) => (
                    <div key={a.id} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors", a.completed ? "bg-emerald-500/5" : "hover:bg-muted/40")}>
                      <button onClick={() => handleToggleActivity(a.id, !a.completed)} className="shrink-0 mt-px">
                        {a.completed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <Circle className="h-4 w-4 text-muted-foreground/40" />
                        }
                      </button>
                      <span className={cn("text-sm flex-1 leading-snug", a.completed && "line-through text-muted-foreground/50")}>{a.name}</span>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-xs text-muted-foreground/40 italic px-2">Sin pasos definidos</p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()}
                    placeholder="Agregar paso..." className="h-8 text-xs"
                    disabled={addingCheckItem} />
                  <Button variant="outline" size="sm" className="h-8 px-3" onClick={handleAddCheckItem}
                    disabled={!newCheckItem.trim() || addingCheckItem}>
                    {addingCheckItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Comentarios ── */}
          <div className="border-t px-5 pt-4 pb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Comentarios ({comments.length})
              </p>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => setSortDesc(!sortDesc)}>
                <ArrowUpDown className="h-3 w-3" />
                {sortDesc ? "Más reciente" : "Más antiguo"}
              </Button>
            </div>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 mb-3">
              {commentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : sortedComments.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 text-center py-4 italic">Sin comentarios aún</p>
              ) : (
                sortedComments.map((c) => {
                  const author = allUsers.find((u) => u.id === c.authorId)
                  return (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                        {author?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">{author?.name?.split(" ")[0]}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.text}</p>
                        {c.attachments && c.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {c.attachments.map((img) => (
                              <a key={img.id} href={`data:${img.type};base64,${img.data}`} target="_blank" rel="noopener noreferrer"
                                className="rounded overflow-hidden border border-border w-16 h-16 block hover:opacity-80 transition-opacity">
                                <img src={`data:${img.type};base64,${img.data}`} alt={img.name} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex gap-2">
              <Input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                placeholder="Escribir comentario..." className="h-9 text-sm" />
              <Button size="sm" className="h-9 px-3" onClick={handleAddComment} disabled={!commentText.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Status Group ───────────────────────────────────────────────
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
  tasks: (Task & { _projectName: string; _projectId: string; _coordinatorName: string })[]
  allUsers: User[]
  availableTags: Tag[]
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onTagsUpdate: (taskId: string, tags: Tag[]) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = STATUS_CONFIG[status]
  if (tasks.length === 0) return null

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
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length} tarea{tasks.length !== 1 ? "s" : ""}</span>
      </button>

      {expanded && (
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
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold shrink-0 w-8">
                    #{task.correlativeId}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", task.status === "finalizado" && "line-through text-muted-foreground")}>
                        {task.name}
                      </span>
                      {task.tags?.slice(0, 2).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {task._projectName}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {task._coordinatorName}
                      </span>
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
                  {task.activities.length > 0 && (
                    <div className="w-14 shrink-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right mt-0.5">{progress}%</p>
                    </div>
                  )}
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
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AdminTareasPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const [filterProject, setFilterProject] = useState("all")
  const [filterTag, setFilterTag] = useState("all")
  const [filterWorker, setFilterWorker] = useState("all")
  const [filterCoordinator, setFilterCoordinator] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [search, setSearch] = useState("")

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "", description: "", projectId: "", assignedTo: [] as string[], tagIds: [] as string[],
  })
  const [createLoading, setCreateLoading] = useState(false)

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

  const coordinators = allUsers.filter((u) => u.role === "coordinador" && u.active)
  const workers = allUsers.filter((u) => u.active)
  const selectedProject = projects.find((p) => p.id === createForm.projectId)
  const workersForForm = allUsers.filter(
    (u) => u.active && u.role === "trabajador" && (selectedProject?.assignedWorkers ?? []).includes(u.id)
  )

  // All tasks with project + coordinator info
  const allTasks = projects.flatMap((p) =>
    (p.tasks ?? []).map((t) => ({
      ...t,
      _projectId: p.id,
      _projectName: p.name,
      _coordinatorName: allUsers.find((u) => u.id === p.coordinatorId)?.name?.split(" ").slice(0, 2).join(" ") ?? "—",
    }))
  )

  // Apply filters
  const filteredTasks = allTasks.filter((t) => {
    if (filterProject !== "all" && t._projectId !== filterProject) return false
    if (filterTag !== "all" && !(t.tags ?? []).some((tag) => tag.id === filterTag)) return false
    if (filterWorker !== "all" && !t.assignedTo.includes(filterWorker)) return false
    if (filterCoordinator !== "all") {
      const proj = projects.find((p) => p.id === t._projectId)
      if (proj?.coordinatorId !== filterCoordinator) return false
    }
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by status
  const tasksByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = filteredTasks.filter((t) => t.status === status)
    return acc
  }, {} as Record<TaskStatus, typeof filteredTasks>)

  // KPI counts
  const kpis = {
    total: filteredTasks.length,
    enCurso: filteredTasks.filter((t) => t.status === "en_curso").length,
    bloqueadas: filteredTasks.filter((t) => t.status === "bloqueado" || t.status === "retrasado").length,
    paraRevision: filteredTasks.filter((t) => t.status === "listo_para_revision").length,
    finalizadas: filteredTasks.filter((t) => t.status === "finalizado").length,
  }

  function handleToggleTask(taskId: string) {
    setExpandedTaskId((prev) => prev === taskId ? null : taskId)
  }

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const details = body?.details?.fieldErrors
        const firstDetail = details ? Object.values(details).flat()[0] : null
        toast.error(firstDetail ?? body?.error ?? "Error al crear tarea")
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
      toast.success(`Tarea #${newTask.correlativeId} creada`)
      setShowCreate(false)
      setCreateForm({ name: "", description: "", projectId: "", assignedTo: [], tagIds: [] })
    } catch {
      toast.error("Error al crear tarea")
    } finally {
      setCreateLoading(false)
    }
  }

  const tagsForSelectedProject = availableTags.filter(
    (t) => t.projectId === null || t.projectId === createForm.projectId
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gestión de Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Supervisión global · {projects.length} proyectos · {allTasks.length} tareas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva tarea
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", filterStatus === "all" && "ring-2 ring-primary/30")}
          onClick={() => setFilterStatus("all")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{kpis.total}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md border-blue-200 dark:border-blue-900", filterStatus === "en_curso" && "ring-2 ring-blue-400/50")}
          onClick={() => setFilterStatus(filterStatus === "en_curso" ? "all" : "en_curso")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis.enCurso}</span>
            </div>
            <p className="text-xs text-muted-foreground">En Curso</p>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md border-red-200 dark:border-red-900", (filterStatus === "bloqueado" || filterStatus === "retrasado") && "ring-2 ring-red-400/50")}
          onClick={() => setFilterStatus(filterStatus === "bloqueado" ? "all" : "bloqueado")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{kpis.bloqueadas}</span>
            </div>
            <p className="text-xs text-muted-foreground">Bloqueadas / Retrasadas</p>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md border-violet-200 dark:border-violet-900", filterStatus === "listo_para_revision" && "ring-2 ring-violet-400/50")}
          onClick={() => setFilterStatus(filterStatus === "listo_para_revision" ? "all" : "listo_para_revision")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-4 w-4 text-violet-500" />
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{kpis.paraRevision}</span>
            </div>
            <p className="text-xs text-muted-foreground">Para revisión</p>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md border-emerald-200 dark:border-emerald-900", filterStatus === "finalizado" && "ring-2 ring-emerald-400/50")}
          onClick={() => setFilterStatus(filterStatus === "finalizado" ? "all" : "finalizado")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.finalizadas}</span>
            </div>
            <p className="text-xs text-muted-foreground">Finalizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarea..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCoordinator} onValueChange={setFilterCoordinator}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Coordinador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {coordinators.map((c) => <SelectItem key={c.id} value={c.id}>{c.name.split(" ")[0]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterWorker} onValueChange={setFilterWorker}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Trabajador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name.split(" ")[0]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {availableTags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterProject !== "all" || filterCoordinator !== "all" || filterWorker !== "all" || filterTag !== "all" || filterStatus !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground"
            onClick={() => { setFilterProject("all"); setFilterCoordinator("all"); setFilterWorker("all"); setFilterTag("all"); setFilterStatus("all"); setSearch("") }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Task board */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
            <FolderKanban className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No hay tareas que coincidan con los filtros</p>
          </div>
        ) : (
          STATUS_ORDER.map((status) => (
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
          ))
        )}
      </div>

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
                  {projects.filter((p) => p.status === "Activo").map((p) => (
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
                {workersForForm.map((w) => {
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
            <Button onClick={handleCreateTask} disabled={createForm.name.trim().length < 3 || !createForm.projectId || createLoading}>
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
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  )
}
