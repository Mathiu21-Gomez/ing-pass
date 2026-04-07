import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { projectWorkers, projects, taskAssignments, tasks, user as userTable, userSchedules } from "@/db/schema"
import { createUserSchema } from "@/lib/schemas"
import { and, eq, inArray, ne } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { getProjectMemberships } from "@/lib/project-membership-store"

function uniqueProjectReferences<T extends { id: string; name: string; status?: string | null }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()].map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status ?? undefined,
  }))
}

// Default weekly schedule (Mon-Fri 08:00-17:00)
function defaultSchedule(userId: string) {
  return Array.from({ length: 7 }, (_, i) => ({
    userId,
    dayOfWeek: i,
    startTime: "08:00",
    endTime: "17:00",
    isWorkingDay: i < 5, // Lun-Vie = true, Sáb-Dom = false
    reason: "",
  }))
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin', 'coordinador'])
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const active = searchParams.get("active")

    let query = db.select().from(userTable)

    if (role) {
      query = query.where(eq(userTable.role, role as "admin" | "coordinador" | "trabajador" | "externo")) as typeof query
    }

    const allUsers = await query

    let filtered = allUsers
    if (active !== null) {
      filtered = allUsers.filter((u) => u.active === (active === "true"))
    }

    // Fetch all schedules and group by userId
    const allSchedules = await db.select().from(userSchedules)
    const scheduleMap = new Map<string, typeof allSchedules>()
    for (const s of allSchedules) {
      const arr = scheduleMap.get(s.userId) ?? []
      arr.push(s)
      scheduleMap.set(s.userId, arr)
    }

    const filteredUserIds = filtered.map((u) => u.id)

    const [projectRows, projectMembershipRows, activeAssignmentRows] = filteredUserIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: projects.id,
              name: projects.name,
              status: projects.status,
              coordinatorId: projects.coordinatorId,
            })
            .from(projects),
          db
            .select({
              userId: projectWorkers.userId,
              projectId: projects.id,
              projectName: projects.name,
              projectStatus: projects.status,
            })
            .from(projectWorkers)
            .innerJoin(projects, eq(projectWorkers.projectId, projects.id))
            .where(inArray(projectWorkers.userId, filteredUserIds)),
          db
            .select({ userId: taskAssignments.userId })
            .from(taskAssignments)
            .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
            .where(and(inArray(taskAssignments.userId, filteredUserIds), ne(tasks.status, "finalizado"))),
        ])
      : [[], [], []]

    const projectMembershipMap = await getProjectMemberships(
      projectRows.map((project) => project.id),
      {
        legacyCoordinators: projectRows.map((project) => ({
          projectId: project.id,
          coordinatorId: project.coordinatorId,
        })),
      }
    )

    const coordinatedProjectsByUser = new Map<string, typeof projectRows>()
    for (const project of projectRows) {
      const membership = projectMembershipMap.get(project.id)

      for (const coordinatorId of membership?.coordinatorIds ?? [project.coordinatorId]) {
        const rows = coordinatedProjectsByUser.get(coordinatorId) ?? []
        rows.push(project)
        coordinatedProjectsByUser.set(coordinatorId, rows)
      }
    }

    const workerProjectsByUser = new Map<string, typeof projectMembershipRows>()
    for (const membership of projectMembershipRows) {
      const rows = workerProjectsByUser.get(membership.userId) ?? []
      rows.push(membership)
      workerProjectsByUser.set(membership.userId, rows)
    }

    const activeAssignmentsByUser = new Map<string, number>()
    for (const assignment of activeAssignmentRows) {
      activeAssignmentsByUser.set(
        assignment.userId,
        (activeAssignmentsByUser.get(assignment.userId) ?? 0) + 1
      )
    }

    const result = filtered.map((u) => ({
      ...u,
      weeklySchedule: (scheduleMap.get(u.id) ?? [])
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        .map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isWorkingDay: s.isWorkingDay,
          reason: s.reason ?? "",
        })),
      projectSummary: {
        coordinated: uniqueProjectReferences(coordinatedProjectsByUser.get(u.id) ?? []),
        worker: uniqueProjectReferences(
          (workerProjectsByUser.get(u.id) ?? []).map((membership) => ({
            id: membership.projectId,
            name: membership.projectName,
            status: membership.projectStatus,
          }))
        ),
        activeTaskAssignments: activeAssignmentsByUser.get(u.id) ?? 0,
      },
      promotion: {
        canPromoteToCoordinator: u.role === "trabajador" && u.active,
        cleanupProjectMemberships: (workerProjectsByUser.get(u.id) ?? []).length,
        cleanupTaskAssignments: activeAssignmentsByUser.get(u.id) ?? 0,
        reason: !u.active
          ? "El usuario debe estar activo para ascender"
          : u.role !== "trabajador"
            ? "Solo los trabajadores pueden ascender a coordinador"
            : null,
      },
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin'])
  if (roleError) return roleError

  try {
    const body = await request.json()
    const { weeklySchedule: scheduleData, ...userData } = body

    const parsed = createUserSchema.safeParse(userData)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { password, ...userFields } = parsed.data

    const created = await auth.api.createUser({
      body: {
        email: userFields.email,
        password,
        name: userFields.name,
        data: {
          role: userFields.role,
          position: userFields.position,
          emailPersonal: userFields.emailPersonal || "",
          scheduleType: userFields.scheduleType,
          active: userFields.active,
        },
      },
    })

    if (!created?.user) {
      return NextResponse.json(
        { error: "Error al crear usuario en el sistema de autenticación" },
        { status: 500 }
      )
    }

    const userId = created.user.id

    const schedulesToInsert = scheduleData?.length
      ? scheduleData.map((s: { dayOfWeek: number; startTime: string; endTime: string; isWorkingDay: boolean; reason?: string }) => ({
        userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isWorkingDay: s.isWorkingDay,
        reason: s.reason ?? "",
      }))
      : defaultSchedule(userId)

    await db.insert(userSchedules).values(schedulesToInsert)

    const createdSchedules = await db
      .select()
      .from(userSchedules)
      .where(eq(userSchedules.userId, userId))

    return NextResponse.json(
      {
        ...created.user,
        weeklySchedule: createdSchedules
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isWorkingDay: s.isWorkingDay,
            reason: s.reason ?? "",
          })),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    )
  }
}
