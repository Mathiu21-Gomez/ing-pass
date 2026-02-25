import { NextResponse } from "next/server"
import { db } from "@/db"
import {
  projects,
  tasks,
  activities,
  timeEntries,
  user,
  taskAssignments,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function GET() {
  try {
    const allProjects = await db.select().from(projects)
    const allTasks = await db.select().from(tasks)
    const allActivities = await db.select().from(activities)
    const allTimeEntries = await db.select().from(timeEntries)
    const workers = await db
      .select()
      .from(user)
      .where(and(eq(user.role, "trabajador"), eq(user.active, true)))

    // Cumplimiento de tareas por proyecto
    const tasksByProject = allProjects.map((project) => {
      const projectTasks = allTasks.filter((t) => t.projectId === project.id)
      const total = projectTasks.length
      const closed = projectTasks.filter((t) => t.status === "cerrada").length
      return {
        projectId: project.id,
        projectName: project.name,
        totalTasks: total,
        closedTasks: closed,
        completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
      }
    })

    // Tareas creadas por coordinadores vs otros roles
    const coordinators = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "coordinador"))
    const coordinatorIds = new Set(coordinators.map((c) => c.id))
    const coordinatorTasks = allTasks.filter((t) => coordinatorIds.has(t.createdBy)).length
    const userCreatedTasks = allTasks.filter((t) => !coordinatorIds.has(t.createdBy)).length

    // Avance por usuario
    const allAssignments = await db.select().from(taskAssignments)

    const progressByUser = await Promise.all(
      workers.map(async (worker) => {
        const userTaskIds = allAssignments
          .filter((a) => a.userId === worker.id)
          .map((a) => a.taskId)

        const userTasks = allTasks.filter((t) => userTaskIds.includes(t.id))
        const userActivities = allActivities.filter((a) =>
          userTaskIds.includes(a.taskId)
        )
        const completed = userActivities.filter((a) => a.completed).length
        const total = userActivities.length

        return {
          userId: worker.id,
          userName: worker.name,
          totalActivities: total,
          completedActivities: completed,
          progressRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          totalTasks: userTasks.length,
          closedTasks: userTasks.filter((t) => t.status === "cerrada").length,
        }
      })
    )

    // Horas por proyecto
    const hoursByProject = allProjects.map((project) => {
      const projectEntries = allTimeEntries.filter(
        (e) => e.projectId === project.id
      )
      const totalHours = projectEntries.reduce(
        (acc, e) => acc + (e.effectiveHours ?? 0),
        0
      )
      return {
        project: project.name,
        hours: Math.round(totalHours * 10) / 10,
      }
    })

    // Horas por trabajador
    const hoursByWorker = workers.map((worker) => {
      const workerEntries = allTimeEntries.filter(
        (e) => e.userId === worker.id
      )
      const totalHours = workerEntries.reduce(
        (acc, e) => acc + (e.effectiveHours ?? 0),
        0
      )
      return {
        worker: worker.name.split(" ").slice(0, 2).join(" "),
        hours: Math.round(totalHours * 10) / 10,
        target: 40,
      }
    })

    // Weekly trend
    const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie"]
    const weeklyTrend = weekDays.map((day, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (4 - i))
      const dateStr = d.toISOString().split("T")[0]
      const dayEntries = allTimeEntries.filter((e) => e.date === dateStr)
      const totalHours = dayEntries.reduce((acc, e) => acc + (e.effectiveHours ?? 0), 0)
      return { day, hours: Math.round(totalHours * 10) / 10 }
    })

    // Trabajadores activos hoy
    const todayStr = new Date().toISOString().split("T")[0]
    const todayEntries = allTimeEntries.filter((e) => e.date === todayStr)

    const activeWorkersToday = await Promise.all(
      todayEntries.map(async (entry) => {
        const user = workers.find((w) => w.id === entry.userId)
        const project = allProjects.find((p) => p.id === entry.projectId)
        const task = allTasks.find((t) => t.id === entry.taskId)

        return {
          ...entry,
          userName: user?.name ?? "",
          userPosition: user?.position ?? "",
          projectName: project?.name ?? "",
          taskName: task?.name ?? "",
        }
      })
    )

    const completedActivities = allActivities.filter((a) => a.completed).length

    return NextResponse.json({
      tasksByProject,
      coordinatorTasks,
      userCreatedTasks,
      totalTasks: allTasks.length,
      totalActivities: allActivities.length,
      completedActivities,
      progressByUser,
      hoursByProject,
      hoursByWorker,
      activeWorkersToday,
      weeklyTrend,
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter((p) => p.status === "Activo").length,
      totalWorkers: workers.length,
    })
  } catch (error) {
    console.error("Error fetching KPIs:", error)
    return NextResponse.json(
      { error: "Error al obtener KPIs" },
      { status: 500 }
    )
  }
}
