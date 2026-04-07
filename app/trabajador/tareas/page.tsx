"use client"

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import type { Task, TaskStatus, Project, User, Tag, Activity } from "@/lib/types"
import { ChatPanel } from "@/components/chat-panel"
import { TaskOperationalHistory } from "@/components/task-operational-history"
import { SharedLinksPanel } from "@/components/shared-links-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  TaskShellBoard,
  TaskShellDetailGrid,
  TaskShellHeader,
  TaskShellMetaGrid,
  TaskShellMetaItem,
  TaskShellPanel,
  TaskShellStatCard,
} from "@/components/task-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  ChevronDown,
  CheckCircle2,
  Circle,
  Bell,
  AlertCircle,
  Clock,
  CheckCheck,
  Loader2,
  FolderKanban,
  CalendarDays,
  ListTodo,
  Pencil,
  Users,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TASK_SORT_DIRECTION,
  DEFAULT_TASK_SORT_KEY,
  DEFAULT_TASK_VIEW,
  filterTasksByView,
  getStatusesForView,
  getTaskViewForStatus,
  groupTasksByStatus,
  sortTasks,
  TASK_SORT_LABELS,
  TASK_VIEW_LABELS,
  type TaskSortDirection,
  type TaskSortKey,
  type TaskView,
} from "@/lib/task-board"
import { formatCorrelativeId, isTaskOverdue } from "@/lib/task-display"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, {
  label: string
  color: string
  bg: string
  border: string
  dot: string
  icon: React.ReactNode
  order: number
}> = {
  en_curso:            { label: "En Curso",        color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",   dot: "bg-blue-500",    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, order: 1 },
  pendiente:           { label: "Pendiente",        color: "text-slate-600 dark:text-slate-400",  bg: "bg-slate-500/10",   border: "border-slate-400/30",  dot: "bg-slate-400",   icon: <Circle className="h-3.5 w-3.5" />,               order: 2 },
  retrasado:           { label: "Retrasado",        color: "text-red-600 dark:text-red-400",      bg: "bg-red-500/10",     border: "border-red-500/30",    dot: "bg-red-500",     icon: <AlertCircle className="h-3.5 w-3.5" />,          order: 3 },
  bloqueado:           { label: "Bloqueado",        color: "text-orange-600 dark:text-orange-400",bg: "bg-orange-500/10",  border: "border-orange-500/30", dot: "bg-orange-500",  icon: <AlertCircle className="h-3.5 w-3.5" />,          order: 4 },
  esperando_info:      { label: "Esperando info",   color: "text-yellow-600 dark:text-yellow-400",bg: "bg-yellow-500/10",  border: "border-yellow-500/30", dot: "bg-yellow-500",  icon: <Clock className="h-3.5 w-3.5" />,                order: 5 },
  listo_para_revision: { label: "Para revisión",   color: "text-violet-600 dark:text-violet-400",bg: "bg-violet-500/10",  border: "border-violet-500/30", dot: "bg-violet-500",  icon: <CheckCircle2 className="h-3.5 w-3.5" />,         order: 6 },
  finalizado:          { label: "Finalizado",       color: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-500/10",border: "border-emerald-500/30",dot: "bg-emerald-500", icon: <CheckCheck className="h-3.5 w-3.5" />,           order: 7 },
}

const WORKER_STORAGE_KEY = "task-board:trabajador"

const AVATAR_COLORS = ["bg-blue-500","bg-violet-500","bg-rose-500","bg-amber-500","bg-emerald-500","bg-cyan-500"]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

// ── Helpers ────────────────────────────────────────────────────────────────

function PriorityDots({ priority }: { priority: number }) {
  const level = priority >= 75 ? 3 : priority >= 40 ? 2 : priority > 0 ? 1 : 0
  const color = level === 3 ? "bg-red-500" : level === 2 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= level ? color : "bg-slate-200 dark:bg-slate-700")} />
      ))}
    </div>
  )
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  )
}

// ── Alert form (inline) ────────────────────────────────────────────────────

