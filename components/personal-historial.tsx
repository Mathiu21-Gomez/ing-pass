"use client"

import { useState, useCallback, Fragment } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { timeEntriesApi, projectsApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Project, TimeEntry } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Clock,
  Calendar,
  Edit3,
  Filter,
  Save,
  X,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusConfig: Record<string, { label: string; className: string }> = {
  trabajando: { label: "Trabajando", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  colacion: { label: "En Colación", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  pausado: { label: "Pausado", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  finalizado: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
  inactivo: { label: "Inactivo", className: "bg-muted text-muted-foreground border-border" },
}

export function PersonalHistorial() {
  const { user } = useAuth()

  const fetchEntries = useCallback(() => timeEntriesApi.getAll(), [])
  const fetchProjects = useCallback(() => projectsApi.getAll(), [])
  const { data: entries, setData: setEntries } = useApiData(fetchEntries, [] as TimeEntry[])
  const { data: allProjects } = useApiData(fetchProjects, [] as Project[])

  const [filterProject, setFilterProject] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Edit state
  const [editNotes, setEditNotes] = useState("")
  const [editProgress, setEditProgress] = useState("")
  const [editJustification, setEditJustification] = useState("")
  const [saving, setSaving] = useState(false)

  // Filter entries for current user
  const userEntries = entries
    .filter((e) => e.userId === (user?.id ?? "u2"))
    .filter((e) => filterProject === "all" || e.projectId === filterProject)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const userProjectIds = [...new Set(entries.filter((e) => e.userId === (user?.id ?? "u2")).map((e) => e.projectId))]
  const userProjects = allProjects.filter((p) => userProjectIds.includes(p.id))
  const totalHours = userEntries.reduce((sum, e) => sum + e.effectiveHours, 0)

  function toggleExpand(entry: TimeEntry) {
    if (expandedId === entry.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(entry.id)
    setEditNotes(entry.notes)
    setEditProgress(String(entry.progressPercentage))
    setEditJustification(entry.progressJustification)
  }

  async function saveEntry(entry: TimeEntry) {
    const newProgress = Math.min(100, Math.max(0, parseInt(editProgress) || entry.progressPercentage))
    setSaving(true)
    try {
      await timeEntriesApi.update(entry.id, {
        notes: editNotes,
        progressPercentage: newProgress,
        progressJustification: editJustification,
      })
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, notes: editNotes, progressPercentage: newProgress, progressJustification: editJustification }
            : e
        )
      )
      toast.success("Registro actualizado")
      setExpandedId(null)
    } catch {
      toast.error("Error al guardar cambios")
    } finally {
      setSaving(false)
    }
  }

  function getProjectName(projectId: string) {
    return allProjects.find((p) => p.id === projectId)?.name ?? projectId
  }

  function getTaskName(taskId: string) {
    for (const p of allProjects) {
      const task = p.tasks.find((t) => t.id === taskId)
      if (task) return task.name
    }
    return taskId
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats subtitle */}
      <p className="text-sm text-muted-foreground -mt-4">
        {userEntries.length} registros · {totalHours.toFixed(1)}h totales
      </p>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[250px] h-9 text-sm">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {userProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {userEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No hay registros</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Proyecto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Tarea</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Horario</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Horas</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Avance</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs w-10"></th>
                </tr>
              </thead>
              <tbody>
                {userEntries.map((entry) => {
                  const sConf = statusConfig[entry.status] ?? statusConfig.inactivo
                  const isExpanded = expandedId === entry.id

                  return (
                    <Fragment key={entry.id}>
                      {/* Main row */}
                      <tr
                        onClick={() => toggleExpand(entry)}
                        className={cn(
                          "border-b border-border/50 cursor-pointer transition-colors select-none",
                          isExpanded
                            ? "bg-primary/5 border-primary/20"
                            : "hover:bg-muted/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium">{formatDate(entry.date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm truncate max-w-[200px] block">{getProjectName(entry.projectId)}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground truncate max-w-[180px] block">{getTaskName(entry.taskId)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-muted-foreground">
                            {entry.startTime} — {entry.endTime ?? "..."}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold">{entry.effectiveHours.toFixed(1)}h</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", entry.progressPercentage === 100 ? "bg-emerald-500" : "bg-primary")}
                                style={{ width: `${entry.progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{entry.progressPercentage}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", sConf.className)}>
                            {sConf.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 mx-auto transition-all duration-300 ease-in-out",
                              isExpanded ? "rotate-180 text-primary" : "text-muted-foreground"
                            )}
                          />
                        </td>
                      </tr>

                      {/* Expandable detail row — always in DOM, animated with grid trick */}
                      <tr className={cn(isExpanded && "border-b border-primary/20")}>
                        <td colSpan={8} className="p-0 border-0">
                          <div
                            className={cn(
                              "grid transition-all duration-300 ease-in-out",
                              isExpanded
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden min-h-0">
                              <div className="px-6 py-5 bg-primary/[0.03]">
                                <div className="flex flex-col gap-5">

                                  {/* Info grid */}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Proyecto</p>
                                      <p className="text-xs font-medium truncate">{getProjectName(entry.projectId)}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Tarea</p>
                                      <p className="text-xs font-medium truncate">{getTaskName(entry.taskId)}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Horario</p>
                                      <p className="text-xs font-medium">{entry.startTime} — {entry.endTime ?? "en curso"}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Horas ef.</p>
                                      <p className="text-xs font-semibold">{entry.effectiveHours.toFixed(1)}h</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Pausas</p>
                                      <p className="text-xs font-medium">{entry.pauseCount}</p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Colación</p>
                                      <p className="text-xs font-medium">
                                        {entry.lunchStartTime && entry.lunchEndTime
                                          ? `${entry.lunchStartTime} — ${entry.lunchEndTime}`
                                          : "—"}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Editable fields */}
                                  {entry.editable ? (
                                    <div className="border-t border-border/60 pt-4">
                                      <div className="flex items-center gap-2 mb-4">
                                        <Edit3 className="h-3.5 w-3.5 text-primary" />
                                        <p className="text-xs font-semibold text-foreground">Editar registro</p>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                          <Label className="text-xs">Notas</Label>
                                          <Textarea
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            rows={2}
                                            className="text-sm resize-none"
                                            placeholder="Notas de la jornada..."
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                          <Label className="text-xs">Avance (%)</Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={editProgress}
                                            onChange={(e) => setEditProgress(e.target.value)}
                                            className="text-sm h-9"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                          <Label className="text-xs">Justificación de avance</Label>
                                          <Textarea
                                            value={editJustification}
                                            onChange={(e) => setEditJustification(e.target.value)}
                                            rows={2}
                                            className="text-sm resize-none"
                                            placeholder="Describí el progreso..."
                                          />
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-2 mt-4">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setExpandedId(null)}
                                          disabled={saving}
                                        >
                                          <X className="h-3.5 w-3.5 mr-1" />
                                          Cancelar
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => saveEntry(entry)}
                                          disabled={saving}
                                        >
                                          <Save className="h-3.5 w-3.5 mr-1" />
                                          {saving ? "Guardando..." : "Guardar cambios"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="border-t border-border/60 pt-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
                                          <p className="text-sm text-foreground">{entry.notes || "Sin notas"}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Justificación</p>
                                          <p className="text-sm text-foreground">{entry.progressJustification || "—"}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
