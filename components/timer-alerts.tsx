"use client"

import { useState } from "react"
import { useTimer } from "@/lib/contexts/timer-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { UtensilsCrossed, AlertTriangle, CheckCircle2, Clock } from "lucide-react"

export function TimerAlerts() {
  const {
    showLunchAlert,
    showEndWarning,
    showDaySummary,
    showProgressPrompt,
    pendingHourMilestone,
    hourlyProgress,
    startLunch,
    dismissLunchAlert,
    dismissEndWarning,
    dismissDaySummary,
    recordHourlyProgress,
    dismissProgressPrompt,
    elapsedWorkSeconds,
    elapsedLunchSeconds,
    formatTime,
    startTime,
  } = useTimer()

  const [progressDescription, setProgressDescription] = useState("")

  const handleRecordProgress = () => {
    recordHourlyProgress(progressDescription)
    setProgressDescription("")
  }

  const handleDismissProgress = () => {
    dismissProgressPrompt()
    setProgressDescription("")
  }

  return (
    <>
      {/* Hourly Progress Prompt */}
      <AlertDialog open={showProgressPrompt} onOpenChange={(open) => !open && handleDismissProgress()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-7 w-7 text-primary" />
            </div>
            <AlertDialogTitle className="text-center">
              ¡Hora {pendingHourMilestone} completada!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Has trabajado {pendingHourMilestone} {pendingHourMilestone === 1 ? "hora" : "horas"}.
              Describe brevemente tu avance para mantener un registro de tu progreso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Ej: Terminé la revisión de documentos, avancé en el reporte mensual..."
              value={progressDescription}
              onChange={(e) => setProgressDescription(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Progreso: {pendingHourMilestone ? Math.round((pendingHourMilestone / 8) * 100) : 0}% de la jornada
            </p>
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleRecordProgress}
              className="w-full"
            >
              Guardar Avance
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDismissProgress}
              className="w-full border border-border bg-transparent text-foreground hover:bg-accent"
            >
              Omitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lunch Break Alert */}
      <AlertDialog open={showLunchAlert} onOpenChange={(open) => !open && dismissLunchAlert()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <UtensilsCrossed className="h-7 w-7 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-center">
              Hora de tu colación
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Has cumplido 4 horas de trabajo continuo. Es obligatorio tomar tu pausa de colación de 1 hora.
              Confirma que inicias tu descanso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => {
                startLunch()
              }}
              className="w-full bg-amber-500 text-white hover:bg-amber-600"
            >
              Iniciar Colación
            </AlertDialogAction>
            <AlertDialogAction
              onClick={dismissLunchAlert}
              className="w-full border border-border bg-transparent text-foreground hover:bg-accent"
            >
              Continuar trabajando (no recomendado)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Warning */}
      <AlertDialog open={showEndWarning} onOpenChange={(open) => !open && dismissEndWarning()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">
              Jornada por finalizar
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Quedan menos de 5 minutos para completar las 8 horas de trabajo efectivo.
              <strong className="block mt-2">Guarda todos tus avances antes de que la sesión se cierre automáticamente.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissEndWarning} className="w-full">
              Entendido, guardaré mis avances
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Day Summary */}
      <AlertDialog open={showDaySummary} onOpenChange={(open) => !open && dismissDaySummary()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <AlertDialogTitle className="text-center">
              Jornada Completada
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hora inicio</span>
                <span className="text-sm font-medium text-foreground">
                  {startTime ? startTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hora fin</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Horas efectivas</span>
                <span className="text-sm font-bold text-emerald-500">
                  {formatTime(elapsedWorkSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tiempo colación</span>
                <span className="text-sm font-medium text-foreground">
                  {formatTime(elapsedLunchSeconds)}
                </span>
              </div>
              {hourlyProgress.length > 0 && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <span className="text-sm text-muted-foreground">Avances registrados:</span>
                    <ul className="mt-2 space-y-1">
                      {hourlyProgress.map((p) => (
                        <li key={p.hour} className="text-xs text-foreground">
                          <span className="font-medium">Hora {p.hour}:</span> {p.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissDaySummary} className="w-full">
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
