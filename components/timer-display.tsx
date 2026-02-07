"use client"

import { useTimer } from "@/lib/contexts/timer-context"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle } from "lucide-react"

const EIGHT_HOURS = 8 * 60 * 60
const ONE_HOUR = 60 * 60

export function TimerDisplay() {
  const {
    status,
    elapsedWorkSeconds,
    elapsedLunchSeconds,
    elapsedPauseSeconds,
    hourlyProgress,
    formatTime
  } = useTimer()

  const progress = Math.min((elapsedWorkSeconds / EIGHT_HOURS) * 100, 100)
  const circumference = 2 * Math.PI * 120
  const currentHour = Math.floor(elapsedWorkSeconds / ONE_HOUR)

  const statusConfig: Record<string, { color: string; ring: string; bg: string; label: string }> = {
    trabajando: {
      color: "text-emerald-500",
      ring: "stroke-emerald-500",
      bg: "bg-emerald-500/5",
      label: "Trabajando",
    },
    colacion: {
      color: "text-amber-500",
      ring: "stroke-amber-500",
      bg: "bg-amber-500/5",
      label: "En Colación",
    },
    pausado: {
      color: "text-orange-500",
      ring: "stroke-orange-500",
      bg: "bg-orange-500/5",
      label: "Pausado",
    },
    finalizado: {
      color: "text-muted-foreground",
      ring: "stroke-muted-foreground",
      bg: "bg-muted",
      label: "Jornada Finalizada",
    },
    inactivo: {
      color: "text-muted-foreground",
      ring: "stroke-muted",
      bg: "bg-muted/50",
      label: "Sin iniciar",
    },
  }

  const config = statusConfig[status] ?? statusConfig.inactivo

  const displayTime =
    status === "colacion"
      ? formatTime(elapsedLunchSeconds)
      : status === "pausado"
        ? formatTime(elapsedPauseSeconds)
        : formatTime(elapsedWorkSeconds)

  // Generate hour markers (1-8)
  const hourMarkers = Array.from({ length: 8 }, (_, i) => i + 1)

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6 rounded-2xl p-8 transition-all duration-500",
        config.bg,
        status === "trabajando" && "ring-2 ring-emerald-500/20"
      )}
    >
      {/* Circular timer */}
      <div className={cn("relative", status === "trabajando" && "animate-ring-pulse")}>
        <svg width="280" height="280" className="-rotate-90" aria-hidden="true">
          <circle
            cx="140"
            cy="140"
            r="120"
            fill="none"
            strokeWidth="8"
            className="stroke-border"
          />
          <circle
            cx="140"
            cy="140"
            r="120"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(
              config.ring,
              "transition-all duration-1000",
              status === "trabajando" && "timer-glow-active"
            )}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono text-5xl font-bold tracking-tight",
              config.color,
              status === "trabajando" && "animate-pulse-soft"
            )}
          >
            {displayTime}
          </span>
          <span className={cn("mt-1 text-sm font-medium", config.color)}>
            {config.label}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {Math.round(progress)}% de la jornada
          </span>
          {status === "colacion" && (
            <span className="mt-1 text-xs text-muted-foreground">
              Trabajo: {formatTime(elapsedWorkSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Trabajado</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatTime(elapsedWorkSeconds)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Colación</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatTime(elapsedLunchSeconds)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Restante</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatTime(Math.max(EIGHT_HOURS - elapsedWorkSeconds, 0))}
          </p>
        </div>
      </div>

      {/* Hourly Progress Timeline */}
      {status !== "inactivo" && (
        <div className="w-full max-w-md mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
            Historial de Avance
          </p>

          {/* Hour markers timeline */}
          <div className="flex items-center justify-between px-2 mb-3">
            {hourMarkers.map((hour) => {
              const progressEntry = hourlyProgress.find(p => p.hour === hour)
              const isPast = hour <= currentHour
              const isCurrent = hour === currentHour + 1

              return (
                <div key={hour} className="flex flex-col items-center">
                  {progressEntry ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : isPast ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500/50" />
                  ) : isCurrent ? (
                    <div className="relative">
                      <Circle className="h-5 w-5 text-primary animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    </div>
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/30" />
                  )}
                  <span className={cn(
                    "text-[10px] mt-1",
                    progressEntry ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : isPast ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  )}>
                    {hour}h
                  </span>
                </div>
              )
            })}
          </div>

          {/* Progress line */}
          <div className="relative h-1 bg-muted rounded-full overflow-hidden mx-2">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-1000"
              style={{ width: `${Math.min((currentHour / 8) * 100, 100)}%` }}
            />
          </div>

          {/* Recent progress entries */}
          {hourlyProgress.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[120px] overflow-y-auto">
              {hourlyProgress.slice(-3).map((entry) => (
                <div
                  key={entry.hour}
                  className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-3 py-2"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.hour}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-2">
                      {entry.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {entry.timestamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} • {entry.percentage}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
