"use client"

import { useState } from "react"
import { useTimer } from "@/lib/contexts/timer-context"
import { useAuth } from "@/lib/contexts/auth-context"
import type { TimeEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  UtensilsCrossed,
  Clock,
  TrendingUp,
  CheckCircle2,
  Play,
  Square,
  AlertCircle,
} from "lucide-react"

export function TimerAlerts() {
  const {
    showLunchAlert,
    dismissLunchAlert,
    startLunch,
    showEndWarning,
    dismissEndWarning,
    showProgressPrompt,
    pendingHourMilestone,
    recordHourlyProgress,
    dismissProgressPrompt,
    showAutoEndDialog,
    dismissAutoEndDialog,
    continueAsExtra,
    showDaySummary,
    sessionEntries,
    dismissDaySummary,
    formatTime,
    elapsedWorkSeconds,
    endDay,
  } = useTimer()

  // useAuth is imported for potential future role-aware behaviour
  useAuth()

  const [progressNote, setProgressNote] = useState("")

  return (
    <>
      {/* ─── Lunch Alert ─────────────────────────────────────── */}
      <Dialog open={showLunchAlert} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-amber-500" />
              ¡Hora de almorzar!
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Llevás 4 horas trabajando. Es recomendable tomar un descanso para almorzar.
          </p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={dismissLunchAlert}
            >
              Continuar trabajando
            </Button>
            <Button
              size="sm"
              onClick={() => {
                startLunch()
                dismissLunchAlert()
              }}
            >
              <UtensilsCrossed className="h-3.5 w-3.5 mr-1.5" />
              Tomar colación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── End Warning ─────────────────────────────────────── */}
      <Dialog open={showEndWarning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Pronto finaliza tu jornada
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Te quedan aproximadamente 5 minutos para completar tu jornada de 8 horas.
          </p>
          <DialogFooter>
            <Button size="sm" onClick={dismissEndWarning}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Hourly Progress Prompt ───────────────────────────── */}
      <Dialog open={showProgressPrompt} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {pendingHourMilestone != null
                ? `Hora ${pendingHourMilestone} completada`
                : "Check-in de progreso"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label className="text-xs">¿En qué trabajaste esta última hora?</Label>
            <Textarea
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Describí brevemente lo que hiciste..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProgressNote("")
                dismissProgressPrompt()
              }}
            >
              Omitir
            </Button>
            <Button
              size="sm"
              onClick={() => {
                recordHourlyProgress(progressNote)
                setProgressNote("")
              }}
              disabled={!progressNote.trim()}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Auto-End Dialog ─────────────────────────────────── */}
      <Dialog open={showAutoEndDialog} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Hora de salida alcanzada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Tu horario programado ha terminado. ¿Deseás finalizar tu jornada o continuar trabajando como tiempo extra?
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Si continuás, el tiempo adicional se registrará como hora extra.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={continueAsExtra}
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              Continuar (Extra)
            </Button>
            <Button
              variant="destructive"
              onClick={dismissAutoEndDialog}
              className="gap-1.5"
            >
              <Square className="h-4 w-4" />
              Finalizar Jornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Day Summary ─────────────────────────────────────── */}
      <Dialog open={showDaySummary} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Resumen de jornada
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {/* Total hours worked */}
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <span className="text-sm text-muted-foreground">Tiempo trabajado</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatTime(elapsedWorkSeconds)}
              </span>
            </div>

            {/* Session entries */}
            {sessionEntries.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Registros de sesión ({sessionEntries.length})
                </p>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {sessionEntries.map((entry: TimeEntry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium truncate text-foreground">
                          {entry.projectId.slice(0, 12)}…
                        </span>
                        <span className="text-muted-foreground truncate">
                          {entry.taskId.slice(0, 14)}…
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                        <span className="font-semibold text-foreground">
                          {entry.effectiveHours.toFixed(1)}h
                        </span>
                        <span className="text-muted-foreground">
                          {entry.startTime} — {entry.endTime ?? "..."}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success message */}
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Jornada registrada exitosamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={dismissDaySummary}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
