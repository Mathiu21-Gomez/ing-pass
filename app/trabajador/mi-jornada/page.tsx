"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { projectsApi, usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, User, DaySchedule } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Play,
  Pause,
  Square,
  Clock,
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronsUpDown,
  Camera,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UtensilsCrossed,
  Users,
  Coffee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ImageUpload } from "@/components/image-upload"
import { CommentSection } from "@/components/comment-section"
import type { Comment, Task, ImageAttachment } from "@/lib/types"

// ── Task change entry (for logging task switches during the day) ──
interface TaskChange {
  id: string
  projectId: string
  taskId: string
  taskName: string
  projectName: string
  switchedAt: string
}

export default function MiJornadaPage() {
  const { user } = useAuth()
  const {
    status,
    elapsedWorkSeconds,
    startDay,
    pauseWork,
    resumeWork,
    endDay,
    startLunch,
    endLunch,
    startMeeting,
    endMeeting,
    formatTime,
    showAutoEndDialog,
    dismissAutoEndDialog,
    continueAsExtra,
    isExtraTime,
    setScheduleEndTime,
  } = useTimer()

  const fetchProjects = useCallback(() => projectsApi.getAll(), [])
  const fetchUsers = useCallback(() => usersApi.getAll(), [])
  const { data: allProjects } = useApiData(fetchProjects, [] as Project[])
  const { data: allUsers } = useApiData(fetchUsers, [] as User[])

  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [expandedProject, setExpandedProject] = useState(false)
  const [taskChanges, setTaskChanges] = useState<TaskChange[]>([])
  const [localComments, setLocalComments] = useState<Comment[]>([])

  // Pre-start fields
  const [preStartScreenshot, setPreStartScreenshot] = useState<ImageAttachment[]>([])
  const [preStartNotes, setPreStartNotes] = useState("")
  const [showTaskChangeDialog, setShowTaskChangeDialog] = useState(false)
  const [newTaskId, setNewTaskId] = useState("")

  // End day dialog
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [endNotes, setEndNotes] = useState("")
  const [endProgress, setEndProgress] = useState("50")
  const [endJustification, setEndJustification] = useState("")

  // Filter projects assigned to this worker
  const userId = user?.id ?? "u2"
  const assignedProjects = useMemo(() => allProjects.filter(
    (p) => p.assignedWorkers.includes(userId) && p.status === "Activo"
  ), [allProjects, userId])

  const selectedProject = allProjects.find((p) => p.id === selectedProjectId)
  const selectedTask = selectedProject?.tasks.find((t) => t.id === selectedTaskId)

  // Available tasks for the selected project (open tasks only)
  const availableTasks = selectedProject?.tasks.filter((t) => t.status !== "cerrada") ?? []

  // Timer display
  const timerDisplay = formatTime(elapsedWorkSeconds)

  // ─── Start workday ─────────────────
  function handleStart() {
    if (!selectedProjectId || !selectedTaskId) {
      toast.error("Selecciona un proyecto y tarea antes de iniciar")
      return
    }
    const task = selectedProject?.tasks.find((t) => t.id === selectedTaskId)
    setTaskChanges([{
      id: `tc_${Date.now()}`,
      projectId: selectedProjectId,
      taskId: selectedTaskId,
      taskName: task?.name ?? "",
      projectName: selectedProject?.name ?? "",
      switchedAt: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    }])
    startDay(selectedProjectId, selectedTaskId, user?.id)
    toast.success("Jornada iniciada")
  }

  // ─── Change task without stopping timer ─────
  function handleTaskChange() {
    if (!newTaskId || newTaskId === selectedTaskId) {
      setShowTaskChangeDialog(false)
      return
    }
    const task = selectedProject?.tasks.find((t) => t.id === newTaskId)
    setTaskChanges((prev) => [...prev, {
      id: `tc_${Date.now()}`,
      projectId: selectedProjectId,
      taskId: newTaskId,
      taskName: task?.name ?? "",
      projectName: selectedProject?.name ?? "",
      switchedAt: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    }])
    setSelectedTaskId(newTaskId)
    setShowTaskChangeDialog(false)
    setNewTaskId("")
    toast.success("Tarea cambiada — timer sigue corriendo")
  }

  // ─── End day ────────────────────────
  function handleEndDay() {
    endDay()
    setShowEndDialog(false)
    toast.success("Jornada finalizada")
  }

  function handleAddComment(comment: Comment) {
    if (!selectedTask) return
    const withParent = { ...comment, parentType: "task" as const, parentId: selectedTask.id }
    setLocalComments((prev) => [...prev, withParent])
    toast.success("Comentario agregado")
  }

  function getTaskComments(taskId: string) {
    return localComments.filter((c) => c.parentType === "task" && c.parentId === taskId)
  }

  const isWorking = status === "trabajando" || status === "colacion" || status === "pausado" || status === "reunion"
  const canStart = status === "inactivo" || status === "finalizado"

  // Set schedule end time for auto-finalize
  useEffect(() => {
    if (!user?.id || allUsers.length === 0) return
    const me = allUsers.find((u) => u.id === user.id)
    if (!me?.weeklySchedule?.length) return
    // JS getDay: 0=Sun 1=Mon ... 6=Sat → our schema: 0=Mon ... 6=Sun
    const jsDay = new Date().getDay()
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1
    const todaySchedule = me.weeklySchedule.find((d) => d.dayOfWeek === dayIdx)
    if (todaySchedule?.isWorkingDay) {
      setScheduleEndTime(todaySchedule.endTime)
    }
  }, [user?.id, allUsers, setScheduleEndTime])

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi Jornada</h1>
        <p className="text-sm text-muted-foreground">
          {isWorking
            ? `Trabajando en ${selectedProject?.name ?? "proyecto"}`
            : "Selecciona un proyecto y tarea para comenzar tu jornada"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══════════════════ LEFT: Timer + Controls ═══════════════ */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Timer card */}
          <Card className="card-hover overflow-hidden">
            <div className={cn(
              "h-1.5 transition-all",
              status === "trabajando" ? "bg-emerald-500 animate-pulse" :
                status === "colacion" ? "bg-amber-500" :
                  status === "pausado" ? "bg-orange-500" :
                    status === "reunion" ? "bg-indigo-500" : "bg-muted"
            )} />
            <CardContent className="pt-6 pb-5 flex flex-col items-center gap-4">
              <p className={cn(
                "font-mono text-5xl font-bold tabular-nums tracking-tight",
                status === "trabajando" ? "text-emerald-500" :
                  status === "colacion" ? "text-amber-500" :
                    status === "pausado" ? "text-orange-500" :
                      status === "reunion" ? "text-indigo-500" : "text-muted-foreground"
              )}>
                {timerDisplay}
              </p>

              {isExtraTime && status !== "finalizado" && status !== "inactivo" && (
                <Badge variant="outline" className="text-amber-600 border-amber-500 animate-pulse">
                  ⏱ Tiempo extra
                </Badge>
              )}

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {canStart && (
                  <Button
                    onClick={handleStart}
                    disabled={!selectedProjectId || !selectedTaskId}
                    className="gap-1.5"
                    size="sm"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar Jornada
                  </Button>
                )}
                {status === "trabajando" && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={startLunch}>
                      <UtensilsCrossed className="h-4 w-4" />
                      Colación
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={pauseWork}>
                      <Coffee className="h-4 w-4" />
                      Pausa
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-700 dark:hover:bg-indigo-950" onClick={startMeeting}>
                      <Users className="h-4 w-4" />
                      Reunión
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setShowEndDialog(true)}>
                      <Square className="h-4 w-4" />
                      Finalizar Día
                    </Button>
                  </>
                )}
                {status === "pausado" && (
                  <>
                    <Button size="sm" className="gap-1.5" onClick={resumeWork}>
                      <Play className="h-4 w-4" />
                      Reanudar
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setShowEndDialog(true)}>
                      <Square className="h-4 w-4" />
                      Finalizar Día
                    </Button>
                  </>
                )}
                {status === "colacion" && (
                  <Button size="sm" className="gap-1.5" onClick={endLunch}>
                    <Play className="h-4 w-4" />
                    Volver al trabajo
                  </Button>
                )}
                {status === "reunion" && (
                  <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700" onClick={endMeeting}>
                    <Play className="h-4 w-4" />
                    Finalizar Reunión
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Project & Task selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Proyecto y Tarea
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Proyecto</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={(val) => { setSelectedProjectId(val); setSelectedTaskId(""); setExpandedProject(false) }}
                  disabled={isWorking}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tarea</Label>
                <Select
                  value={selectedTaskId}
                  onValueChange={setSelectedTaskId}
                  disabled={!selectedProjectId || isWorking}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar tarea" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Task change button (only while working) */}
              {isWorking && availableTasks.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs mt-1"
                  onClick={() => { setNewTaskId(""); setShowTaskChangeDialog(true) }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Cambiar tarea
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pre-start info (only before starting) */}
          {canStart && selectedProjectId && selectedTaskId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  Información pre-inicio
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Captura de pantalla (opcional)</Label>
                  <ImageUpload onImagesChange={setPreStartScreenshot} maxImages={2} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Notas de inicio</Label>
                  <Textarea
                    value={preStartNotes}
                    onChange={(e) => setPreStartNotes(e.target.value)}
                    placeholder="Ej: Continuaré con los cálculos del sector norte..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task changes log */}
          {taskChanges.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ChevronsUpDown className="h-4 w-4 text-primary" />
                  Cambios de tarea hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  {taskChanges.map((tc, i) => (
                    <div key={tc.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md", i === taskChanges.length - 1 && "bg-primary/5")}>
                      <span className="text-[10px] text-muted-foreground font-mono w-10 shrink-0">{tc.switchedAt}</span>
                      <span className="text-xs truncate">{tc.taskName}</span>
                      {i === taskChanges.length - 1 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20 ml-auto shrink-0">
                          actual
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ═══════════════████ RIGHT: Project Detail ═══════════════ */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {selectedProject ? (
            <>
              {/* Project overview */}
              <Card className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{selectedProject.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{selectedProject.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {selectedProject.stage}
                      </Badge>
                      <button
                        onClick={() => setExpandedProject(!expandedProject)}
                        className="rounded-md p-1 hover:bg-muted transition-colors"
                      >
                        {expandedProject ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Progress */}
                  {(() => {
                    const totalAct = selectedProject.tasks.reduce((s, t) => s + t.activities.length, 0)
                    const compAct = selectedProject.tasks.reduce((s, t) => s + t.activities.filter((a) => a.completed).length, 0)
                    const progress = totalAct > 0 ? Math.round((compAct / totalAct) * 100) : 0
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Avance del proyecto</span>
                          <span className="text-xs font-bold text-primary">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-[10px] text-muted-foreground mt-1">{compAct}/{totalAct} actividades completadas</p>
                      </div>
                    )
                  })()}

                  {/* Expanded info */}
                  {expandedProject && (
                    <div className="flex flex-col gap-4 pt-2 border-t border-border animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Coordinador</p>
                          <p className="text-xs font-medium">
                            {allUsers.find((u: User) => u.id === selectedProject.coordinatorId)?.name?.split(" ").slice(0, 2).join(" ") ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Periodo</p>
                          <p className="text-xs font-medium">
                            {new Date(selectedProject.startDate).toLocaleDateString("es-CL", { month: "short", year: "2-digit" })} – {new Date(selectedProject.endDate).toLocaleDateString("es-CL", { month: "short", year: "2-digit" })}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Equipo</p>
                          <p className="text-xs font-medium">{selectedProject.assignedWorkers.length} personas</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Tareas</p>
                          <p className="text-xs font-medium">
                            {selectedProject.tasks.filter((t) => t.status === "cerrada").length}/{selectedProject.tasks.length} completadas
                          </p>
                        </div>
                      </div>

                      {/* Documents */}
                      {selectedProject.documents.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Documentos</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedProject.documents.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-border px-2.5 py-1.5 text-xs">
                                📄 {doc.name} <span className="text-muted-foreground">({doc.sizeBytes})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* All tasks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-primary" />
                    Tareas del proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {selectedProject.tasks.map((task) => {
                      const tAct = task.activities.length
                      const tComp = task.activities.filter((a) => a.completed).length
                      const tProg = tAct > 0 ? Math.round((tComp / tAct) * 100) : 0
                      const isCurrentTask = task.id === selectedTaskId && isWorking
                      const taskCommentCount = getTaskComments(task.id).length

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "rounded-lg border transition-all",
                            isCurrentTask
                              ? "border-primary/30 bg-primary/5 shadow-sm"
                              : "border-border bg-card hover:bg-muted/30"
                          )}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            {task.status === "cerrada" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : task.status === "pendiente_aprobacion" ? (
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium truncate", task.status === "cerrada" && "line-through text-muted-foreground")}>
                                  {task.name}
                                </span>
                                {isCurrentTask && (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary shrink-0">
                                    Actual
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            </div>
                            {taskCommentCount > 0 && <span className="text-[10px] text-muted-foreground shrink-0">{taskCommentCount} 💬</span>}
                            {tAct > 0 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground">{tComp}/{tAct}</span>
                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", tProg === 100 ? "bg-emerald-500" : "bg-primary")}
                                    style={{ width: `${tProg}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Activities */}
                          {task.activities.length > 0 && (
                            <div className="px-3 pb-2.5 flex flex-col gap-0.5 ml-7">
                              {task.activities.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 py-0.5">
                                  {a.completed ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                  ) : (
                                    <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                  )}
                                  <span className={cn("text-xs", a.completed ? "text-muted-foreground line-through" : "text-foreground/80")}>
                                    {a.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Comments for current task */}
              {selectedTask && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Comentarios — {selectedTask.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CommentSection
                      comments={getTaskComments(selectedTask.id)}
                      onAddComment={handleAddComment}
                      currentUserId={userId}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Selecciona un proyecto para ver su información</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Task Change Dialog ──────────── */}
      <Dialog open={showTaskChangeDialog} onOpenChange={setShowTaskChangeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Cambiar tarea
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">El timer seguirá corriendo. Solo cambia la tarea activa.</p>
          <Select value={newTaskId} onValueChange={setNewTaskId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Seleccionar nueva tarea" />
            </SelectTrigger>
            <SelectContent>
              {availableTasks
                .filter((t) => t.id !== selectedTaskId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTaskChangeDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleTaskChange} disabled={!newTaskId}>Cambiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── End Day Dialog ──────────── */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-4 w-4 text-destructive" />
              Finalizar Jornada
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Notas de cierre</Label>
              <Textarea
                value={endNotes}
                onChange={(e) => setEndNotes(e.target.value)}
                placeholder="Resumen de lo que hiciste hoy..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Avance de la tarea (%)</Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={endProgress}
                onChange={(e) => setEndProgress(e.target.value)}
                className="w-full accent-primary"
              />
              <p className="text-xs text-center font-semibold text-primary">{endProgress}%</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Justificación</Label>
              <Textarea
                value={endJustification}
                onChange={(e) => setEndJustification(e.target.value)}
                placeholder="Describe qué queda pendiente o por qué el avance es este..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEndDay}>Finalizar Jornada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Auto-end dialog — schedule time reached ═══ */}
      <Dialog open={showAutoEndDialog} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Hora de salida alcanzada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Tu horario programado ha terminado. ¿Deseas finalizar tu jornada o continuar trabajando como tiempo extra?
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Si continúas, el tiempo adicional se registrará como hora extra y podrás editarlo en el historial.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={continueAsExtra} className="gap-1.5">
              <Play className="h-4 w-4" />
              Continuar (Extra)
            </Button>
            <Button variant="destructive" onClick={dismissAutoEndDialog} className="gap-1.5">
              <Square className="h-4 w-4" />
              Finalizar Jornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
