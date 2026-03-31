"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Pin, Megaphone, CalendarDays, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { WorkdayPanel } from "@/components/workday-panel"
import Link from "next/link"

interface AppEvent {
  id: string
  title: string
  content: string
  type: "evento" | "comunicado"
  eventDate: string | null
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

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  esperando_info: "Esperando info",
  bloqueado: "Bloqueado",
  listo_para_revision: "Para revisión",
  finalizado: "Finalizado",
  retrasado: "Retrasado",
}

const STATUS_DOT: Record<string, string> = {
  pendiente: "bg-slate-400",
  en_curso: "bg-blue-500",
  esperando_info: "bg-yellow-500",
  bloqueado: "bg-red-500",
  listo_para_revision: "bg-purple-500",
  finalizado: "bg-emerald-500",
  retrasado: "bg-orange-500",
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

export default function TrabajadorHomePage() {
  const { user } = useAuth()

  const [events, setEvents] = useState<AppEvent[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHomeData = useCallback(async () => {
    try {
      const res = await fetch("/api/home")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events ?? [])
      setMyTasks(data.myTasks ?? [])
    } catch {
      toast.error("Error al cargar datos de inicio")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHomeData() }, [fetchHomeData])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  })()

  const activeTasks = myTasks.filter((t) => t.status !== "finalizado")

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-56 rounded skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="h-72 rounded-xl skeleton-shimmer" />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="h-40 rounded-xl skeleton-shimmer" />
            <div className="h-32 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 page-enter">

      {/* Header */}
      <div className="space-y-0.5 animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {new Date().toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Main layout: timer izquierda, tareas + novedades derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start stagger-children">

        {/* Jornada — columna izquierda */}
        <div className="lg:col-span-2">
          <WorkdayPanel timerOnly />
        </div>

        {/* Tareas + Novedades — columna derecha */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Tareas activas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tareas activas
                </span>
                {activeTasks.length > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary animate-scale-in">
                    {activeTasks.length}
                  </span>
                )}
              </div>
              <Link
                href="/trabajador/tareas"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                Ver todas
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {activeTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin tareas activas por ahora.
              </p>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden stagger-children">
                {activeTasks.slice(0, 5).map((task, i) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors",
                      i !== 0 && "border-t border-border/40"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full shrink-0 animate-pulse-soft", STATUS_DOT[task.status] ?? "bg-slate-400")} />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      #{task.correlativeId}
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {task.name}
                    </span>
                    <span className={cn("text-[11px] rounded-full px-2 py-0.5 font-medium shrink-0", STATUS_STYLE[task.status])}>
                      {STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Novedades */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Novedades
              </span>
            </div>

            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay novedades por ahora.
              </p>
            ) : (
              <div className="space-y-2 stagger-children">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 space-y-1.5 transition-colors",
                      ev.pinned
                        ? "border-primary/25 bg-primary/5"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ev.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      <span className="font-semibold text-sm text-foreground truncate">{ev.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-auto border-border/50">
                        {ev.type === "evento" ? "Evento" : "Comunicado"}
                      </Badge>
                    </div>
                    {ev.content && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{ev.content}</p>
                    )}
                    <div className="flex items-center gap-3 pt-0.5">
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
          </section>

        </div>
      </div>
    </div>
  )
}
