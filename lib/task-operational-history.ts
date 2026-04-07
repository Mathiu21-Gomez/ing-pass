import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  notifications,
  projects,
  taskAssignments,
  taskChatAttachments,
  taskChatMessages,
  taskChatThreads,
  tasks,
  timeEntries,
  user,
} from "@/db/schema"
import type { TaskOperationalHistorySummary, TaskWorkerCurrentTaskContext, TimerStatus } from "@/lib/types"

const ACTIVE_TIMER_STATUSES: TimerStatus[] = ["trabajando", "colacion", "pausado", "reunion"]
const RECENT_ACTIVITY_LIMIT = 6

function getTodayInChile() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
}

function trimDetail(text: string | null, maxLength = 140) {
  if (!text) return null

  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length === 0) return null
  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function countMentions(text: string | null) {
  if (!text) return 0
  return text.match(/(^|\s)@/g)?.length ?? 0
}

function formatSummary(input: {
  attachmentCount: number
  kind: "system" | "user"
  mentionCount: number
  text: string | null
}) {
  const hasText = Boolean(input.text?.trim())

  if (input.kind === "system") {
    return hasText ? "Actualizacion automatica" : "Evento del sistema"
  }

  if (input.attachmentCount > 0 && input.mentionCount > 0) {
    return `Compartio ${input.attachmentCount} adjunto${input.attachmentCount === 1 ? "" : "s"} y marco ${input.mentionCount} mencion${input.mentionCount === 1 ? "" : "es"}`
  }

  if (input.attachmentCount > 0) {
    return hasText
      ? `Compartio ${input.attachmentCount} adjunto${input.attachmentCount === 1 ? "" : "s"} con contexto`
      : `Subio ${input.attachmentCount} adjunto${input.attachmentCount === 1 ? "" : "s"}`
  }

  if (input.mentionCount > 0) {
    return hasText
      ? `Dejo seguimiento con ${input.mentionCount} mencion${input.mentionCount === 1 ? "" : "es"}`
      : `Genero ${input.mentionCount} mencion${input.mentionCount === 1 ? "" : "es"}`
  }

  return hasText ? "Dejo seguimiento operativo" : "Registro actividad"
}

function buildWorkerContext(input: {
  activeEntry?: {
    date: string
    projectName: string | null
    startTime: string
    status: TimerStatus
    taskId: string
    taskName: string | null
  } | null
  assignedWorker?: {
    id: string
    name: string
  } | null
  taskId: string
}): TaskWorkerCurrentTaskContext {
  if (!input.assignedWorker) {
    return {
      currentProjectName: null,
      currentTaskId: null,
      currentTaskName: null,
      entryDate: null,
      matchesCurrentTask: false,
      startTime: null,
      state: "unassigned",
      timerStatus: null,
      workerId: null,
      workerName: null,
    }
  }

  if (!input.activeEntry) {
    return {
      currentProjectName: null,
      currentTaskId: null,
      currentTaskName: null,
      entryDate: null,
      matchesCurrentTask: false,
      startTime: null,
      state: "idle",
      timerStatus: null,
      workerId: input.assignedWorker.id,
      workerName: input.assignedWorker.name,
    }
  }

  return {
    currentProjectName: input.activeEntry.projectName,
    currentTaskId: input.activeEntry.taskId,
    currentTaskName: input.activeEntry.taskName,
    entryDate: input.activeEntry.date,
    matchesCurrentTask: input.activeEntry.taskId === input.taskId,
    startTime: input.activeEntry.startTime,
    state: "active",
    timerStatus: input.activeEntry.status,
    workerId: input.assignedWorker.id,
    workerName: input.assignedWorker.name,
  }
}

