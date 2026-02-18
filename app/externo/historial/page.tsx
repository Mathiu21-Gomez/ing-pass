"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockClients, mockTimeEntries, mockUsers } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Clock, Lock, Calendar, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function ExternoHistorialPage() {
    const { user } = useAuth()
    const [filterProject, setFilterProject] = useState<string>("all")

    // Find client for this external user
    const client = mockClients.find((c) => c.email === user?.email)
    const clientProjects = client
        ? mockProjects.filter((p) => p.clientId === client.id)
        : []

    const projectIds = filterProject === "all"
        ? clientProjects.map((p) => p.id)
        : [filterProject]

    // Get time entries for these projects (read-only)
    const relevantEntries = mockTimeEntries
        .filter((e) => projectIds.includes(e.projectId) && e.status === "finalizado")
        .sort((a, b) => b.date.localeCompare(a.date))

    // Stats
    const totalHours = relevantEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
    const uniqueDays = new Set(relevantEntries.map((e) => e.date)).size
    const uniqueWorkers = new Set(relevantEntries.map((e) => e.userId)).size

    return (
        <div className="flex flex-col gap-6 page-enter">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Historial de Trabajo
                </h1>
                <p className="text-sm text-muted-foreground">
                    Registro de horas trabajadas en tus proyectos.
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 grid-cols-3 stagger-children">
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Total Horas</p>
                                <p className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}h</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Días registrados</p>
                                <p className="text-2xl font-bold mt-1">{uniqueDays}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Trabajadores</p>
                                <p className="text-2xl font-bold mt-1">{uniqueWorkers}</p>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-[220px] h-9">
                        <SelectValue placeholder="Filtrar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los proyectos</SelectItem>
                        {clientProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                    <Lock className="h-3.5 w-3.5" />
                    Vista de solo lectura
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Fecha</TableHead>
                                <TableHead className="text-xs">Trabajador</TableHead>
                                <TableHead className="text-xs">Proyecto</TableHead>
                                <TableHead className="text-xs">Horario</TableHead>
                                <TableHead className="text-xs text-right">Horas</TableHead>
                                <TableHead className="text-xs">Notas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {relevantEntries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                                        No hay registros de horas para este proyecto
                                    </TableCell>
                                </TableRow>
                            ) : (
                                relevantEntries.map((entry) => {
                                    const worker = mockUsers.find((u) => u.id === entry.userId)
                                    const project = mockProjects.find((p) => p.id === entry.projectId)
                                    return (
                                        <TableRow key={entry.id}>
                                            <TableCell className="text-sm">
                                                {new Date(entry.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                                        {worker?.name?.charAt(0) ?? "?"}
                                                    </div>
                                                    {worker?.name?.split(" ").slice(0, 2).join(" ") ?? "—"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {project?.name?.split(" ").slice(0, 2).join(" ") ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono text-muted-foreground">
                                                {entry.startTime} - {entry.endTime ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono font-medium text-right">
                                                {entry.effectiveHours}h
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                {entry.notes || "—"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
