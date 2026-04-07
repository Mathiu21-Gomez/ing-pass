import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { projectMembers, projectWorkers, roles, taskAssignments, user, userRoles, userSchedules } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import { syncProjectMembershipsForUser } from "@/lib/project-membership-store"

const SYSTEM_ROLE_NAMES = ["admin", "coordinador", "trabajador", "externo"] as const

type LegacyRole = (typeof SYSTEM_ROLE_NAMES)[number]

function isLegacyRole(value: unknown): value is LegacyRole {
  return typeof value === "string" && SYSTEM_ROLE_NAMES.includes(value as LegacyRole)
}

async function syncLegacyUserRole(userId: string, nextRole: LegacyRole) {
  const legacyRoles = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(inArray(roles.name, [...SYSTEM_ROLE_NAMES]))

  if (legacyRoles.length === 0) return

  const legacyRoleIds = legacyRoles.map((role) => role.id)
  const targetRole = legacyRoles.find((role) => role.name === nextRole)

  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, legacyRoleIds)))

  if (targetRole) {
    await db.insert(userRoles).values({ userId, roleId: targetRole.id })
  }
}

async function getUserWithSchedule(id: string) {
  const found = await db.select().from(user).where(eq(user.id, id))
  if (found.length === 0) return null

  const schedules = await db
    .select()
    .from(userSchedules)
    .where(eq(userSchedules.userId, id))

  return {
    ...found[0],
    weeklySchedule: schedules
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isWorkingDay: s.isWorkingDay,
        reason: s.reason ?? "",
      })),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { id } = await params

    if (!['admin', 'coordinador'].includes(authUser.role) && authUser.id !== id) {
      return NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 })
    }
    const result = await getUserWithSchedule(id)

    if (!result) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Error al obtener usuario" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  const roleError = requireRole(authUser, ['admin'])
  if (roleError) return roleError

  try {
    const { id } = await params
    const body = await request.json()
    const { weeklySchedule: scheduleData, ...userData } = body
    const [currentUser] = await db.select().from(user).where(eq(user.id, id))

    if (!currentUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    const nextRole = isLegacyRole(userData.role) ? userData.role : currentUser.role
    const nextActive = typeof userData.active === "boolean" ? userData.active : currentUser.active
    let roleTransition = null

    if (currentUser.role !== nextRole) {
      if (!(currentUser.role === "trabajador" && nextRole === "coordinador")) {
        return NextResponse.json(
          { error: "Demo Sprint 5: solo se permite el ascenso de trabajador a coordinador" },
          { status: 400 }
        )
      }

      if (!nextActive) {
        return NextResponse.json(
          { error: "El usuario debe estar activo para ascender a coordinador" },
          { status: 400 }
        )
      }

      const [projectMemberships, taskAssignmentMemberships] = await Promise.all([
        db
          .select({ projectId: projectMembers.projectId, role: projectMembers.role })
          .from(projectMembers)
          .where(eq(projectMembers.userId, id)),
        db
          .select({ taskId: taskAssignments.taskId })
          .from(taskAssignments)
          .where(eq(taskAssignments.userId, id)),
      ])

      roleTransition = {
        changed: true,
        fromRole: currentUser.role,
        toRole: nextRole,
        removedProjectMemberships: projectMemberships.length,
        removedTaskAssignments: taskAssignmentMemberships.length,
      }
    }

    // Update user fields if present
    if (Object.keys(userData).length > 0) {
      const updated = await db
        .update(user)
        .set(userData)
        .where(eq(user.id, id))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        )
      }

      if (roleTransition && isLegacyRole(nextRole)) {
        await Promise.all([
          db.delete(projectWorkers).where(eq(projectWorkers.userId, id)),
          db.delete(taskAssignments).where(eq(taskAssignments.userId, id)),
          syncLegacyUserRole(id, nextRole),
        ])
        await syncProjectMembershipsForUser(id)
      }
    }

    // Upsert schedule rows if provided
    if (scheduleData && Array.isArray(scheduleData)) {
      for (const s of scheduleData) {
        // Delete existing row for this day and re-insert
        await db
          .delete(userSchedules)
          .where(
            and(
              eq(userSchedules.userId, id),
              eq(userSchedules.dayOfWeek, s.dayOfWeek)
            )
          )

        await db.insert(userSchedules).values({
          userId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isWorkingDay: s.isWorkingDay,
          reason: s.reason ?? "",
        })
      }
    }

    const result = await getUserWithSchedule(id)
    return NextResponse.json({
      ...result,
      roleTransition,
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  const roleError = requireRole(authUser, ['admin'])
  if (roleError) return roleError

  try {
    const { id } = await params

    // Schedules are cascade-deleted via FK
    const deleted = await db
      .delete(user)
      .where(eq(user.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    )
  }
}
