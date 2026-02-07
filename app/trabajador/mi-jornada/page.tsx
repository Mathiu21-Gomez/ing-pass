"use client"

import { useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { mockProjects, mockTimeEntries } from "@/lib/mock-data"
import { TimerDisplay } from "@/components/timer-display"
import { TimerAlerts } from "@/components/timer-alerts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
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
import { Play, Pause, Square, UtensilsCrossed, Coffee, TrendingUp, Save, ArrowRightLeft } from "lucide-react"

export default function MiJornadaPage() {
  const { user } = useAuth()
  const timer = useTimer()
  const [selectedProject, setSelectedProject] = useState("")
  const [selectedTask, setSelectedTask] = useState("")
  const [progressValue, setProgressValue] = useState(0)
  const [progressNote, setProgressNote] = useState("")

  const assignedProjects = mockProjects.filter(
    (p) => p.assignedWorkers.includes(user?.id ?? "") && p.status === "Activo"
  )

  const currentProject = assignedProjects.find((p) => p.id === selectedProject)
  const tasks = currentProject?.tasks ?? []

  // Week entries for this worker
  const weekEntries = mockTimeEntries
    .filter((e) => e.userId === user?.id && e.status === "finalizado")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  function handleStart() {
    if (selectedProject && selectedTask) {
      timer.startDay(selectedProject, selectedTask)
    }
  }

  function handleSaveProgress() {
    if (progressNote.trim()) {
      timer.updateManualProgress(progressValue, progressNote)
      setProgressNote("")
      // Update slider to show new value
      setProgressValue(progressValue)
    }
  }

  // Sync slider with timer state
  const displayProgress = timer.manualProgressPercentage > 0
    ? timer.manualProgressPercentage
    : progressValue

  return (
    <div className="flex flex-col gap-6">
      <TimerAlerts />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi Jornada</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("es-CL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timer - Central */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <TimerDisplay />

              {/* Controls */}
              <div className="mt-6 flex flex-col gap-4">
                {timer.status === "inactivo" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
                        <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedTask("") }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proyecto" />
                          </SelectTrigger>
                          <SelectContent>
                            {assignedProjects.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Tarea</label>
                        <Select value={selectedTask} onValueChange={setSelectedTask} disabled={!selectedProject}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tarea" />
                          </SelectTrigger>
                          <SelectContent>
                            {tasks.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleStart}
                      disabled={!selectedProject || !selectedTask}
                      className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                      size="lg"
                    >
                      <Play className="h-5 w-5" />
                      Iniciar Jornada
                    </Button>
                  </>
                )}

                {timer.status === "trabajando" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <Button
                        onClick={timer.startLunch}
                        variant="outline"
                        className="flex-1 gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 bg-transparent"
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                        Ir a Colación
                      </Button>
                      <Button
                        onClick={timer.pauseWork}
                        variant="outline"
                        className="flex-1 gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400 bg-transparent"
                      >
                        <Coffee className="h-4 w-4" />
                        Pausar
                      </Button>
                      <Button
                        onClick={timer.endDay}
                        variant="outline"
                        className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
                      >
                        <Square className="h-4 w-4" />
                        Finalizar
                      </Button>
                    </div>
                    <Button
                      onClick={timer.openSwitchTaskDialog}
                      variant="ghost"
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Cambiar Proyecto/Tarea
                    </Button>
                  </div>
                )}

                {timer.status === "colacion" && (
                  <Button
                    onClick={timer.endLunch}
                    className="w-full gap-2 bg-amber-500 text-white hover:bg-amber-600"
                    size="lg"
                  >
                    <Play className="h-5 w-5" />
                    Volver de Colación
                  </Button>
                )}

                {timer.status === "pausado" && (
                  <div className="flex gap-3">
                    <Button
                      onClick={timer.resumeWork}
                      className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                      size="lg"
                    >
                      <Play className="h-5 w-5" />
                      Reanudar Trabajo
                    </Button>
                    <Button
                      onClick={timer.endDay}
                      variant="outline"
                      className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
                      size="lg"
                    >
                      <Square className="h-4 w-4" />
                      Finalizar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual Progress Card - Only when working */}
          {timer.status !== "inactivo" && timer.status !== "finalizado" && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Actualizar Avance del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Porcentaje de avance</span>
                    <span className="text-lg font-bold text-foreground">{progressValue}%</span>
                  </div>
                  <Slider
                    value={[progressValue]}
                    onValueChange={(v) => setProgressValue(v[0])}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Nota de avance <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={progressNote}
                    onChange={(e) => setProgressNote(e.target.value)}
                    placeholder="Describe el trabajo realizado para justificar el avance..."
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <Button
                  onClick={handleSaveProgress}
                  disabled={!progressNote.trim()}
                  className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  Guardar Avance
                </Button>

                {/* Progress history */}
                {timer.progressNotes.length > 0 && (
                  <div className="border-t border-border pt-3 mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Historial de avances:</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {timer.progressNotes.slice().reverse().map((note, i) => (
                        <div key={i} className="text-xs rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {note.percentage}%
                            </span>
                            <span className="text-muted-foreground">
                              {note.timestamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-foreground">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel: Current info + Week History */}
        <div className="flex flex-col gap-6">
          {/* Current project/task info */}
          {timer.status !== "inactivo" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trabajando en
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {assignedProjects.find((p) => p.id === timer.currentProjectId)?.name ?? selectedProject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tasks.find((t) => t.id === timer.currentTaskId)?.name
                    ?? assignedProjects
                      .find((p) => p.id === timer.currentProjectId)
                      ?.tasks.find((t) => t.id === timer.currentTaskId)?.name
                    ?? ""}
                </p>
                {timer.manualProgressPercentage > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Avance reportado:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {timer.manualProgressPercentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${timer.manualProgressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
                {timer.pauseCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pausas: {timer.pauseCount}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Week history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Historial reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weekEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin registros anteriores</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {weekEntries.map((entry) => {
                    const project = mockProjects.find((p) => p.id === entry.projectId)
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CL", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {project?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {entry.effectiveHours}h
                          </p>
                          <div className="flex items-center gap-1 justify-end">
                            <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${entry.progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {entry.progressPercentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
