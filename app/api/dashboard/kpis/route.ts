import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  projects,
  tasks,
  activities,
  timeEntries,
  user as userTable,
  taskAssignments,
} from "@/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

const TASK_STATUSES = [
  "pendiente",
  "en_curso",
  "esperando_info",
  "bloqueado",
  "listo_para_revision",
  "finalizado",
  "retrasado",
] as const

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin', 'coordinador'])
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const filterWorkerId = searchParams.get("workerId")
    const filterCoordinatorId = searchParams.get("coordinatorId")
    const filterProjectId = searchParams.get("projectId")
    const dateRange = searchParams.get("dateRange") ?? "all" // week | month | quarter | all

    // Date range filter for time entries
    const now = new Date()
    let startDate: string | null = null
    if (dateRange === "week") {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split("T")[0]
    } else if (dateRange === "month") {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      startDate = d.toISOString().split("T")[0]
    } else if (dateRange === "quarter") {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 3)
      startDate = d.toISOString().split("T")[0]
    }

    // ── Base data ──
    const allProjectsUnfiltered = await db.select().from(projects)
    let allProjects = allProjectsUnfiltered
    if (filterProjectId) allProjects = allProjects.filter((p) => p.id === filterProjectId)
    if (filterCoordinatorId) allProjects = allProjects.filter((p) => p.coordinatorId === filterCoordinatorId)

    const projectIds = allProjects.map((p) => p.id)

    let allTasks = await db.select().from(tasks)
    allTasks = allTasks.filter((t) => projectIds.includes(t.projectId))
    if (startDate) allTasks = allTasks.filter((t) => t.createdAt.toISOString().split("T")[0] >= startDate!)

    const allActivities = await db.select().from(activities)

    // Time entries with optional date filter
    let allTimeEntries = await db.select().from(timeEntries)
    if (startDate) allTimeEntries = allTimeEntries.filter((e) => e.date >= startDate!)
    if (filterProjectId) allTimeEntries = allTimeEntries.filter((e) => e.projectId === filterProjectId)

    let workers = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.role, "trabajador"), eq(userTable.active, true)))
    if (filterWorkerId) workers = workers.filter((w) => w.id === filterWorkerId)

    const allAssignments = await db.select().from(taskAssignments)

    // ── Task status breakdown ──
    const taskStatusBreakdown = TASK_STATUSES.map((status) => ({
      status,
      count: allTasks.filter((t) => t.status === status).length,
    })).filter((s) => s.count > 0)

    // ── Task completion by project ──
    const tasksByProject = allProjects
      .filter((p) => allTasks.some((t) => t.projectId === p.id))
      .map((project) => {
        const projectTasks = allTasks.filter((t) => t.projectId === project.id)
        const total = projectTasks.length
        const closed = projectTasks.filter((t) => t.status === "finalizado").length
        return {
          projectId: project.id,
          projectName: project.name,
          totalTasks: total,
          closedTasks: closed,
          completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
        }
      })

    // ── Task origin (coordinator vs others) ──
    const coordinators = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.role, "coordinador"))
    const coordinatorIds = new Set(coordinators.map((c) => c.id))
    const coordinatorTasks = allTasks.filter((t) => coordinatorIds.has(t.createdBy)).length
    const userCreatedTasks = allTasks.filter((t) => !coordinatorIds.has(t.createdBy)).length

    // ── Progress by worker ──
    const progressByUser = workers.map((worker) => {
      const userTaskIds = allAssignments
        .filter((a) => a.userId === worker.id)
        .map((a) => a.taskId)

      const userTasks = allTasks.filter((t) => userTaskIds.includes(t.id))
      const userActivities = allActivities.filter((a) => userTaskIds.includes(a.taskId))
      const completed = userActivities.filter((a) => a.completed).length
      const total = userActivities.length

      return {
        userId: worker.id,
        userName: worker.name,
        totalActivities: total,
        completedActivities: completed,
        progressRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        totalTasks: userTasks.length,
        closedTasks: userTasks.filter((t) => t.status === "finalizado").length,
      }
    })

    // ── Hours by project ──
    const hoursByProject = allProjects
      .map((project) => ({
        project: project.name,
        hours: Math.round(
          allTimeEntries
            .filter((e) => e.projectId === project.id)
            .reduce((acc, e) => acc + (e.effectiveHours ?? 0), 0) * 10
        ) / 10,
      }))
      .filter((p) => p.hours > 0)

    // ── Hours by worker ──
    const hoursByWorker = workers.map((worker) => ({
      worker: worker.name.split(" ").slice(0, 2).join(" "),
      hours: Math.round(
        allTimeEntries
          .filter((e) => e.userId === worker.id)
          .reduce((acc, e) => acc + (e.effectiveHours ?? 0), 0) * 10
      ) / 10,
      target: 40,
    }))

    // ── Weekly trend ──
    const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie"]
    const weeklyTrend = weekDays.map((day, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (4 - i))
      const dateStr = d.toISOString().split("T")[0]
      const dayEntries = allTimeEntries.filter((e) => e.date === dateStr)
      return { day, hours: Math.round(dayEntries.reduce((acc, e) => acc + (e.effectiveHours ?? 0), 0) * 10) / 10 }
    })

    // ── Active workers today ──
    const todayStr = new Date().toISOString().split("T")[0]
    const todayEntries = allTimeEntries.filter((e) => e.date === todayStr)

    const activeWorkersToday = todayEntries.map((entry) => {
      const w = workers.find((wk) => wk.id === entry.userId)
      const project = allProjects.find((p) => p.id === entry.projectId)
      const task = allTasks.find((t) => t.id === entry.taskId)
      return {
        ...entry,
        userName: w?.name ?? "",
        userPosition: w?.position ?? "",
        projectName: project?.name ?? "",
        taskName: task?.name ?? "",
      }
    })

    const completedActivities = allActivities.filter((a) => a.completed).length

    return NextResponse.json({
      taskStatusBreakdown,
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
      totalProjects: allProjectsUnfiltered.length,
      activeProjects: allProjectsUnfiltered.filter((p) => p.status === "Activo").length,
      totalWorkers: workers.length,
    })
  } catch (error) {
    console.error("Error fetching KPIs:", error)
    return NextResponse.json({ error: "Error al obtener KPIs" }, { status: 500 })
  }
}
