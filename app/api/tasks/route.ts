import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  tasks,
  taskAssignments,
  taskTags,
  tags,
  projects,
  user as userTable,
} from "@/db/schema"
import { getAuthUser } from "@/lib/api-auth"
import { eq, inArray } from "drizzle-orm"

/**
 * GET /api/tasks
 * Returns tasks assigned to the current user, with full details:
 * project name, tags, assignedTo (user IDs), guidelines, description.
 *
 * Accessible to all roles — each user gets only their assigned tasks.
 */
export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    // 1. Find all task IDs assigned to this user
    const assignments = await db
      .select({ taskId: taskAssignments.taskId })
      .from(taskAssignments)
      .where(eq(taskAssignments.userId, authUser.id))

    if (assignments.length === 0) return NextResponse.json([])

    const taskIds = assignments.map((a) => a.taskId)

    // 2. Load full task rows
    const taskRows = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, taskIds))

    if (taskRows.length === 0) return NextResponse.json([])

    const projectIds = [...new Set(taskRows.map((t) => t.projectId))]

    // 3. Batch-load projects, all task assignments, and tags
    const [projectRows, allAssignments, tagRows] = await Promise.all([
      db.select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds)),
      db.select({ taskId: taskAssignments.taskId, userId: taskAssignments.userId })
        .from(taskAssignments)
        .where(inArray(taskAssignments.taskId, taskIds)),
      db
        .select({
          taskId: taskTags.taskId,
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(taskTags)
        .innerJoin(tags, eq(taskTags.tagId, tags.id))
        .where(inArray(taskTags.taskId, taskIds)),
    ])

    const projectMap = new Map(projectRows.map((p) => [p.id, p.name]))

    // Group assignments and tags by taskId
    const assignedByTask = new Map<string, string[]>()
    for (const a of allAssignments) {
      const arr = assignedByTask.get(a.taskId) ?? []
      arr.push(a.userId)
      assignedByTask.set(a.taskId, arr)
    }

    const tagsByTask = new Map<string, { id: string; name: string; color: string }[]>()
    for (const t of tagRows) {
      const arr = tagsByTask.get(t.taskId) ?? []
      arr.push({ id: t.id, name: t.name, color: t.color })
      tagsByTask.set(t.taskId, arr)
    }

    const result = taskRows.map((t) => ({
      ...t,
      projectName: projectMap.get(t.projectId) ?? "—",
      assignedTo: assignedByTask.get(t.id) ?? [],
      tags: tagsByTask.get(t.id) ?? [],
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error("GET /api/tasks error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
