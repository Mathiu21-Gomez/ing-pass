import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm"

import { db } from "@/db"
import {
  documents,
  taskChatAttachments,
  taskChatMessages,
  taskChatParticipants,
  taskChatThreads,
  user,
} from "@/db/schema"

type TaskChatMessageKind = "user" | "system"
type TaskChatAttachmentSource = "manual" | "clipboard"

interface TaskChatThreadRecord {
  id: string
  taskId: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

interface TaskChatParticipantRecord {
  threadId: string
  userId: string
  lastReadMessageId: string | null
  lastReadAt: Date | null
  joinedAt: Date
}

interface TaskChatMessageRecord {
  id: string
  threadId: string
  authorId: string | null
  authorName: string | null
  authorRole: string | null
  kind: TaskChatMessageKind
  clientRequestId: string
  text: string | null
  createdAt: Date
}

interface TaskChatMessageCursor {
  id: string
  createdAt: Date
}

interface TaskChatPendingAttachmentRecord {
  id: string
  threadId: string
  taskId: string | null
  uploadedBy: string
  fileName: string
  mimeType: string
  sizeBytes: number
  source: TaskChatAttachmentSource
}

interface TaskChatBoundAttachmentRecord {
  id: string
  messageId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  source: TaskChatAttachmentSource
}

export interface TaskChatAttachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  source: TaskChatAttachmentSource
}

export interface TaskChatMessage {
  id: string
  threadId: string
  kind: TaskChatMessageKind
  clientRequestId: string
  text: string | null
  createdAt: Date
  author: {
    id: string | null
    name: string | null
    role: string | null
  }
  attachments: TaskChatAttachment[]
}

export interface TaskChatListResult {
  thread: {
    id: string
    taskId: string
  }
  participant: {
    joinedAt: Date
    lastReadAt: Date | null
    lastReadMessageId: string | null
  }
  messages: TaskChatMessage[]
  nextCursor: string | null
  unreadCount: number
}

export interface TaskChatMarkReadResult {
  lastReadAt: Date
  lastReadMessageId: string
  unreadCount: number
}

export class TaskChatValidationError extends Error {
  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "TaskChatValidationError"
  }
}

export class TaskChatNotFoundError extends Error {
  constructor(message = "Mensaje de chat no encontrado") {
    super(message)
    this.name = "TaskChatNotFoundError"
  }
}

export interface TaskChatRepository {
  bindAttachmentsToMessage(params: { attachmentIds: string[]; messageId: string }): Promise<void>
  countUnreadMessages(params: {
    lastReadAt: Date | null
    lastReadMessageId: string | null
    threadId: string
    userId: string
  }): Promise<number>
  createMessage(params: {
    authorId: string
    clientRequestId: string
    kind: TaskChatMessageKind
    text: string | null
    threadId: string
  }): Promise<TaskChatMessageRecord>
  createThread(params: { createdBy: string; taskId: string }): Promise<TaskChatThreadRecord>
  ensureParticipant(params: { threadId: string; userId: string }): Promise<TaskChatParticipantRecord>
  findMessageByClientRequestId(params: {
    clientRequestId: string
    threadId: string
  }): Promise<TaskChatMessageRecord | null>
  findThreadByTaskId(taskId: string): Promise<TaskChatThreadRecord | null>
  getAttachmentsByMessageIds(messageIds: string[]): Promise<TaskChatBoundAttachmentRecord[]>
  getMessageById(messageId: string): Promise<TaskChatMessageRecord | null>
  getMessageCursor(params: {
    messageId: string
    threadId: string
  }): Promise<TaskChatMessageCursor | null>
  getParticipant(params: { threadId: string; userId: string }): Promise<TaskChatParticipantRecord | null>
  getPendingAttachments(params: {
    attachmentIds: string[]
  }): Promise<TaskChatPendingAttachmentRecord[]>
  listMessagesPage(params: {
    cursor: TaskChatMessageCursor | null
    limit: number
    threadId: string
  }): Promise<TaskChatMessageRecord[]>
  updateParticipantReadState(params: {
    lastReadAt: Date
    lastReadMessageId: string
    threadId: string
    userId: string
  }): Promise<void>
}

