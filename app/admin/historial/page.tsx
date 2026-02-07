"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAllWorkersStatus, getWorkerHistory, mockProjects, mockUsers, mockTimeEntries } from "@/lib/mock-data"
import {
    ChevronDown,
    Clock,
    UtensilsCrossed,
    Pause,
    TrendingUp,
    Calendar,
    User,
    Download,
    FileSpreadsheet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    trabajando: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", label: "Trabajando" },
    colacion: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", label: "En Colación" },
    pausado: { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", label: "Pausado" },
    finalizado: { bg: "bg-muted", text: "text-muted-foreground", label: "Finalizado" },
}

export default function HistorialPage() {
    const [expandedWorker, setExpandedWorker] = useState<string | null>(null)
    const [projectFilter, setProjectFilter] = useState<string>("all")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")

    const workers = getAllWorkersStatus()
    const activeProjects = mockProjects.filter(p => p.status === "Activo")

    const filteredWorkers = projectFilter === "all"
        ? workers
        : workers.filter(w => w.todayEntry?.projectId === projectFilter)

    const toggleExpand = (workerId: string) => {
        setExpandedWorker(expandedWorker === workerId ? null : workerId)
    }

    // Export entries to CSV
    function exportToCSV() {
        const entriesToExport = mockTimeEntries.filter(e => {
            const entryDate = new Date(e.date)
            const start = startDate ? new Date(startDate) : null
            const end = endDate ? new Date(endDate) : null

            if (start && entryDate < start) return false
            if (end && entryDate > end) return false
            if (projectFilter !== "all" && e.projectId !== projectFilter) return false

            return true
        })

        const headers = ["Fecha", "Trabajador", "Proyecto", "Inicio", "Fin", "Horas", "Avance %", "Pausas", "Notas"]
        const rows = entriesToExport.map(e => {
            const user = mockUsers.find(u => u.id === e.userId)
            const project = mockProjects.find(p => p.id === e.projectId)
            return [
                e.date,
                user?.name ?? "",
                project?.name ?? "",
                e.startTime,
                e.endTime ?? "",
                e.effectiveHours.toString(),
                e.progressPercentage?.toString() ?? "0",
                e.pauseCount?.toString() ?? "0",
                `"${e.notes?.replace(/"/g, '""') ?? ""}"`
            ]
        })

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `historial_${new Date().toISOString().split("T")[0]}.csv`
        link.click()
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Historial de Trabajadores</h1>
                    <p className="text-sm text-muted-foreground">
                        Control de avance y tiempo de todos los trabajadores
                    </p>
                </div>
                <Button onClick={exportToCSV} variant="outline" className="gap-2 self-start sm:self-auto btn-press">
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-64">
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por proyecto" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los proyectos</SelectItem>
                            {activeProjects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2 items-center">
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-40"
                        placeholder="Desde"
                    />
                    <span className="text-muted-foreground text-sm">a</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-40"
                        placeholder="Hasta"
                    />
                    {(startDate || endDate) && (
                        <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate("") }}>
                            Limpiar
                        </Button>
                    )}
                </div>
            </div>

            {/* Workers List */}
            <div className="flex flex-col gap-4 stagger-children">
                {filteredWorkers.map((worker) => {
                    const isExpanded = expandedWorker === worker.id
                    const history = isExpanded ? getWorkerHistory(worker.id) : null
                    const sc = worker.todayEntry
                        ? statusColors[worker.todayEntry.status] ?? statusColors.finalizado
                        : null

                    return (
                        <Card key={worker.id} className="overflow-hidden card-hover">
                            {/* Worker Header Row */}
                            <CardContent className="p-0">
                                <button
                                    onClick={() => toggleExpand(worker.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>

                                        {/* Name & Position */}
                                        <div className="text-left">
                                            <p className="font-semibold text-foreground">{worker.name}</p>
                                            <p className="text-sm text-muted-foreground">{worker.position}</p>
                                        </div>
                                    </div>

                                    {/* Today's Info */}
                                    <div className="flex items-center gap-6">
                                        {worker.hasEntryToday && worker.todayEntry ? (
                                            <>
                                                {/* Project */}
                                                <div className="text-right hidden md:block">
                                                    <p className="text-xs text-muted-foreground">Proyecto</p>
                                                    <p className="text-sm font-medium text-foreground">{worker.projectName}</p>
                                                </div>

                                                {/* Start Time */}
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Inicio</p>
                                                    <p className="text-sm font-mono font-medium text-foreground">
                                                        {worker.todayEntry.startTime}
                                                    </p>
                                                </div>

                                                {/* Lunch */}
                                                <div className="text-center hidden sm:block">
                                                    <p className="text-xs text-muted-foreground">Colación</p>
                                                    <p className="text-sm font-mono text-foreground">
                                                        {worker.todayEntry.lunchStartTime
                                                            ? `${worker.todayEntry.lunchStartTime}${worker.todayEntry.lunchEndTime ? ` - ${worker.todayEntry.lunchEndTime}` : ""}`
                                                            : "--"}
                                                    </p>
                                                </div>

                                                {/* Progress */}
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Avance</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-emerald-500 transition-all"
                                                                style={{ width: `${worker.todayEntry.progressPercentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {worker.todayEntry.progressPercentage}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Pauses */}
                                                <div className="text-center hidden sm:block">
                                                    <p className="text-xs text-muted-foreground">Pausas</p>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {worker.todayEntry.pauseCount}
                                                    </p>
                                                </div>

                                                {/* Status */}
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                                                    sc?.bg, sc?.text,
                                                    worker.todayEntry?.status === "trabajando" && "status-dot-live"
                                                )}>
                                                    {sc?.label}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                Sin registro hoy
                                            </span>
                                        )}

                                        {/* Expand Icon */}
                                        <ChevronDown className={cn(
                                            "h-5 w-5 text-muted-foreground transition-transform duration-300",
                                            isExpanded && "rotate-180"
                                        )} />
                                    </div>
                                </button>

                                {/* Expanded History */}
                                {isExpanded && history && (
                                    <div className="border-t border-border bg-muted/30 p-4 animate-fade-in-up">
                                        {/* Summary Stats */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 stagger-children">
                                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                                                <Clock className="h-4 w-4 text-primary" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Total Horas</p>
                                                    <p className="text-lg font-bold text-foreground">{history.totalHours}h</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Avance Prom.</p>
                                                    <p className="text-lg font-bold text-foreground">{history.avgProgress}%</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                                                <Pause className="h-4 w-4 text-orange-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Total Pausas</p>
                                                    <p className="text-lg font-bold text-foreground">{history.totalPauses}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                                                <Calendar className="h-4 w-4 text-amber-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Días Registrados</p>
                                                    <p className="text-lg font-bold text-foreground">{history.entries.length}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Daily History Table */}
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-muted">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Proyecto</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Inicio</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground hidden sm:table-cell">Colación</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Fin</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Horas</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Avance</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">Pausas</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {history.entries.map((entry) => (
                                                        <tr key={entry.id} className="border-t border-border/50">
                                                            <td className="px-4 py-3">
                                                                <p className="text-sm font-medium text-foreground">
                                                                    {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CL", {
                                                                        weekday: "short",
                                                                        day: "numeric",
                                                                        month: "short",
                                                                    })}
                                                                </p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="text-sm text-foreground">{entry.projectName}</p>
                                                                <p className="text-xs text-muted-foreground">{entry.taskName}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                                                                {entry.startTime}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-sm text-muted-foreground hidden sm:table-cell">
                                                                {entry.lunchStartTime && entry.lunchEndTime
                                                                    ? `${entry.lunchStartTime} - ${entry.lunchEndTime}`
                                                                    : "--"}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                                                                {entry.endTime ?? "--"}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-sm font-semibold text-foreground">
                                                                {entry.effectiveHours}h
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-emerald-500"
                                                                            style={{ width: `${entry.progressPercentage}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-sm font-medium text-foreground">
                                                                        {entry.progressPercentage}%
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-sm text-foreground hidden md:table-cell">
                                                                {entry.pauseCount}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Daily Progress Notes */}
                                        {history.entries.length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-xs font-medium text-muted-foreground mb-3">Notas de avance por día:</p>
                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                    {history.entries.map((entry) => (
                                                        <div
                                                            key={entry.id}
                                                            className="rounded-lg border border-border bg-card p-3"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-medium text-foreground">
                                                                    {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CL", {
                                                                        weekday: "short",
                                                                        day: "numeric",
                                                                        month: "short"
                                                                    })}
                                                                </span>
                                                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    {entry.progressPercentage}%
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mb-1">
                                                                {entry.projectName} • {entry.taskName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mb-1.5">
                                                                {entry.notes}
                                                            </p>
                                                            {entry.progressJustification && (
                                                                <div className="pt-1.5 border-t border-border/50">
                                                                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">
                                                                        Justificación del avance:
                                                                    </p>
                                                                    <p className="text-sm text-foreground">
                                                                        {entry.progressJustification}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}

                {filteredWorkers.length === 0 && (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <p className="text-muted-foreground">No hay trabajadores para el filtro seleccionado</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
