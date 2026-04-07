import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { timeEntries, user, projects, tasks } from "@/db/schema"
import { eq, desc, and, inArray } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"

const ACTIVE_TIMER_STATUSES = ["trabajando", "colacion", "pausado", "reunion"] as const

export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    let userId = searchParams.get("userId")

    if (authUser.role === 'trabajador') {
      userId = authUser.id
    }
    const projectId = searchParams.get("projectId")
    const date = searchParams.get("date")
    const status = searchParams.get("status")
    const active = searchParams.get("active") === "true"

    const rows = await db
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        projectId: timeEntries.projectId,
        taskId: timeEntries.taskId,
        date: timeEntries.date,
        startTime: timeEntries.startTime,
        lunchStartTime: timeEntries.lunchStartTime,
        lunchEndTime: timeEntries.lunchEndTime,
        endTime: timeEntries.endTime,
        effectiveHours: timeEntries.effectiveHours,
        status: timeEntries.status,
          notes: timeEntries.notes,
          progressPercentage: timeEntries.progressPercentage,
          pauseCount: timeEntries.pauseCount,
          progressJustification: timeEntries.progressJustification,
          runtimeState: timeEntries.runtimeState,
          editable: timeEntries.editable,
        userName: user.name,
        userPosition: user.position,
        projectName: projects.name,
        taskName: tasks.name,
      })
      .from(timeEntries)
      .leftJoin(user, eq(timeEntries.userId, user.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(
        and(
          userId ? eq(timeEntries.userId, userId) : undefined,
          projectId ? eq(timeEntries.projectId, projectId) : undefined,
          date ? eq(timeEntries.date, date) : undefined,
          active ? inArray(timeEntries.status, ACTIVE_TIMER_STATUSES) : undefined,
          status ? eq(timeEntries.status, status as "trabajando" | "colacion" | "pausado" | "finalizado" | "inactivo") : undefined,
        )
      )
      .orderBy(desc(timeEntries.date), desc(timeEntries.startTime))

    const enriched = rows.map((r) => ({
      ...r,
      userName: r.userName ?? "",
      userPosition: r.userPosition ?? "",
      projectName: r.projectName ?? "",
      taskName: r.taskName ?? "",
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json(
      { error: "Error al obtener registros de tiempo" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json()

    const {
      projectId,
      taskId,
      date,
      startTime,
      lunchStartTime,
      lunchEndTime,
      endTime,
      effectiveHours,
      status,
      notes,
      progressPercentage,
      pauseCount,
      progressJustification,
      runtimeState,
    } = body

    if (!projectId || !taskId || !date || !startTime) {
      return NextResponse.json(
        { error: "Campos requeridos: projectId, taskId, date, startTime" },
        { status: 400 }
      )
    }

    const [newEntry] = await db
      .insert(timeEntries)
      .values({
        userId: authUser.id,
        projectId,
        taskId,
        date,
        startTime,
        lunchStartTime: lunchStartTime ?? null,
        lunchEndTime: lunchEndTime ?? null,
        endTime: endTime ?? null,
        effectiveHours: effectiveHours ?? 0,
        status: status ?? "trabajando",
        notes: notes ?? "",
        progressPercentage: progressPercentage ?? 0,
        pauseCount: pauseCount ?? 0,
        progressJustification: progressJustification ?? "",
        runtimeState: runtimeState ?? null,
        editable: true,
      })
      .returning()

    return NextResponse.json(newEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating time entry:", error)
    return NextResponse.json(
      { error: "Error al crear registro de tiempo" },
      { status: 500 }
    )
  }
}