function normalizeText(text: string | null | undefined) {
  if (typeof text !== "string") return null

  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapMessage(
  message: TaskChatMessageRecord,
  attachmentsByMessageId: Map<string, TaskChatAttachment[]>
): TaskChatMessage {
  return {
    id: message.id,
    threadId: message.threadId,
    kind: message.kind,
    clientRequestId: message.clientRequestId,
    text: message.text,
    createdAt: message.createdAt,
    author: {
      id: message.authorId,
      name: message.authorName,
      role: message.authorRole,
    },
    attachments: attachmentsByMessageId.get(message.id) ?? [],
  }
}

function groupAttachmentsByMessage(
  attachments: TaskChatBoundAttachmentRecord[]
): Map<string, TaskChatAttachment[]> {
  const attachmentsByMessageId = new Map<string, TaskChatAttachment[]>()

  attachments.forEach((attachment) => {
    const bucket = attachmentsByMessageId.get(attachment.messageId) ?? []
    bucket.push({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      source: attachment.source,
    })
    attachmentsByMessageId.set(attachment.messageId, bucket)
  })

  return attachmentsByMessageId
}

async function hydrateMessage(
  repository: TaskChatRepository,
  message: TaskChatMessageRecord
): Promise<TaskChatMessage> {
  const attachments = await repository.getAttachmentsByMessageIds([message.id])
  return mapMessage(message, groupAttachmentsByMessage(attachments))
}

function createDefaultRepository(): TaskChatRepository {
  return {
    async bindAttachmentsToMessage({ attachmentIds, messageId }) {
      await Promise.all(
        attachmentIds.map((attachmentId, index) =>
          db
            .update(taskChatAttachments)
            .set({
              messageId,
              sortOrder: index,
            })
            .where(eq(taskChatAttachments.id, attachmentId))
        )
      )
    },
    async countUnreadMessages({ lastReadAt, lastReadMessageId, threadId, userId }) {
      const notOwnMessageCondition = or(
        isNull(taskChatMessages.authorId),
        ne(taskChatMessages.authorId, userId)
      )

      const unreadBoundaryCondition = !lastReadAt
        ? undefined
        : lastReadMessageId
          ? or(
              gt(taskChatMessages.createdAt, lastReadAt),
              and(
                eq(taskChatMessages.createdAt, lastReadAt),
                gt(taskChatMessages.id, lastReadMessageId)
              )
            )
          : gt(taskChatMessages.createdAt, lastReadAt)

      const whereCondition = unreadBoundaryCondition
        ? and(
            eq(taskChatMessages.threadId, threadId),
            notOwnMessageCondition,
            unreadBoundaryCondition
          )
        : and(eq(taskChatMessages.threadId, threadId), notOwnMessageCondition)

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(taskChatMessages)
        .where(whereCondition)

      return Number(row?.count ?? 0)
    },
    async createMessage({ authorId, clientRequestId, kind, text, threadId }) {
      const [created] = await db
        .insert(taskChatMessages)
        .values({
          authorId,
          clientRequestId,
          kind,
          text,
          threadId,
        })
        .returning({ id: taskChatMessages.id })

      const createdMessage = await this.getMessageById(created.id)
      if (!createdMessage) {
        throw new TaskChatNotFoundError("Mensaje creado no encontrado")
      }

      return createdMessage
    },
    async createThread({ createdBy, taskId }) {
      const [thread] = await db
        .insert(taskChatThreads)
        .values({ createdBy, taskId })
        .returning({
          id: taskChatThreads.id,
          taskId: taskChatThreads.taskId,
          createdBy: taskChatThreads.createdBy,
          createdAt: taskChatThreads.createdAt,
          updatedAt: taskChatThreads.updatedAt,
        })

      return thread
    },
    async ensureParticipant({ threadId, userId }) {
      const existing = await this.getParticipant({ threadId, userId })
      if (existing) return existing

      try {
        const [participant] = await db
          .insert(taskChatParticipants)
          .values({ threadId, userId })
          .returning({
            threadId: taskChatParticipants.threadId,
            userId: taskChatParticipants.userId,
            lastReadMessageId: taskChatParticipants.lastReadMessageId,
            lastReadAt: taskChatParticipants.lastReadAt,
            joinedAt: taskChatParticipants.joinedAt,
          })

        return participant
      } catch (error) {
        const participant = await this.getParticipant({ threadId, userId })
        if (participant) return participant
        throw error
      }
    },
    async findMessageByClientRequestId({ clientRequestId, threadId }) {
      const rows = await db
        .select({
          id: taskChatMessages.id,
          threadId: taskChatMessages.threadId,
          authorId: taskChatMessages.authorId,
          authorName: user.name,
          authorRole: user.role,
          kind: taskChatMessages.kind,
          clientRequestId: taskChatMessages.clientRequestId,
          text: taskChatMessages.text,
          createdAt: taskChatMessages.createdAt,
        })
        .from(taskChatMessages)
        .leftJoin(user, eq(taskChatMessages.authorId, user.id))
        .where(
          and(
            eq(taskChatMessages.threadId, threadId),
            eq(taskChatMessages.clientRequestId, clientRequestId)
          )
        )

      return rows[0] ?? null
    },
    async findThreadByTaskId(taskId) {
      const rows = await db
        .select({
          id: taskChatThreads.id,
          taskId: taskChatThreads.taskId,
          createdBy: taskChatThreads.createdBy,
          createdAt: taskChatThreads.createdAt,
          updatedAt: taskChatThreads.updatedAt,
        })
        .from(taskChatThreads)
        .where(eq(taskChatThreads.taskId, taskId))

      return rows[0] ?? null
    },
    async getAttachmentsByMessageIds(messageIds) {
      if (messageIds.length === 0) return []

      return db
        .select({
          id: taskChatAttachments.id,
          messageId: taskChatAttachments.messageId,
          fileName: documents.name,
          mimeType: documents.type,
          sizeBytes: documents.sizeBytes,
          source: taskChatAttachments.source,
        })
        .from(taskChatAttachments)
        .innerJoin(documents, eq(taskChatAttachments.documentId, documents.id))
        .where(inArray(taskChatAttachments.messageId, messageIds))
        .orderBy(taskChatAttachments.sortOrder)
        .then((rows) => rows.filter((row): row is TaskChatBoundAttachmentRecord => row.messageId !== null))
    },
    async getMessageById(messageId) {
      const rows = await db
        .select({
          id: taskChatMessages.id,
          threadId: taskChatMessages.threadId,
          authorId: taskChatMessages.authorId,
          authorName: user.name,
          authorRole: user.role,
          kind: taskChatMessages.kind,
          clientRequestId: taskChatMessages.clientRequestId,
          text: taskChatMessages.text,
          createdAt: taskChatMessages.createdAt,
        })
        .from(taskChatMessages)
        .leftJoin(user, eq(taskChatMessages.authorId, user.id))
        .where(eq(taskChatMessages.id, messageId))

      return rows[0] ?? null
    },
    async getMessageCursor({ messageId, threadId }) {
      const rows = await db
        .select({
          id: taskChatMessages.id,
          createdAt: taskChatMessages.createdAt,
        })
        .from(taskChatMessages)
        .where(
          and(eq(taskChatMessages.id, messageId), eq(taskChatMessages.threadId, threadId))
        )

      return rows[0] ?? null
    },
    async getParticipant({ threadId, userId }) {
      const rows = await db
        .select({
          threadId: taskChatParticipants.threadId,
          userId: taskChatParticipants.userId,
          lastReadMessageId: taskChatParticipants.lastReadMessageId,
          lastReadAt: taskChatParticipants.lastReadAt,
          joinedAt: taskChatParticipants.joinedAt,
        })
        .from(taskChatParticipants)
        .where(
          and(
            eq(taskChatParticipants.threadId, threadId),
            eq(taskChatParticipants.userId, userId)
          )
        )

      return rows[0] ?? null
    },
    async getPendingAttachments({ attachmentIds }) {
      if (attachmentIds.length === 0) return []

      return db
        .select({
          id: taskChatAttachments.id,
          threadId: taskChatAttachments.threadId,
          taskId: documents.taskId,
          uploadedBy: taskChatAttachments.uploadedBy,
          fileName: documents.name,
          mimeType: documents.type,
          sizeBytes: documents.sizeBytes,
          source: taskChatAttachments.source,
        })
        .from(taskChatAttachments)
        .innerJoin(documents, eq(taskChatAttachments.documentId, documents.id))
        .where(
          and(
            inArray(taskChatAttachments.id, attachmentIds),
            isNull(taskChatAttachments.messageId)
          )
        )
    },
    async listMessagesPage({ cursor, limit, threadId }) {
      const cursorCondition = !cursor
        ? undefined
        : or(
            lt(taskChatMessages.createdAt, cursor.createdAt),
            and(
              eq(taskChatMessages.createdAt, cursor.createdAt),
              lt(taskChatMessages.id, cursor.id)
            )
          )

      const whereCondition = cursorCondition
        ? and(eq(taskChatMessages.threadId, threadId), cursorCondition)
        : eq(taskChatMessages.threadId, threadId)

      return db
        .select({
          id: taskChatMessages.id,
          threadId: taskChatMessages.threadId,
          authorId: taskChatMessages.authorId,
          authorName: user.name,
          authorRole: user.role,
          kind: taskChatMessages.kind,
          clientRequestId: taskChatMessages.clientRequestId,
          text: taskChatMessages.text,
          createdAt: taskChatMessages.createdAt,
        })
        .from(taskChatMessages)
        .leftJoin(user, eq(taskChatMessages.authorId, user.id))
        .where(whereCondition)
        .orderBy(desc(taskChatMessages.createdAt), desc(taskChatMessages.id))
        .limit(limit)
    },
    async updateParticipantReadState({ lastReadAt, lastReadMessageId, threadId, userId }) {
      await db
        .update(taskChatParticipants)
        .set({ lastReadAt, lastReadMessageId })
        .where(
          and(
            eq(taskChatParticipants.threadId, threadId),
            eq(taskChatParticipants.userId, userId)
          )
        )
    },
  }
}

export function createTaskChatService(options?: { repository?: TaskChatRepository }) {
  const repository = options?.repository ?? createDefaultRepository()

  async function ensureThread(taskId: string, userId: string) {
    const existingThread = await repository.findThreadByTaskId(taskId)
    if (existingThread) return existingThread

    try {
      return await repository.createThread({ createdBy: userId, taskId })
    } catch (error) {
      const thread = await repository.findThreadByTaskId(taskId)
      if (thread) return thread
      throw error
    }
  }

  return {
    async createMessage(input: {
      attachmentIds?: string[]
      clientRequestId: string
      taskId: string
      text?: string
      userId: string
    }): Promise<TaskChatMessage & { unreadCount: number }> {
      const thread = await ensureThread(input.taskId, input.userId)
      const participant = await repository.ensureParticipant({
        threadId: thread.id,
        userId: input.userId,
      })
      const existingMessage = await repository.findMessageByClientRequestId({
        clientRequestId: input.clientRequestId,
        threadId: thread.id,
      })

      if (existingMessage) {
        const message = await hydrateMessage(repository, existingMessage)
        const unreadCount = await repository.countUnreadMessages({
          lastReadAt: participant.lastReadAt,
          lastReadMessageId: participant.lastReadMessageId,
          threadId: thread.id,
          userId: input.userId,
        })

        return {
          ...message,
          unreadCount,
        }
      }

      const text = normalizeText(input.text)
      const requestedAttachmentIds = input.attachmentIds ?? []
      const pendingAttachments = requestedAttachmentIds.length > 0
        ? await repository.getPendingAttachments({ attachmentIds: requestedAttachmentIds })
        : []

      if (requestedAttachmentIds.length !== pendingAttachments.length) {
        if (!text) {
          throw new TaskChatValidationError("Debes enviar text o attachmentIds válidos")
        }

        throw new TaskChatValidationError("attachmentIds inválidos o no accesibles")
      }

      const pendingAttachmentsById = new Map(
        pendingAttachments.map((attachment) => [attachment.id, attachment])
      )

      const orderedPendingAttachments = requestedAttachmentIds.map((attachmentId) => {
        const attachment = pendingAttachmentsById.get(attachmentId)

        if (!attachment) {
          throw new TaskChatValidationError("attachmentIds inválidos o no accesibles")
        }

        if (
          attachment.taskId !== input.taskId ||
          attachment.threadId !== thread.id ||
          attachment.uploadedBy !== input.userId
        ) {
          throw new TaskChatValidationError("attachmentIds inválidos o no accesibles")
        }

        return attachment
      })

      if (!text && orderedPendingAttachments.length === 0) {
        throw new TaskChatValidationError("Debes enviar text o attachmentIds válidos")
      }

      const createdMessage = await repository.createMessage({
        authorId: input.userId,
        clientRequestId: input.clientRequestId,
        kind: "user",
        text,
        threadId: thread.id,
      })

      if (orderedPendingAttachments.length > 0) {
        await repository.bindAttachmentsToMessage({
          attachmentIds: orderedPendingAttachments.map((attachment) => attachment.id),
          messageId: createdMessage.id,
        })
      }

      await repository.updateParticipantReadState({
        lastReadAt: createdMessage.createdAt,
        lastReadMessageId: createdMessage.id,
        threadId: thread.id,
        userId: input.userId,
      })

      const hydratedMessage = await hydrateMessage(repository, createdMessage)
      const unreadCount = await repository.countUnreadMessages({
        lastReadAt: createdMessage.createdAt,
        lastReadMessageId: createdMessage.id,
        threadId: thread.id,
        userId: input.userId,
      })

      return {
        ...hydratedMessage,
        unreadCount,
      }
    },
    async listMessages(input: {
      cursor?: string
      limit: number
      taskId: string
      userId: string
    }): Promise<TaskChatListResult> {
      const thread = await ensureThread(input.taskId, input.userId)
      const participant = await repository.ensureParticipant({
        threadId: thread.id,
        userId: input.userId,
      })
      const cursor = input.cursor
        ? await repository.getMessageCursor({ messageId: input.cursor, threadId: thread.id })
        : null

      if (input.cursor && !cursor) {
        throw new TaskChatNotFoundError()
      }

      const page = await repository.listMessagesPage({
        cursor,
        limit: input.limit + 1,
        threadId: thread.id,
      })
      const hasMore = page.length > input.limit
      const pageMessages = hasMore ? page.slice(0, input.limit) : page
      const orderedMessages = [...pageMessages].reverse()
      const attachments = await repository.getAttachmentsByMessageIds(
        orderedMessages.map((message) => message.id)
      )
      const unreadCount = await repository.countUnreadMessages({
        lastReadAt: participant.lastReadAt,
        lastReadMessageId: participant.lastReadMessageId,
        threadId: thread.id,
        userId: input.userId,
      })

      return {
        thread: {
          id: thread.id,
          taskId: thread.taskId,
        },
        participant: {
          joinedAt: participant.joinedAt,
          lastReadAt: participant.lastReadAt,
          lastReadMessageId: participant.lastReadMessageId,
        },
        messages: orderedMessages.map((message) =>
          mapMessage(message, groupAttachmentsByMessage(attachments))
        ),
        nextCursor: hasMore && orderedMessages[0] ? orderedMessages[0].id : null,
        unreadCount,
      }
    },
    async markRead(input: {
      lastReadMessageId: string
      taskId: string
      userId: string
    }): Promise<TaskChatMarkReadResult> {
      const thread = await ensureThread(input.taskId, input.userId)
      await repository.ensureParticipant({
        threadId: thread.id,
        userId: input.userId,
      })
      const messageCursor = await repository.getMessageCursor({
        messageId: input.lastReadMessageId,
        threadId: thread.id,
      })

      if (!messageCursor) {
        throw new TaskChatNotFoundError()
      }

      await repository.updateParticipantReadState({
        lastReadAt: messageCursor.createdAt,
        lastReadMessageId: messageCursor.id,
        threadId: thread.id,
        userId: input.userId,
      })

      const unreadCount = await repository.countUnreadMessages({
        lastReadAt: messageCursor.createdAt,
        lastReadMessageId: messageCursor.id,
        threadId: thread.id,
        userId: input.userId,
      })

      return {
        lastReadAt: messageCursor.createdAt,
        lastReadMessageId: messageCursor.id,
        unreadCount,
      }
    },
  }
}

let cachedTaskChatService: ReturnType<typeof createTaskChatService> | null = null

export function getTaskChatService() {
  if (!cachedTaskChatService) {
    cachedTaskChatService = createTaskChatService()
  }

  return cachedTaskChatService
}
