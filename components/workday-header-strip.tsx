"use client"

import { useState } from "react"
import { Play, Square, Users, UtensilsCrossed, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { TimerStatus } from "@/lib/types"
import { useTimer } from "@/lib/contexts/timer-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { cn } from "@/lib/utils"

interface WorkdayHeaderStripProps {
  basePath?: string
  className?: string
}

const STATUS_STYLES: Record<TimerStatus, { label: string; tone: string; dot: string }> = {
  trabajando: {
    label: "Trabajando",
    tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  colacion: {
    label: "Colación",
    tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  pausado: {
    label: "Pausado",
    tone: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  reunion: {
    label: "Reunión",
    tone: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  finalizado: {
    label: "Finalizado",
    tone: "border-border bg-muted/70 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  inactivo: {
    label: "Sin iniciar",
    tone: "border-border bg-muted/70 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
}

function getTimerDisplay(status: TimerStatus, values: {
  elapsedWorkSeconds: number
  elapsedLunchSeconds: number
  elapsedPauseSeconds: number
  elapsedMeetingSeconds: number
  formatTime: (seconds: number) => string
}) {
  if (status === "colacion") return values.formatTime(values.elapsedLunchSeconds)
  if (status === "reunion") return values.formatTime(values.elapsedMeetingSeconds)
  return values.formatTime(values.elapsedWorkSeconds)
}

// ── Botón de inicio de jornada ───────────────────────────────────────────────
function JornadaStartButton({ className }: { className?: string }) {
  const { user } = useAuth()
  const router = useRouter()

  function handleStart() {
    const destination = user?.role === "admin"
      ? "/admin/tareas"
      : user?.role === "coordinador"
        ? "/coordinador/tareas"
        : "/trabajador/tareas"

    router.push(destination)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 rounded-xl px-3 text-xs", className)}
      onClick={handleStart}
    >
      <Zap className="h-3.5 w-3.5 text-primary" />
      <span className="hidden sm:inline">Ir a jornada</span>
    </Button>
  )
}

// ── Strip principal ───────────────────────────────────────────────────────────
export function WorkdayHeaderStrip({ className }: WorkdayHeaderStripProps) {
  const [isEndingDay, setIsEndingDay] = useState(false)
  const {
    status,
    elapsedWorkSeconds,
    elapsedLunchSeconds,
    elapsedMeetingSeconds,
    formatTime,
    startLunch,
    endLunch,
    startMeeting,
    endMeeting,
    endDay,
  } = useTimer()

  const config = STATUS_STYLES[status] ?? STATUS_STYLES.inactivo
  const isActive = status !== "inactivo" && status !== "finalizado"
  const displayTime = getTimerDisplay(status, {
    elapsedWorkSeconds,
    elapsedLunchSeconds,
    elapsedPauseSeconds: 0,
    elapsedMeetingSeconds,
    formatTime,
  })

  async function handleEndDay() {
    setIsEndingDay(true)
    try {
      await endDay()
    } finally {
      setIsEndingDay(false)
    }
  }

  // ── Sin jornada activa ────────────────────────────────────────────
  if (!isActive) {
    return <JornadaStartButton className={className} />
  }

  // ── Jornada activa ────────────────────────────────────────────────
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-2xl border border-border/70 bg-background/90 px-2.5 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75",
      className
    )}>
      {/* Timer pill */}
      <div className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-1.5", config.tone)}>
        <span className={cn("h-2 w-2 rounded-full", config.dot, status === "trabajando" && "animate-pulse")} />
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">{config.label}</span>
          <span className="font-mono text-sm font-bold tabular-nums">{displayTime}</span>
        </div>
      </div>

      {/* Action buttons */}
      <AlertDialog>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar jornada</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a cerrar la jornada actual. Si necesitás dejar notas o revisar el contexto,
              podés ir primero a la vista de tareas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { void handleEndDay() }}
            >
              {isEndingDay ? "Finalizando..." : "Finalizar ahora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

        <div className="flex items-center gap-1.5">
          {status === "trabajando" ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5" onClick={startLunch}>
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Colación</span>
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5" onClick={startMeeting}>
                <Users className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Reunión</span>
              </Button>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5">
                  <Square className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Finalizar</span>
                </Button>
              </AlertDialogTrigger>
            </>
          ) : null}

          {status === "colacion" ? (
            <Button type="button" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5" onClick={endLunch}>
              <Play className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Volver</span>
            </Button>
          ) : null}

          {status === "reunion" ? (
            <>
              <Button type="button" size="sm" className="h-8 gap-1.5 rounded-xl bg-indigo-600 px-2.5 hover:bg-indigo-700" onClick={endMeeting}>
                <Users className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Cerrar reunión</span>
              </Button>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5">
                  <Square className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Finalizar</span>
                </Button>
              </AlertDialogTrigger>
            </>
          ) : null}
        </div>
      </AlertDialog>
    </div>
  )
}
