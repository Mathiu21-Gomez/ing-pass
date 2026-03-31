"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import type { Task, TaskStatus, Project, User, Tag, Activity } from "@/lib/types"
import { ChatPanel } from "@/components/chat-panel"
import { SharedLinksPanel } from "@/components/shared-links-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Bell,
  X,
  AlertCircle,
  Clock,
  CheckCheck,
  Loader2,
  MessageSquare,
  FolderKanban,
  CalendarDays,
  Flag,
  ListTodo,
  Users,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
type WorkerTaskTab = "detalles" | "progreso" | "chat"

function TaskDetailPanel({
  task,
  allUsers,
  isOpen,
  defaultTab = "detalles",
  onStatusChange,
}: {
  task: ExtendedTask
  allUsers: User[]
  isOpen: boolean
   defaultTab?: WorkerTaskTab
  onStatusChange: (taskId: string, status: TaskStatus) => void
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [newActivityName, setNewActivityName] = useState("")
  const [addingActivity, setAddingActivity] = useState(false)
  const [showAlarm, setShowAlarm] = useState(false)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [mentionableUsers, setMentionableUsers] = useState<{ id: string; name: string }[]>([])

  const assignedUsers = allUsers.filter((u) => task.assignedTo?.includes(u.id))

  useEffect(() => {
    if (!isOpen) return
    fetch(`/api/tasks/${task.id}/mentionable`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMentionableUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [isOpen, task.id])

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
    }
  }, [defaultTab, isOpen, task.id])

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

  async function handleAddActivity() {
    if (!newActivityName.trim()) return
    setAddingActivity(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newActivityName.trim() }),
      })
      if (!res.ok) throw new Error()
      const created: Activity = await res.json()
      setActivities((prev) => [...prev, created])
      setNewActivityName("")
    } catch {
      toast.error("Error al agregar paso")
    } finally {
      setAddingActivity(false)
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
        <div className="rounded-2xl border border-border bg-card mx-1 mb-3 mt-1 shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <div className="border-b border-border px-4 pt-3">
              <TabsList className="h-9 gap-1 bg-transparent p-0">
                <TabsTrigger
                  value="detalles"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  Detalles
                </TabsTrigger>
                <TabsTrigger
                  value="progreso"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <ListTodo className="h-3.5 w-3.5 mr-1.5" />
                  Progreso
                  {activities.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {completedCount}/{activities.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Chat
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Detalles ── */}
            <TabsContent value="detalles" className="p-4 space-y-4 m-0">
              {/* Proyecto + alarma */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/8 border border-primary/20 px-2.5 py-1.5">
                  <FolderKanban className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">{task._projectName}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={() => setShowAlarm((v) => !v)}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Alarma
                </Button>
              </div>

              {showAlarm && (
                <AlarmForm taskId={task.id} onClose={() => setShowAlarm(false)} />
              )}

              {/* Info del proyecto */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  <FolderKanban className="h-3.5 w-3.5" />
                  {task._projectName}
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(new Date(task.dueDate), "d MMM yyyy", { locale: es })}
                  </div>
                )}
                {assignedUsers.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {assignedUsers.map((u) => u.name.split(" ")[0]).join(", ")}
                  </div>
                )}
              </div>

              {/* Descripción */}
              {task.description && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
                  <div className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </div>
                </div>
              )}

              {/* Pautas */}
              {task.guidelines && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pautas</p>
                  <div className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {task.guidelines}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} />
                  ))}
                </div>
              )}

              {/* Documentos compartidos */}
              <div className="pt-1 border-t border-border/40">
                <SharedLinksPanel apiBase={`/api/tasks/${task.id}`} />
              </div>
            </TabsContent>

            {/* ── Progreso ── */}
            <TabsContent value="progreso" className="p-4 space-y-4 m-0">
              {activities.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{completedCount} de {activities.length} completados</span>
                    <span className="font-semibold text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 rounded-full" />
                </div>
              )}

              {activitiesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((act) => (
                    <button
                      key={act.id}
                      onClick={() => handleToggleActivity(act.id, !act.completed)}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        act.completed
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-border bg-muted/30 hover:bg-muted/60"
                      )}
                    >
                      {act.completed
                        ? <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 shrink-0 text-emerald-500" />
                        : <Circle className="h-4.5 w-4.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      }
                      <span className={cn(
                        "text-sm leading-snug",
                        act.completed ? "line-through text-muted-foreground" : "text-foreground"
                      )}>
                        {act.name}
                      </span>
                    </button>
                  ))}

                </div>
              )}
            </TabsContent>

            {/* ── Chat ── */}
            <TabsContent value="chat" className="p-4 m-0">
              {isOpen && (
                <ChatPanel
                  taskId={task.id}
                  useTaskChat={true}
                  mentionableUsers={mentionableUsers}
                  title="Chat del equipo"
                  placeholder="Escribí un mensaje... (@ para mencionar)"
                  allowImages={true}
                  className="border-0 rounded-xl"
                />
              )}
            </TabsContent>
          </Tabs>
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
  onStatusChange,
}: {
  task: ExtendedTask
  isExpanded: boolean
  defaultTab?: WorkerTaskTab
  allUsers: User[]
  onToggle: () => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
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
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                #{task.correlativeId}
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
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {format(new Date(task.dueDate), "d MMM", { locale: es })}
              </span>
            )}
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
        onStatusChange={onStatusChange}
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const handledTargetRef = useRef<string | null>(null)
  const handledNotificationRef = useRef<string | null>(null)

  const requestedTaskId = searchParams.get("task")
  const requestedNotificationId = searchParams.get("notification")
  const requestedTab: WorkerTaskTab =
    searchParams.get("tab") === "chat" ? "chat" : "detalles"

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
    setExpandedId(requestedTaskId)
  }, [loading, requestedTaskId, requestedTab, tasks])

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error("Error al actualizar estado")
      fetchData()
    }
  }

  // ── Filtered tasks ──
  const filtered = tasks.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterProjectId !== "all" && t._projectId !== filterProjectId) return false
    return true
  })

  // ── Group by status ──
  const grouped = (Object.keys(STATUS_CONFIG) as TaskStatus[])
    .sort((a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order)
    .map((status) => ({
      status,
      tasks: filtered.filter((t) => t.status === status),
    }))
    .filter((g) => g.tasks.length > 0)

  const activeCount = tasks.filter((t) => t.status !== "finalizado").length
  const completedCount = tasks.filter((t) => t.status === "finalizado").length

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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 page-enter">
      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Mis Tareas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} activa{activeCount !== 1 ? "s" : ""} · {completedCount} finalizada{completedCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="pl-9 h-9 bg-muted border-0 rounded-xl"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              filterStatus === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            Todas
          </button>
          {(["en_curso", "pendiente", "retrasado", "listo_para_revision"] as TaskStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
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

      {/* ── Project filter (if multiple projects) ── */}
      {projects.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterProjectId("all")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              filterProjectId === "all"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            Todos los proyectos
          </button>
          {projects
            .filter((p) => tasks.some((t) => t._projectId === p.id))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setFilterProjectId(filterProjectId === p.id ? "all" : p.id)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                  filterProjectId === p.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                <FolderKanban className="h-3 w-3" />
                {p.name}
              </button>
            ))}
        </div>
      )}

      {/* ── Task list ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <CheckCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {search || filterStatus !== "all" || filterProjectId !== "all"
              ? "No hay tareas que coincidan con los filtros"
              : "No tenés tareas asignadas aún"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ status, tasks: groupTasks }) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className="space-y-2">
                {/* Group header */}
                <div className="flex items-center gap-2 px-1">
                  <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", cfg.color)}>
                    {cfg.icon}
                    {cfg.label}
                  </div>
                  <span className={cn(
                    "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    cfg.bg, cfg.color
                  )}>
                    {groupTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isExpanded={expandedId === task.id}
                      defaultTab={requestedTaskId === task.id ? requestedTab : "detalles"}
                      allUsers={allUsers}
                      onToggle={() => setExpandedId((id) => id === task.id ? null : task.id)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
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
