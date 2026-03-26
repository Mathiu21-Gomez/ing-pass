"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FileSpreadsheet, Loader2, Download } from "lucide-react"
import { toast } from "sonner"

export type ExportContext = "time-entries" | "tasks"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ExportContext
  filters?: {
    projectId?: string
    userId?: string
    status?: string
    startDate?: string
    endDate?: string
  }
  data?: Record<string, unknown>[]
  projects?: { id: string; name: string }[]
  users?: { id: string; name: string }[]
}

const CONTEXT_LABELS: Record<ExportContext, string> = {
  "time-entries": "Historial de tiempos",
  tasks: "Tareas",
}

const TASK_STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "esperando_info", label: "Esperando info" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "listo_para_revision", label: "Listo para revisión" },
  { value: "finalizado", label: "Finalizado" },
  { value: "retrasado", label: "Retrasado" },
]

export function ExportDialog({
  open,
  onOpenChange,
  context,
  filters = {},
  projects = [],
  users = [],
}: ExportDialogProps) {
  const [projectId, setProjectId] = useState(filters.projectId ?? "all")
  const [userId, setUserId] = useState(filters.userId ?? "all")
  const [status, setStatus] = useState(filters.status ?? "all")
  const [startDate, setStartDate] = useState(filters.startDate ?? "")
  const [endDate, setEndDate] = useState(filters.endDate ?? "")
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (projectId !== "all") params.set("projectId", projectId)
      if (userId !== "all") params.set("userId", userId)
      if (status !== "all") params.set("status", status)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const endpoint =
        context === "time-entries"
          ? `/api/export/time-entries?${params}`
          : `/api/export/tasks?${params}`

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error("Error del servidor")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${context}_${new Date().toISOString().split("T")[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel descargado")
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error("Error al generar el archivo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Exportar {CONTEXT_LABELS[context]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filtros
            </p>

            {projects.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Proyecto</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proyectos</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {context === "time-entries" && users.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Trabajador</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {context === "tasks" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {context === "time-entries" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
