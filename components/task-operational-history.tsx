"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  Activity,
  AtSign,
  BriefcaseBusiness,
  Loader2,
  MessageSquareText,
  Paperclip,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TaskOperationalHistorySummary } from "@/lib/types"
import { cn } from "@/lib/utils"

const HISTORY_REFRESH_INTERVAL_MS = 15_000

function formatRelativeDate(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: es })
}

function formatWorkerTone(state: TaskOperationalHistorySummary["workerContext"]["state"], matchesCurrentTask: boolean) {
  if (state === "active" && matchesCurrentTask) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (state === "active") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  if (state === "idle") {
    return "border-border/70 bg-muted/30 text-muted-foreground"
  }

  return "border-dashed border-border/70 bg-muted/15 text-muted-foreground"
}

function formatWorkerHeadline(summary: TaskOperationalHistorySummary) {
  const context = summary.workerContext

  if (context.state === "unassigned") {
    return {
      detail: "Todavía no hay responsable activo para esta tarea.",
      label: "Sin responsable asignado",
    }
  }

  if (context.state === "idle") {
    return {
      detail: `${context.workerName} no tiene una jornada activa registrada ahora.`,
      label: "Responsable sin sesión activa",
    }
  }

  if (context.matchesCurrentTask) {
    return {
      detail: `${context.workerName} esta trabajando esta misma tarea${context.startTime ? ` desde ${context.startTime}` : ""}.`,
      label: "Responsable operando esta tarea",
    }
  }

  return {
    detail: `${context.workerName} esta en ${context.currentTaskName ?? "otra tarea"}${context.currentProjectName ? ` · ${context.currentProjectName}` : ""}.`,
    label: "Responsable ocupado en otra tarea",
  }
}

export function TaskOperationalHistory({ taskId }: { taskId: string }) {
  const [data, setData] = useState<TaskOperationalHistorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!cancelled && !hasLoadedOnce.current) {
          setLoading(true)
        }

        const response = await fetch(`/api/tasks/${taskId}/history`, { cache: "no-store" })
        if (!response.ok) throw new Error()

        const payload = (await response.json()) as TaskOperationalHistorySummary

        if (!cancelled) {
          setData(payload)
          setError(null)
          hasLoadedOnce.current = true
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar el historial operativo.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    const intervalId = window.setInterval(() => {
      void load()
    }, HISTORY_REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [taskId])

  const workerHeadline = useMemo(() => {
    if (!data) return null
    return formatWorkerHeadline(data)
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
        {error ?? "No hay historial operativo disponible todavia."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{data.stats.attachmentCount}</span>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Adjuntos</p>
        </div>
        <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{data.stats.mentionCount}</span>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Menciones</p>
        </div>
        <div className="stat-card-accent rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-1.5">
              <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{data.stats.messageCount}</span>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Mensajes</p>
        </div>
      </div>

      <div className={cn("rounded-2xl border px-4 py-3", formatWorkerTone(data.workerContext.state, data.workerContext.matchesCurrentTask))}>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
          <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" /> Contexto del responsable
        </div>
        <p className="text-sm font-semibold text-foreground">{workerHeadline?.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{workerHeadline?.detail}</p>
        {data.workerContext.state === "active" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">{data.workerContext.timerStatus}</Badge>
            {data.workerContext.currentTaskName ? <Badge variant="outline" className="rounded-full">{data.workerContext.currentTaskName}</Badge> : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Actividad reciente</p>
            <p className="text-sm text-muted-foreground">
              {data.lastActivityAt ? `Último movimiento ${formatRelativeDate(data.lastActivityAt)}` : "Todavía no hay movimientos registrados."}
            </p>
          </div>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>

        {data.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {data.recentActivity.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition-colors hover:bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{item.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.actorName} · {formatRelativeDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {item.attachmentCount > 0 ? <Badge variant="outline" className="rounded-full">{item.attachmentCount} adj.</Badge> : null}
                    {item.mentionCount > 0 ? <Badge variant="outline" className="rounded-full">{item.mentionCount} @</Badge> : null}
                  </div>
                </div>
                {item.detail ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            Cuando haya mensajes, adjuntos o menciones, el panel va a mostrar el rastro operativo acá sin mezclarlo con la conversación principal.
          </div>
        )}
      </div>
    </div>
  )
}
