"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Clock,
  Bell,
  Pin,
  Plus,
  Megaphone,
  CalendarDays,
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  Users,
  ClipboardList,
  Play,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

interface AppEvent {
  id: string
  title: string
  content: string
  type: "evento" | "comunicado"
  eventDate: string | null
  targetRoles: string[]
  pinned: boolean
  createdAt: string
}

interface MyTask {
  id: string
  name: string
  status: string
  correlativeId: number
  tags: { id: string; name: string; color: string }[]
}

interface PendingAlert {
  id: string
  message: string
  alertAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  esperando_info: "Esperando info",
  bloqueado: "Bloqueado",
  listo_para_revision: "Para revisión",
  finalizado: "Finalizado",
  retrasado: "Retrasado",
}

const STATUS_STYLE: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  en_curso: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  esperando_info: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  bloqueado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  listo_para_revision: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  finalizado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  retrasado: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
}

const TIMER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  trabajando: { label: "Trabajando", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  colacion: { label: "En Colación", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  pausado: { label: "Pausado", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  reunion: { label: "En Reunión", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  finalizado: { label: "Jornada Finalizada", color: "bg-muted text-muted-foreground border-border" },
  inactivo: { label: "Sin iniciar", color: "bg-muted text-muted-foreground border-border" },
}

export default function CoordinadorHomePage() {
  const { user } = useAuth()
  const { status, elapsedWorkSeconds, formatTime, startDay } = useTimer()

  const [events, setEvents] = useState<AppEvent[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>([])
  const [loading, setLoading] = useState(true)

  const [showStartDialog, setShowStartDialog] = useState(false)
  const [startProjects, setStartProjects] = useState<{ id: string; name: string }[]>([])
  const [startTasks, setStartTasks] = useState<{ id: string; name: string }[]>([])
  const [startProjectId, setStartProjectId] = useState("")
  const [startTaskId, setStartTaskId] = useState("")
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)

  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [eventForm, setEventForm] = useState({
    title: "",
    content: "",
    type: "comunicado",
    eventDate: "",
    targetRoles: [] as string[],
    pinned: false,
  })
  const [saving, setSaving] = useState(false)

  const fetchHomeData = useCallback(async () => {
    try {
      const res = await fetch("/api/home")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events ?? [])
      setMyTasks(data.myTasks ?? [])
      setPendingAlerts(data.pendingAlerts ?? [])
    } catch {
      toast.error("Error al cargar datos de inicio")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHomeData() }, [fetchHomeData])

  async function handleOpenStartDialog() {
    setShowStartDialog(true)
    setLoadingProjects(true)
    try {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStartProjects(data)
    } catch {
      toast.error("Error al cargar proyectos")
    } finally {
      setLoadingProjects(false)
    }
  }

  async function handleStartProjectChange(projectId: string) {
    setStartProjectId(projectId)
    setStartTaskId("")
    setLoadingTasks(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStartTasks(data)
    } catch {
      toast.error("Error al cargar tareas")
    } finally {
      setLoadingTasks(false)
    }
  }

  function handleStartDay() {
    if (!startProjectId || !startTaskId) {
      toast.error("Seleccioná proyecto y tarea")
      return
    }
    startDay(startProjectId, startTaskId, user?.id)
    setShowStartDialog(false)
    setStartProjectId("")
    setStartTaskId("")
  }

  async function handleCreateEvent() {
    if (!eventForm.title.trim()) { toast.error("El título es requerido"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventForm),
      })
      if (!res.ok) throw new Error()
      const newEvent = await res.json()
      setEvents((prev) => [newEvent, ...prev])
      setShowCreateEvent(false)
      setEventForm({ title: "", content: "", type: "comunicado", eventDate: "", targetRoles: [], pinned: false })
      toast.success("Comunicado publicado")
    } catch {
      toast.error("Error al publicar")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setEvents((prev) => prev.filter((e) => e.id !== id))
      toast.success("Eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  async function handleTogglePin(ev: AppEvent) {
    try {
      const res = await fetch(`/api/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !ev.pinned }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)))
    } catch {
      toast.error("Error al actualizar")
    }
  }

  const timerConfig = TIMER_STATUS_CONFIG[status] ?? TIMER_STATUS_CONFIG.inactivo
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  })()

  const activeTasks = myTasks.filter((t) => !["finalizado"].includes(t.status))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Button onClick={() => setShowCreateEvent(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo comunicado
        </Button>
      </div>

      {pendingAlerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
            Tenés {pendingAlerts.length} alerta{pendingAlerts.length > 1 ? "s" : ""} pendiente{pendingAlerts.length > 1 ? "s" : ""}.
          </p>
          <Link href="/coordinador/tareas" className="ml-auto text-xs text-orange-600 dark:text-orange-400 underline underline-offset-2 font-medium">
            Ver tareas
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Jornada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", timerConfig.color)}>
                {timerConfig.label}
              </span>
              <p className="text-xs text-muted-foreground">
                {status === "inactivo" || status === "finalizado" ? "No hay jornada activa." : "Tiempo de trabajo efectivo."}
              </p>
              {(status === "inactivo" || status === "finalizado") ? (
                <Button onClick={handleOpenStartDialog} className="gap-1.5 w-full" size="sm">
                  <Play className="h-4 w-4" />
                  Iniciar jornada
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className={cn("font-mono text-3xl font-bold tabular-nums", timerConfig.color)}>
                    {formatTime(elapsedWorkSeconds)}
                  </p>
                  <Link href="/coordinador/mi-jornada">
                    <Button size="sm" variant="outline" className="gap-1.5 w-full">
                      <Timer className="h-4 w-4" />
                      Ir a Mi Jornada
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Mis tareas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Activas</span>
                <span className="font-semibold">{activeTasks.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Finalizadas</span>
                <span className="font-semibold">{myTasks.filter((t) => t.status === "finalizado").length}</span>
              </div>
              <Link href="/coordinador/tareas">
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Ir a Tareas
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {activeTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Mis tareas activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                      <span className="text-xs font-mono text-muted-foreground">#{task.correlativeId}</span>
                      <span className="flex-1 text-sm font-medium truncate">{task.name}</span>
                      <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium", STATUS_STYLE[task.status])}>
                        {STATUS_LABEL[task.status] ?? task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Novedades y comunicados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay comunicados publicados.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((ev) => (
                    <div key={ev.id} className={cn("rounded-xl border p-4 space-y-1.5", ev.pinned ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {ev.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                          <span className="font-semibold text-sm truncate">{ev.title}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {ev.type === "evento" ? "Evento" : "Comunicado"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleTogglePin(ev)} className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteEvent(ev.id)} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {ev.content && <p className="text-sm text-muted-foreground">{ev.content}</p>}
                      <div className="flex items-center gap-3 pt-1">
                        {ev.eventDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(ev.eventDate).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(ev.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Start day dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar jornada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Proyecto</Label>
              <Select value={startProjectId} onValueChange={handleStartProjectChange} disabled={loadingProjects}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProjects ? "Cargando..." : "Seleccioná un proyecto"} />
                </SelectTrigger>
                <SelectContent>
                  {startProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tarea</Label>
              <Select value={startTaskId} onValueChange={setStartTaskId} disabled={!startProjectId || loadingTasks}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTasks ? "Cargando..." : !startProjectId ? "Primero elegí un proyecto" : "Seleccioná una tarea"} />
                </SelectTrigger>
                <SelectContent>
                  {startTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancelar</Button>
            <Button onClick={handleStartDay} disabled={!startProjectId || !startTaskId}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo comunicado / evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título del comunicado" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={eventForm.type} onValueChange={(v) => setEventForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comunicado">Comunicado</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Textarea value={eventForm.content} onChange={(e) => setEventForm((p) => ({ ...p, content: e.target.value }))} placeholder="Descripción..." rows={3} />
            </div>
            {eventForm.type === "evento" && (
              <div className="space-y-1.5">
                <Label>Fecha del evento</Label>
                <Input type="date" value={eventForm.eventDate} onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pinned2" checked={eventForm.pinned} onChange={(e) => setEventForm((p) => ({ ...p, pinned: e.target.checked }))} className="rounded" />
              <Label htmlFor="pinned2" className="cursor-pointer">Fijar en la portada</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEvent(false)}>Cancelar</Button>
            <Button onClick={handleCreateEvent} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
