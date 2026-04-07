import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { messages, user, projects, tasks, notifications } from "@/db/schema"
import { getAuthUser } from "@/lib/api-auth"
import {
  getProjectMessageAccessContext,
  getSessionMessageAccessContext,
  getTaskMessageAccessContext,
} from "@/lib/message-access"
import { getProjectMemberships } from "@/lib/project-membership-store"
import { validateAttachments } from "@/lib/validate-attachments"
import { eq, desc, and, sql, isNull, ne } from "drizzle-orm"

const MESSAGE_SELECT = {
  id: messages.id,
  fromUserId: messages.fromUserId,
  fromUserName: user.name,
  fromUserRole: user.role,
  content: messages.content,
  sessionId: messages.sessionId,
  projectId: messages.projectId,
  taskId: messages.taskId,
  isClientMessage: messages.isClientMessage,
  isPreStart: messages.isPreStart,
  attachments: messages.attachments,
  readAt: messages.readAt,
  createdAt: messages.createdAt,
} as const

export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")
  const projectId = searchParams.get("projectId")
  const taskId = searchParams.get("taskId")
  const providedContexts = [sessionId, projectId, taskId].filter(Boolean)

  try {
    let rows

    if (providedContexts.length > 1) {
      return NextResponse.json(
        { error: "Provide only one message context per request" },
        { status: 400 }
      )
    }

    if (taskId) {
      const { error: accessError } = await getTaskMessageAccessContext(taskId, authUser)
      if (accessError) return accessError

      // Per-task communication
      rows = await db
        .select(MESSAGE_SELECT)
        .from(messages)
        .innerJoin(user, eq(messages.fromUserId, user.id))
        .where(eq(messages.taskId, taskId))
        .orderBy(messages.createdAt)
    } else if (sessionId) {
      const { error: accessError } = await getSessionMessageAccessContext(sessionId, authUser)
      if (accessError) return accessError

      rows = await db
        .select(MESSAGE_SELECT)
        .from(messages)
        .innerJoin(user, eq(messages.fromUserId, user.id))
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.createdAt)
    } else if (projectId) {
      const { error: accessError } = await getProjectMessageAccessContext(projectId, authUser)
      if (accessError) return accessError

      // Client messages for a project
      rows = await db
        .select(MESSAGE_SELECT)
        .from(messages)
        .innerJoin(user, eq(messages.fromUserId, user.id))
        .where(eq(messages.projectId, projectId))
        .orderBy(messages.createdAt)
    } else {
      // Bandeja — admin/coordinator: all messages with project/task names
      if (authUser.role !== "admin" && authUser.role !== "coordinador") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const baseQuery = db
        .select({
          ...MESSAGE_SELECT,
          coordinatorId: projects.coordinatorId,
          // For new messages: join directly on projectId/taskId.
          // For old pre-start messages (projectId = null): fall back to the
          // time_entry of the same worker on the same day.
          projectName: sql<string | null>`COALESCE(
            ${projects.name},
            (SELECT p2.name FROM projects p2
             INNER JOIN time_entries te ON te.project_id = p2.id
             WHERE te.user_id = ${messages.fromUserId}
               AND te.date = ${messages.createdAt}::date
             LIMIT 1)
          )`,
          taskName: sql<string | null>`COALESCE(
            ${tasks.name},
            (SELECT t2.name FROM tasks t2
             INNER JOIN time_entries te ON te.task_id = t2.id
             WHERE te.user_id = ${messages.fromUserId}
               AND te.date = ${messages.createdAt}::date
             LIMIT 1)
          )`,
        })
        .from(messages)
        .innerJoin(user, eq(messages.fromUserId, user.id))
        .leftJoin(projects, eq(messages.projectId, projects.id))
        .leftJoin(tasks, eq(messages.taskId, tasks.id))

      const inboxRows = await baseQuery.orderBy(desc(messages.createdAt)).limit(200)

      if (authUser.role === "coordinador") {
        const projectIds = [...new Set(
          inboxRows
            .map((row) => row.projectId)
            .filter((projectId): projectId is string => Boolean(projectId))
        )]

        const legacyCoordinators = inboxRows
          .filter((row): row is typeof row & { projectId: string } => Boolean(row.projectId))
          .map((row) => ({
            projectId: row.projectId,
            coordinatorId: row.coordinatorId,
          }))

        const membershipMap = await getProjectMemberships(projectIds, {
          legacyCoordinators,
        })

        rows = inboxRows.filter((row) => {
          if (!row.projectId) return false
          return membershipMap.get(row.projectId)?.coordinatorIds.includes(authUser.id) ?? false
        })
      } else {
        rows = inboxRows
      }
    }

    return NextResponse.json(rows)
  } catch (error) {
    console.error("GET /api/messages error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json()
    const { sessionId, projectId } = body

    const providedContexts = [sessionId, projectId].filter(Boolean)

    if (providedContexts.length !== 1) {
      return NextResponse.json(
        { error: "Provide exactly one message context to mark as read" },
        { status: 400 }
      )
    }

    const baseCondition = sessionId
      ? (() => {
          return eq(messages.sessionId, sessionId)
        })()
      : (() => {
          return eq(messages.projectId, projectId)
        })()

    if (sessionId) {
      const { error: accessError } = await getSessionMessageAccessContext(sessionId, authUser)
      if (accessError) return accessError
    }

    if (projectId) {
      const { error: accessError } = await getProjectMessageAccessContext(projectId, authUser)
      if (accessError) return accessError
    }

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(baseCondition, isNull(messages.readAt), ne(messages.fromUserId, authUser.id)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("PATCH /api/messages error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const body = await request.json()
    const { content, sessionId, projectId, taskId, isClientMessage, isPreStart, attachments } = body
    const providedContexts = [sessionId, projectId, taskId].filter(Boolean)

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 })
    }

    if (providedContexts.length === 0) {
      return NextResponse.json(
        { error: "sessionId, projectId or taskId required" },
        { status: 400 }
      )
    }

    const attachmentError = validateAttachments(attachments)
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 })
    }

    let taskContext: Awaited<ReturnType<typeof getTaskMessageAccessContext>>["context"] = null

    if (taskId) {
      const taskAccess = await getTaskMessageAccessContext(taskId, authUser)
      if (taskAccess.error) return taskAccess.error
      taskContext = taskAccess.context
    }

    if (projectId) {
      const projectAccess = await getProjectMessageAccessContext(projectId, authUser)
      if (projectAccess.error) return projectAccess.error

      if (taskContext && taskContext.projectId !== projectAccess.context.projectId) {
        return NextResponse.json(
          { error: "taskId does not belong to the provided projectId" },
          { status: 400 }
        )
      }
    }

    if (sessionId) {
      const sessionAccess = await getSessionMessageAccessContext(sessionId, authUser, {
        allowMissing: true,
      })

      if (sessionAccess.error) return sessionAccess.error

      if (!sessionAccess.exists && !taskId && !projectId) {
        return NextResponse.json(
          { error: "projectId or taskId required when starting a new session thread" },
          { status: 400 }
        )
      }
    }

    const [created] = await db
      .insert(messages)
      .values({
        fromUserId: authUser.id,
        content: content.trim(),
        sessionId: sessionId ?? null,
        projectId: projectId ?? null,
        taskId: taskId ?? null,
        isClientMessage: isClientMessage ?? false,
        isPreStart: isPreStart ?? false,
        attachments: attachments ?? [],
      })
      .returning()

    // ── @mention notifications ──
    if (taskId && created.content) {
      try {
        const mentionMatches = [...created.content.matchAll(/@([\w][\w\s]*)/g)]
        if (mentionMatches.length > 0) {
          const mentionedNames = [...new Set(mentionMatches.map((m) => m[1].trim()))]
          const mentionedUsers = await db
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(sql`lower(${user.name}) = ANY(ARRAY[${sql.join(
              mentionedNames.map((n) => sql`lower(${n})`),
              sql`, `
            )}])`)

          if (mentionedUsers.length > 0) {
            await db.insert(notifications).values(
              mentionedUsers
                .filter((u) => u.id !== authUser.id)
                .map((mentionedUser) => ({
                  userId: mentionedUser.id,
                  type: "mention" as const,
                  entityType: "task" as const,
                  entityId: taskId,
                  fromUserId: authUser.id,
                  message: `${authUser.name} te mencionó en una tarea`,
                }))
            )
          }
        }
      } catch (mentionErr) {
        console.error("Error creating mention notifications:", mentionErr)
        // non-blocking — message was already saved
      }
    }

    const withUser = {
      ...created,
      fromUserName: authUser.name,
      fromUserRole: authUser.role,
    }

    return NextResponse.json(withUser, { status: 201 })
  } catch (error) {
    console.error("POST /api/messages error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
