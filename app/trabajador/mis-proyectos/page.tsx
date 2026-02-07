"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import { mockProjects, mockClients } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, CheckCircle2, Clock, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectStatus } from "@/lib/types"

const statusConfig: Record<ProjectStatus, { className: string }> = {
  Activo: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Pausado: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  Finalizado: { className: "bg-muted text-muted-foreground border-border" },
}

export default function MisProyectosPage() {
  const { user } = useAuth()

  const assignedProjects = mockProjects.filter((p) =>
    p.assignedWorkers.includes(user?.id ?? "")
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          {assignedProjects.length} proyectos asignados
        </p>
      </div>

      {assignedProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No tienes proyectos asignados actualmente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignedProjects.map((project) => {
            const client = mockClients.find((c) => c.id === project.clientId)
            const start = new Date(project.startDate).getTime()
            const end = new Date(project.endDate).getTime()
            const now = Date.now()
            const progress = project.status === "Finalizado"
              ? 100
              : Math.min(Math.max(Math.round(((now - start) / (end - start)) * 100), 0), 100)

            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">{client?.name}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", statusConfig[project.status].className)}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{project.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(project.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        {" - "}
                        {new Date(project.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{progress}% avance temporal</span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Tareas del proyecto</p>
                    <div className="flex flex-col gap-1.5">
                      {project.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{task.name}</p>
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