function AlarmForm({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [alertDate, setAlertDate] = useState("")
  const [alertTime, setAlertTime] = useState("09:00")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!alertDate) { toast.error("Seleccioná una fecha"); return }
    setSaving(true)
    try {
      const alertAt = new Date(`${alertDate}T${alertTime}:00`)
      const res = await fetch(`/api/tasks/${taskId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertAt: alertAt.toISOString(), message }),
      })
      if (!res.ok) throw new Error()
      toast.success("Alarma configurada")
      onClose()
    } catch {
      toast.error("Error al configurar alarma")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <Bell className="h-4 w-4 text-amber-500" />
        Configurar alarma
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fecha</Label>
          <Input type="date" value={alertDate} onChange={(e) => setAlertDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Hora</Label>
          <Input type="time" value={alertTime} onChange={(e) => setAlertTime(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Mensaje (opcional)</Label>
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Recordatorio..." className="h-8 text-xs" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}

// ── Task Detail Panel ──────────────────────────────────────────────────────

type ExtendedTask = Task & { _projectName: string; _projectId: string }
type WorkerTaskTab = "detalles" | "chat"

function TaskDetailPanel({
  task,
  allUsers,
  isOpen,
  defaultTab: _defaultTab = "detalles",
  onTaskUpdate,
}: {
  task: ExtendedTask
  allUsers: User[]
  isOpen: boolean
  defaultTab?: WorkerTaskTab
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [showAlarm, setShowAlarm] = useState(false)
  const [editingGuidelines, setEditingGuidelines] = useState(false)
  const [guidelinesValue, setGuidelinesValue] = useState(task.guidelines ?? "")
  const [savingGuidelines, setSavingGuidelines] = useState(false)
  const [mentionableUsers, setMentionableUsers] = useState<{ id: string; name: string }[]>([])

  const assignedUsers = allUsers.filter((u) => task.assignedTo?.includes(u.id))
  const cfg = STATUS_CONFIG[task.status]

  useEffect(() => {
    if (!isOpen) return
    fetch(`/api/tasks/${task.id}/mentionable`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMentionableUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [isOpen, task.id])

  useEffect(() => {
    setGuidelinesValue(task.guidelines ?? "")
  }, [task.guidelines, task.id])

  const completedCount = activities.filter((a) => a.completed).length
  const progress = activities.length > 0 ? Math.round((completedCount / activities.length) * 100) : 0

  const fetchActivities = useCallback(async () => {
    if (!isOpen) return
    setActivitiesLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/activities`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setActivities(data)
    } catch {
      // silent
    } finally {
      setActivitiesLoading(false)
    }
  }, [task.id, isOpen])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  async function handleToggleActivity(actId: string, completed: boolean) {
    setActivities((prev) =>
      prev.map((a) => (a.id === actId ? { ...a, completed } : a))
    )
    try {
      await fetch(`/api/activities/${actId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })
    } catch {
      setActivities((prev) =>
        prev.map((a) => (a.id === actId ? { ...a, completed: !completed } : a))
      )
    }
  }

  async function handleSaveGuidelines() {
    if (savingGuidelines) return

    setSavingGuidelines(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: guidelinesValue }),
      })

      if (!res.ok) throw new Error()

      onTaskUpdate(task.id, { guidelines: guidelinesValue })
      setEditingGuidelines(false)
      toast.success("Pautas actualizadas")
    } catch {
      toast.error("Error al actualizar pautas")
    } finally {
      setSavingGuidelines(false)
    }
  }

  return (
    <div
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div className="mx-1 mb-3 mt-1 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">{formatCorrelativeId(task._projectName, task.correlativeId)}</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium", cfg.color, cfg.bg, cfg.border)}>
              {cfg.icon}
              {cfg.label}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{task._projectName}</span>
            <div className="ml-auto flex items-center gap-2">
              {activities.length > 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/35 px-3 py-1">
                  <div className="w-20">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{progress}%</span>
                </div>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20"
                onClick={() => setShowAlarm((value) => !value)}
              >
                <Bell className="h-3.5 w-3.5" />
                Alarma
              </Button>
            </div>
          </div>

          <div className="p-4">
            {showAlarm ? <div className="mb-4"><AlarmForm taskId={task.id} onClose={() => setShowAlarm(false)} /></div> : null}

            <TaskShellDetailGrid
              info={
                <TaskShellPanel
                  title="Informacion de tarea"
                  description="Contexto, responsables, fechas, documentos y pautas operativas."
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs"
                      onClick={() => {
                        setGuidelinesValue(task.guidelines ?? "")
                        setEditingGuidelines((value) => !value)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {editingGuidelines ? "Cerrar" : task.guidelines ? "Editar pautas" : "Agregar pautas"}
                    </Button>
                  }
                >
                  <div className="space-y-5">
                    <TaskShellMetaGrid>
                      <TaskShellMetaItem icon={FolderKanban} label="Proyecto" value={task._projectName} />
                      <TaskShellMetaItem
                        icon={CalendarDays}
                        label="Inicio"
                        value={format(new Date(task.createdAt), "d MMM yyyy", { locale: es })}
                      />
                      <TaskShellMetaItem
                        icon={CalendarDays}
                        label="Entrega"
                        value={task.dueDate ? format(new Date(task.dueDate), "d MMM yyyy", { locale: es }) : "Sin fecha comprometida"}
                      />
                      <TaskShellMetaItem
                        icon={Users}
                        label="Asignado"
                        value={assignedUsers.length > 0 ? assignedUsers.map((userItem) => userItem.name.split(" ").slice(0, 2).join(" ")).join(", ") : "Sin asignacion activa"}
                      />
                    </TaskShellMetaGrid>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Descripcion</p>
                      <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {task.description || <span className="italic text-muted-foreground">Sin descripcion</span>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Pautas</p>
                      {editingGuidelines ? (
                        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-3">
                          <Textarea
                            value={guidelinesValue}
                            onChange={(e) => setGuidelinesValue(e.target.value)}
                            rows={4}
                            className="text-sm"
                            placeholder="Agrega contexto o instrucciones de seguimiento..."
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setGuidelinesValue(task.guidelines ?? "")
                                setEditingGuidelines(false)
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button type="button" size="sm" onClick={() => void handleSaveGuidelines()} disabled={savingGuidelines}>
                              {savingGuidelines ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                          {task.guidelines || <span className="italic text-muted-foreground">Sin pautas</span>}
                        </div>
                      )}
                    </div>

                    {task.tags && task.tags.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Etiquetas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {task.tags.map((tag) => (
                            <TagPill key={tag.id} tag={tag} />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Documentos</p>
                        {(task.documents?.length ?? 0) > 0 ? (
                          <div className="space-y-2">
                            {task.documents.map((document) => (
                              <div key={document.id} className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-foreground">
                                {document.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                            Sin documentos adjuntos en la tarea.
                          </div>
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
                  description={activities.length > 0 ? `${completedCount} de ${activities.length} pasos completados.` : "Todavia no hay pasos definidos para esta tarea."}
                >
                  <div className="space-y-4">
                    {activities.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">Avance operativo</span>
                          <span className="font-semibold text-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 rounded-full" />
                      </div>
                    ) : null}

                    {activitiesLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : activities.length > 0 ? (
                      <div className="space-y-2">
                        {activities.map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => handleToggleActivity(act.id, !act.completed)}
                            className={cn(
                              "group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                              act.completed
                                ? "border-emerald-500/20 bg-emerald-500/5"
                                : "border-border bg-muted/30 hover:bg-muted/60"
                            )}
                          >
                            {act.completed ? (
                              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            )}
                            <span className={cn("text-sm leading-snug", act.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                              {act.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                        Sin pasos definidos.
                      </div>
                    )}
                  </div>
                </TaskShellPanel>
              }
              history={
                <TaskShellPanel
                  title="Historial operativo"
                  description="Rastro resumido del contexto real de ejecucion sin mezclarlo con el chat."
                >
                  <TaskOperationalHistory taskId={task.id} />
                </TaskShellPanel>
              }
              conversation={
                <TaskShellPanel title="Conversacion" description="Chat operativo del equipo y seguimiento contextual de la tarea.">
                  <ChatPanel
                    taskId={task.id}
                    useTaskChat={true}
                    mentionableUsers={mentionableUsers}
                    title="Chat del equipo"
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
    </div>
  )
}

// ── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  isExpanded,
  defaultTab,
  allUsers,
  onToggle,
  onTaskUpdate,
}: {
  task: ExtendedTask
  isExpanded: boolean
  defaultTab?: WorkerTaskTab
  allUsers: User[]
  onToggle: () => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
}) {
  const cfg = STATUS_CONFIG[task.status]
  const assignedUsers = allUsers.filter((u) => task.assignedTo?.includes(u.id))

  return (
    <div className={cn(
      "group rounded-2xl border bg-card transition-all duration-200",
      isExpanded ? "border-primary/30 shadow-md shadow-primary/5" : "border-border hover:border-border/80 hover:shadow-sm"
    )}>
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-4 flex items-start gap-3"
      >
        {/* Status dot accent */}
        <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-card", cfg.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono font-semibold shrink-0 bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
                {formatCorrelativeId(task._projectName, task.correlativeId)}
              </span>
              <span className={cn(
                "font-semibold text-sm text-foreground truncate",
                task.status === "finalizado" && "line-through text-muted-foreground"
              )}>
                {task.name}
              </span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5",
              isExpanded && "rotate-180"
            )} />
          </div>

          {/* Middle row: project + due date + priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              cfg.color, cfg.bg, cfg.border
            )}>
              {cfg.icon}
              {cfg.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              {task._projectName}
            </span>
            {task.dueDate && (() => {
              const overdue = isTaskOverdue(task)
              return (
                <span className={cn(
                  "flex items-center gap-1 text-[11px]",
                  overdue ? "text-red-500 font-medium" : "text-muted-foreground"
                )}>
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(task.dueDate), "d MMM", { locale: es })}
                  {overdue && <span className="text-[9px] font-semibold uppercase tracking-wide">· vencida</span>}
                </span>
              )
            })()}
            <div className="flex items-center gap-1 ml-auto">
              <PriorityDots priority={task.priority} />
              {assignedUsers.length > 0 && (
                <div className="flex items-center -space-x-1.5 ml-2">
                  {assignedUsers.slice(0, 3).map((u) => (
                    <div
                      key={u.id}
                      title={u.name}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-card",
                        avatarColor(u.name)
                      )}
                    >
                      {getInitials(u.name)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
            </div>
          )}
        </div>
      </button>

      {/* Expandable detail panel */}
      <TaskDetailPanel
        task={task}
        allUsers={allUsers}
        isOpen={isExpanded}
        defaultTab={defaultTab}
        onTaskUpdate={onTaskUpdate}
      />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

function WorkerTasksPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const [tasks, setTasks] = useState<ExtendedTask[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all")
  const [filterProjectId, setFilterProjectId] = useState<string>("all")
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set())
  const [currentView, setCurrentView] = useState<TaskView>(DEFAULT_TASK_VIEW)
  const [sortKey, setSortKey] = useState<TaskSortKey>(DEFAULT_TASK_SORT_KEY)
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>(DEFAULT_TASK_SORT_DIRECTION)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const handledTargetRef = useRef<string | null>(null)
  const handledNotificationRef = useRef<string | null>(null)

  const requestedTaskId = searchParams.get("task")
  const requestedNotificationId = searchParams.get("notification")
  const requestedTab: WorkerTaskTab =
    searchParams.get("tab") === "chat" ? "chat" : "detalles"

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(WORKER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        view: TaskView
        sortKey: TaskSortKey
        sortDirection: TaskSortDirection
      }>

      if (parsed.view) setCurrentView(parsed.view)
      if (parsed.sortKey) setSortKey(parsed.sortKey)
      if (parsed.sortDirection) setSortDirection(parsed.sortDirection)
    } catch {
      window.localStorage.removeItem(WORKER_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    window.localStorage.setItem(
      WORKER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        view: currentView,
        sortKey,
        sortDirection,
      })
    )
  }, [currentView, sortDirection, sortKey])

  useEffect(() => {
    const allowedStatuses = new Set(getStatusesForView(currentView))
    if (filterStatus !== "all" && !allowedStatuses.has(filterStatus)) {
      setFilterStatus("all")
    }
  }, [currentView, filterStatus])

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

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/users/mentionable"),
      ])
      const [tasksData, usersData] = await Promise.all([
        tasksRes.ok ? tasksRes.json() : [],
        usersRes.ok ? usersRes.json() : [],
      ])

      // /api/tasks returns tasks with projectName and assignedTo already resolved
      type RawTask = Task & { projectName: string }
      const extended: ExtendedTask[] = (tasksData as RawTask[]).map((t) => ({
        ...t,
        _projectName: t.projectName ?? "Proyecto",
        _projectId: t.projectId,
      }))

      // Derive unique projects list from tasks for the filter pills
      const projectMap = new Map<string, string>()
      extended.forEach((t) => projectMap.set(t._projectId, t._projectName))
      const derivedProjects: Project[] = [...projectMap.entries()].map(([id, name]) => ({
        id,
        name,
      } as Project))

      setTasks(extended)
      setAllUsers(usersData)
      setProjects(derivedProjects)
    } catch {
      toast.error("Error al cargar tareas")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (loading || !requestedTaskId) {
      if (!requestedTaskId) handledTargetRef.current = null
      return
    }

    const targetTask = tasks.find((task) => task.id === requestedTaskId)
    if (!targetTask) return

    const navigationKey = `${requestedTaskId}:${requestedTab}`
    if (handledTargetRef.current === navigationKey) return

    handledTargetRef.current = navigationKey
    setSearch("")
    setFilterStatus("all")
    setFilterProjectId("all")
    setFilterTags(new Set())
    setCurrentView(getTaskViewForStatus(targetTask.status))
    setExpandedId(requestedTaskId)
  }, [loading, requestedTaskId, requestedTab, tasks])

  function handleTaskUpdate(taskId: string, updates: Partial<Task>) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)))
  }

  // ── Filtered tasks ──
  const allTaskTags = useMemo(() => {
    const tagMap = new Map<string, { id: string; name: string; color: string }>()
    tasks.forEach((task) => (task.tags ?? []).forEach((tag) => tagMap.set(tag.id, tag)))
    return [...tagMap.values()]
  }, [tasks])

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (search && !task.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterStatus !== "all" && task.status !== filterStatus) return false
      if (filterProjectId !== "all" && task._projectId !== filterProjectId) return false
      if (filterTags.size > 0 && !(task.tags ?? []).some((tag) => filterTags.has(tag.id))) return false
      return true
    })
  }, [filterProjectId, filterStatus, filterTags, search, tasks])

  const viewStatuses = useMemo(() => getStatusesForView(currentView), [currentView])
  const visibleTasks = useMemo(() => {
    return sortTasks(filterTasksByView(filtered, currentView), sortKey, sortDirection)
  }, [currentView, filtered, sortDirection, sortKey])

  const grouped = useMemo(() => {
    return groupTasksByStatus(visibleTasks, viewStatuses)
  }, [viewStatuses, visibleTasks])

  const activeCount = useMemo(() => filterTasksByView(tasks, "active").length, [tasks])
  const reviewCount = useMemo(() => filterTasksByView(tasks, "review").length, [tasks])
  const completedCount = useMemo(() => filterTasksByView(tasks, "completed").length, [tasks])
  const historyCount = useMemo(() => filterTasksByView(tasks, "history").length, [tasks])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-56 rounded skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-5">
      <TaskShellHeader
        eyebrow="Mis tareas"
        title="Tareas"
        description={`${activeCount} activa${activeCount === 1 ? "" : "s"}, ${reviewCount} en revisión y ${completedCount} finalizada${completedCount === 1 ? "" : "s"}.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TaskShellStatCard label="Activas" value={activeCount} icon={ListTodo} tone="info" active={currentView === "active"} onClick={() => { setCurrentView("active"); setFilterStatus("all") }} />
        <TaskShellStatCard label="Revisión" value={reviewCount} icon={CheckCircle2} tone="warning" active={currentView === "review"} onClick={() => { setCurrentView("review"); setFilterStatus("all") }} />
        <TaskShellStatCard label="Finalizadas" value={completedCount} icon={CheckCheck} tone="success" active={currentView === "completed"} onClick={() => { setCurrentView("completed"); setFilterStatus("all") }} />
        <TaskShellStatCard label="Historial" value={historyCount} icon={BookOpen} tone="default" active={currentView === "history"} onClick={() => { setCurrentView("history"); setFilterStatus("all") }} />
      </div>

      <TaskShellPanel title="Filtros">
        <div className="space-y-3">
          {/* View tabs + search + sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(["active", "review", "completed", "history"] as TaskView[]).map((view) => {
                const count = view === "active" ? activeCount : view === "review" ? reviewCount : view === "completed" ? completedCount : historyCount
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => { setCurrentView(view); setFilterStatus("all") }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      currentView === view ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {TASK_VIEW_LABELS[view]} · {count}
                  </button>
                )
              })}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarea..." className="h-9 rounded-xl pl-9 text-sm" />
            </div>
          </div>

          {/* Sort + status pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as TaskSortKey)}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-xs"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_SORT_LABELS) as TaskSortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>{TASK_SORT_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as TaskSortDirection)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascendente</SelectItem>
                <SelectItem value="desc">Descendente</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-all", filterStatus === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
              >
                Todas
              </button>
              {viewStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    filterStatus === s
                      ? cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color, "border", STATUS_CONFIG[s].border)
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter chips */}
          {allTaskTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {allTaskTags.map((tag) => {
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
          ) : null}

          {/* Project pills */}
          {projects.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterProjectId("all")}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-all", filterProjectId === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent")}
              >
                Todos
              </button>
              {projects.filter((project) => tasks.some((task) => task._projectId === project.id)).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setFilterProjectId(filterProjectId === project.id ? "all" : project.id)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all", filterProjectId === project.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent")}
                >
                  <FolderKanban className="h-3 w-3" />
                  {project.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </TaskShellPanel>

      <TaskShellBoard>
        {visibleTasks.length === 0 ? (
          <TaskShellPanel title="Sin tareas visibles" description={search || filterStatus !== "all" || filterProjectId !== "all" ? "No hay tareas que coincidan con los filtros actuales." : "Todavía no tenés tareas asignadas."}>
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <CheckCheck className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Ajustá la vista o esperá nuevas asignaciones para continuar.</p>
            </div>
          </TaskShellPanel>
        ) : grouped.length > 0 ? (
          grouped.map(({ status, tasks: groupTasks }) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <TaskShellPanel
                key={status}
                title={cfg.label}
                description={`${groupTasks.length} tarea${groupTasks.length !== 1 ? "s" : ""} en esta etapa.`}
                actions={<span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", cfg.bg, cfg.color)}>{groupTasks.length}</span>}
              >
                <div className="space-y-2">
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isExpanded={expandedId === task.id}
                      defaultTab={requestedTaskId === task.id ? requestedTab : "detalles"}
                      allUsers={allUsers}
                      onToggle={() => setExpandedId((id) => (id === task.id ? null : task.id))}
                      onTaskUpdate={handleTaskUpdate}
                    />
                  ))}
                </div>
              </TaskShellPanel>
            )
          })
        ) : (
          <TaskShellPanel title={TASK_VIEW_LABELS[currentView]} description="No hay tareas en esta vista con los filtros actuales.">
            <div className="py-4 text-sm text-muted-foreground">Movete a otra vista o relajá los filtros para recuperar tareas.</div>
          </TaskShellPanel>
        )}
      </TaskShellBoard>
    </div>
  )
}

export default function WorkerTasksPage() {
  return (
    <Suspense>
      <WorkerTasksPageContent />
    </Suspense>
  )
}
