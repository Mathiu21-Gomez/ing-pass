import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { timeEntries, user, projects, tasks } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const projectId = searchParams.get("projectId")
    const date = searchParams.get("date")
    const status = searchParams.get("status")

    let query = db.select().from(timeEntries).orderBy(desc(timeEntries.date))

    if (userId) {
      query = query.where(eq(timeEntries.userId, userId)) as typeof query
    }
    if (projectId) {
      query = query.where(eq(timeEntries.projectId, projectId)) as typeof query
    }
    if (date) {
      query = query.where(eq(timeEntries.date, date)) as typeof query
    }
    if (status) {
      query = query.where(eq(timeEntries.status, status as "trabajando" | "colacion" | "pausado" | "finalizado" | "inactivo")) as typeof query
    }

    const entries = await query

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const userResult = await db
          .select({ name: user.name, position: user.position })
          .from(user)
          .where(eq(user.id, entry.userId))

        const project = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, entry.projectId))

        const task = await db
          .select({ name: tasks.name })
          .from(tasks)
          .where(eq(tasks.id, entry.taskId))

        return {
          ...entry,
          userName: userResult[0]?.name ?? "",
          userPosition: userResult[0]?.position ?? "",
          projectName: project[0]?.name ?? "",
          taskName: task[0]?.name ?? "",
        }
      })
    )

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
  try {
    const body = await request.json()

    const {
      userId,
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
    } = body

    if (!userId || !projectId || !taskId || !date || !startTime) {
      return NextResponse.json(
        { error: "Campos requeridos: userId, projectId, taskId, date, startTime" },
        { status: 400 }
      )
    }

    const [newEntry] = await db
      .insert(timeEntries)
      .values({
        userId,
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
