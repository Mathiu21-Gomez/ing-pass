import type { User, Project, TimeEntry, TimeEntryEnriched, Comment } from "./types"

// ── Date helpers ──────────────────────────────────
const today = new Date()

function formatDate(d: Date): string {
    return d.toISOString().split("T")[0]
}

function getPastDate(daysAgo: number): Date {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    return d
}

// ── Data-driven helpers (no globals) ──────────────

export function getWeeklyHours(
    userId: string,
    timeEntries: TimeEntry[]
): { day: string; hours: number }[] {
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie"]
    return days.map((day, i) => {
        const dateStr = formatDate(getPastDate(4 - i))
        const entry = timeEntries.find(
            (e) => e.userId === userId && e.date === dateStr
        )
        return { day, hours: entry?.effectiveHours ?? 0 }
    })
}

export function getHoursByProject(
    timeEntries: TimeEntry[],
    projects: Project[]
): { project: string; hours: number }[] {
    const map = new Map<string, number>()
    for (const entry of timeEntries) {
        const project = projects.find((p) => p.id === entry.projectId)
        if (project) {
            map.set(project.name, (map.get(project.name) ?? 0) + entry.effectiveHours)
        }
    }
    return Array.from(map.entries()).map(([project, hours]) => ({
        project,
        hours: Math.round(hours * 10) / 10,
    }))
}

export function getHoursByWorker(
    timeEntries: TimeEntry[],
    users: User[]
): { worker: string; hours: number; target: number }[] {
    const map = new Map<string, number>()
    for (const entry of timeEntries) {
        const user = users.find((u) => u.id === entry.userId)
        if (user) {
            map.set(user.name, (map.get(user.name) ?? 0) + entry.effectiveHours)
        }
    }
    return Array.from(map.entries()).map(([worker, hours]) => ({
        worker: worker.split(" ").slice(0, 2).join(" "),
        hours: Math.round(hours * 10) / 10,
        target: 40,
    }))
}

export function getActiveWorkersToday(
    timeEntries: TimeEntryEnriched[],
    users: User[],
    projects: Project[]
) {
    const todayStr = formatDate(today)
    return timeEntries
        .filter((e) => e.date === todayStr)
        .map((e) => ({
            ...e,
            userName: e.userName ?? users.find((u) => u.id === e.userId)?.name ?? "",
            userPosition: e.userPosition ?? users.find((u) => u.id === e.userId)?.position ?? "",
            projectName: e.projectName ?? projects.find((p) => p.id === e.projectId)?.name ?? "",
            taskName: e.taskName ?? "",
        }))
}

export function getWorkerHistory(
    userId: string,
    users: User[],
    timeEntries: TimeEntryEnriched[],
    projects: Project[]
) {
    const user = users.find((u) => u.id === userId)
    if (!user) return null

    const entries = timeEntries
        .filter((e) => e.userId === userId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => ({
            ...e,
            projectName: e.projectName ?? projects.find((p) => p.id === e.projectId)?.name ?? "",
            taskName: e.taskName ?? "",
        }))

    const totalPauses = entries.reduce((acc, e) => acc + e.pauseCount, 0)
    const totalHours = entries.reduce((acc, e) => acc + e.effectiveHours, 0)
    const avgProgress =
        entries.length > 0
            ? Math.round(
                entries.reduce((acc, e) => acc + e.progressPercentage, 0) /
                entries.length
            )
            : 0

    return {
        user,
        entries,
        totalPauses,
        totalHours: Math.round(totalHours * 10) / 10,
        avgProgress,
    }
}

export function getAllWorkersStatus(
    users: User[],
    timeEntries: TimeEntry[],
    projects: Project[]
) {
    const todayStr = formatDate(today)
    const workers = users.filter((u) => u.role === "trabajador" && u.active)

    return workers.map((worker) => {
        const todayEntry = timeEntries.find(
            (e) => e.userId === worker.id && e.date === todayStr
        )
        const allEntries = timeEntries.filter((e) => e.userId === worker.id)
        const totalPauses = allEntries.reduce((acc, e) => acc + e.pauseCount, 0)

        if (todayEntry) {
            const project = projects.find((p) => p.id === todayEntry.projectId)
            return {
                ...worker,
                todayEntry,
                projectName: project?.name ?? "",
                totalPauses,
                hasEntryToday: true as const,
            }
        }

        return {
            ...worker,
            todayEntry: null,
            projectName: "",
            totalPauses,
            hasEntryToday: false as const,
        }
    })
}

export function getTaskProgress(task: {
    activities: { completed: boolean }[]
}): number {
    if (task.activities.length === 0) return 0
    const completed = task.activities.filter((a) => a.completed).length
    return Math.round((completed / task.activities.length) * 100)
}

export function isEntryEditable(
    entryDate: string,
    endTime?: string | null
): boolean {
    const closeTime = endTime ?? "17:00"
    const entry = new Date(`${entryDate}T${closeTime}:00`)
    const now = new Date()
    const diffMs = now.getTime() - entry.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours >= 0 && diffHours <= 24
}

export function getKPIData(projects: Project[], users: User[]) {
    const allTasks = projects.flatMap((p) => p.tasks)
    const allActivities = allTasks.flatMap((t) => t.activities)

    const tasksByProject = projects.map((p) => {
        const total = p.tasks.length
        const closed = p.tasks.filter((t) => t.status === "finalizado").length
        return {
            projectId: p.id,
            projectName: p.name,
            totalTasks: total,
            closedTasks: closed,
            completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
        }
    })

    const coordinatorTasks = allTasks.filter((t) => t.createdBy === "u7").length
    const userCreatedTasks = allTasks.filter((t) => t.createdBy !== "u7").length

    const workers = users.filter((u) => u.role === "trabajador")
    const progressByUser = workers.map((w) => {
        const userTasks = allTasks.filter((t) => t.assignedTo.includes(w.id))
        const userActivities = userTasks.flatMap((t) => t.activities)
        const completed = userActivities.filter((a) => a.completed).length
        const total = userActivities.length
        return {
            userId: w.id,
            userName: w.name,
            totalActivities: total,
            completedActivities: completed,
            progressRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            totalTasks: userTasks.length,
            closedTasks: userTasks.filter((t) => t.status === "finalizado").length,
        }
    })

    return {
        tasksByProject,
        coordinatorTasks,
        userCreatedTasks,
        totalTasks: allTasks.length,
        totalActivities: allActivities.length,
        completedActivities: allActivities.filter((a) => a.completed).length,
        progressByUser,
    }
}

export function getCommentsFor(
    comments: Comment[],
    parentType: "task" | "activity",
    parentId: string
): Comment[] {
    return comments
        .filter((c) => c.parentType === parentType && c.parentId === parentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