export async function getTaskOperationalHistory(taskId: string): Promise<TaskOperationalHistorySummary> {
  const threadRows = await db
    .select({ id: taskChatThreads.id })
    .from(taskChatThreads)
    .where(eq(taskChatThreads.taskId, taskId))
    .limit(1)

  const threadId = threadRows[0]?.id ?? null

  const [assignedWorkerRows, statsRows] = await Promise.all([
    db
      .select({ id: user.id, name: user.name })
      .from(taskAssignments)
      .innerJoin(user, eq(taskAssignments.userId, user.id))
      .where(eq(taskAssignments.taskId, taskId))
      .limit(1),
    Promise.all([
      threadId
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(taskChatMessages)
            .where(eq(taskChatMessages.threadId, threadId))
        : Promise.resolve([{ count: 0 }]),
      threadId
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(taskChatAttachments)
            .where(and(eq(taskChatAttachments.threadId, threadId), isNotNull(taskChatAttachments.messageId)))
        : Promise.resolve([{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.entityType, "task"),
            eq(notifications.entityId, taskId),
            eq(notifications.type, "mention")
          )
        ),
    ]),
  ])

  const assignedWorker = assignedWorkerRows[0] ?? null
  const today = getTodayInChile()

  const activeEntryRows = assignedWorker
    ? await db
        .select({
          date: timeEntries.date,
          projectName: projects.name,
          startTime: timeEntries.startTime,
          status: timeEntries.status,
          taskId: timeEntries.taskId,
          taskName: tasks.name,
        })
        .from(timeEntries)
        .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
        .leftJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(
          and(
            eq(timeEntries.userId, assignedWorker.id),
            eq(timeEntries.date, today),
            inArray(timeEntries.status, ACTIVE_TIMER_STATUSES),
            isNull(timeEntries.endTime)
          )
        )
        .orderBy(desc(timeEntries.startTime))
        .limit(1)
    : []

  const recentMessages = threadId
    ? await db
        .select({
          authorName: user.name,
          authorRole: user.role,
          createdAt: taskChatMessages.createdAt,
          id: taskChatMessages.id,
          kind: taskChatMessages.kind,
          text: taskChatMessages.text,
        })
        .from(taskChatMessages)
        .leftJoin(user, eq(taskChatMessages.authorId, user.id))
        .where(eq(taskChatMessages.threadId, threadId))
        .orderBy(desc(taskChatMessages.createdAt), desc(taskChatMessages.id))
        .limit(RECENT_ACTIVITY_LIMIT)
    : []

  const attachmentCountRows = recentMessages.length > 0
    ? await db
        .select({
          count: sql<number>`count(*)::int`,
          messageId: taskChatAttachments.messageId,
        })
        .from(taskChatAttachments)
        .where(
          and(
            isNotNull(taskChatAttachments.messageId),
            inArray(taskChatAttachments.messageId, recentMessages.map((message) => message.id))
          )
        )
        .groupBy(taskChatAttachments.messageId)
    : []

  const attachmentCountByMessageId = new Map(
    attachmentCountRows.map((row) => [row.messageId as string, Number(row.count ?? 0)])
  )

  const recentActivity = recentMessages.map((message) => {
    const attachmentCount = attachmentCountByMessageId.get(message.id) ?? 0
    const mentionCount = countMentions(message.text)

    return {
      actorName: message.authorName ?? "Sistema",
      actorRole: message.authorRole ?? null,
      attachmentCount,
      createdAt: message.createdAt.toISOString(),
      detail: trimDetail(message.text),
      id: message.id,
      mentionCount,
      summary: formatSummary({
        attachmentCount,
        kind: message.kind,
        mentionCount,
        text: message.text,
      }),
    }
  })

  const [[messageCountRow], [attachmentCountRow], [mentionCountRow]] = statsRows

  return {
    lastActivityAt: recentActivity[0]?.createdAt ?? null,
    recentActivity,
    stats: {
      attachmentCount: Number(attachmentCountRow?.count ?? 0),
      mentionCount: Number(mentionCountRow?.count ?? 0),
      messageCount: Number(messageCountRow?.count ?? 0),
    },
    workerContext: buildWorkerContext({
      activeEntry: activeEntryRows[0]
        ? {
            date: activeEntryRows[0].date,
            projectName: activeEntryRows[0].projectName,
            startTime: activeEntryRows[0].startTime,
            status: activeEntryRows[0].status as TimerStatus,
            taskId: activeEntryRows[0].taskId,
            taskName: activeEntryRows[0].taskName,
          }
        : null,
      assignedWorker,
      taskId,
    }),
  }
}

export const taskOperationalHistoryInternals = {
  buildWorkerContext,
  countMentions,
  formatSummary,
  trimDetail,
}
