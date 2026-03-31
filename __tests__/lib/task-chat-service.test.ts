import { beforeEach, describe, expect, it } from "vitest"

import {
  TaskChatNotFoundError,
  TaskChatValidationError,
  createTaskChatService,
} from "@/lib/task-chat-service"

type ThreadRecord = {
  id: string
  taskId: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

type ParticipantRecord = {
  threadId: string
  userId: string
  lastReadMessageId: string | null
  lastReadAt: Date | null
  joinedAt: Date
}

type MessageRecord = {
  id: string
  threadId: string
  authorId: string | null
  authorName: string | null
  authorRole: string | null
  kind: "user" | "system"
  clientRequestId: string
  text: string | null
  createdAt: Date
}

type AttachmentRecord = {
  id: string
  threadId: string
  messageId: string | null
  documentId: string
  uploadedBy: string
  source: "manual" | "clipboard"
  sortOrder: number
  fileName: string
  mimeType: string
  sizeBytes: number
  taskId: string
}

function createRepository() {
  const now = new Date("2026-03-29T12:00:00.000Z")
  const state = {
    attachments: [] as AttachmentRecord[],
    messages: [] as MessageRecord[],
    participants: [] as ParticipantRecord[],
    threads: [] as ThreadRecord[],
  }

  let threadSequence = 1
  let messageSequence = 1

  const repository = {
    state,
    async bindAttachmentsToMessage(params: {
      attachmentIds: string[]
      messageId: string
    }) {
      params.attachmentIds.forEach((attachmentId, index) => {
        const attachment = state.attachments.find((item) => item.id === attachmentId)

        if (!attachment) {
          throw new Error(`Attachment ${attachmentId} missing in test repository`)
        }

        attachment.messageId = params.messageId
        attachment.sortOrder = index
      })
    },
    async countUnreadMessages(params: {
      lastReadAt: Date | null
      lastReadMessageId: string | null
      threadId: string
      userId: string
    }) {
      return state.messages.filter((message) => {
        if (message.threadId !== params.threadId || message.authorId === params.userId) {
          return false
        }

        if (!params.lastReadAt) return true
        if (message.createdAt > params.lastReadAt) return true
        if (
          params.lastReadMessageId &&
          message.createdAt.getTime() === params.lastReadAt.getTime()
        ) {
          return message.id > params.lastReadMessageId
        }

        return false
      }).length
    },
    async createMessage(params: {
      authorId: string
      clientRequestId: string
      kind: "user" | "system"
      text: string | null
      threadId: string
    }) {
      const message: MessageRecord = {
        id: `message-${messageSequence++}`,
        threadId: params.threadId,
        authorId: params.authorId,
        authorName: params.authorId,
        authorRole: "admin",
        kind: params.kind,
        clientRequestId: params.clientRequestId,
        text: params.text,
        createdAt: new Date(now.getTime() + messageSequence * 1000),
      }

      state.messages.push(message)
      return message
    },
    async createThread(params: { createdBy: string; taskId: string }) {
      const thread: ThreadRecord = {
        id: `thread-${threadSequence++}`,
        taskId: params.taskId,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      }

      state.threads.push(thread)
      return thread
    },
    async ensureParticipant(params: { threadId: string; userId: string }) {
      const existing = state.participants.find(
        (item) => item.threadId === params.threadId && item.userId === params.userId
      )

      if (existing) return existing

      const participant: ParticipantRecord = {
        threadId: params.threadId,
        userId: params.userId,
        lastReadMessageId: null,
        lastReadAt: null,
        joinedAt: now,
      }

      state.participants.push(participant)
      return participant
    },
    async findMessageByClientRequestId(params: { clientRequestId: string; threadId: string }) {
      return state.messages.find(
        (item) =>
          item.threadId === params.threadId && item.clientRequestId === params.clientRequestId
      ) ?? null
    },
    async findThreadByTaskId(taskId: string) {
      return state.threads.find((item) => item.taskId === taskId) ?? null
    },
    async getAttachmentsByMessageIds(messageIds: string[]) {
      return state.attachments
        .filter((item) => item.messageId && messageIds.includes(item.messageId))
        .map((item) => ({
          fileName: item.fileName,
          id: item.id,
          messageId: item.messageId as string,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          source: item.source,
        }))
    },
    async getMessageById(messageId: string) {
      return state.messages.find((item) => item.id === messageId) ?? null
    },
    async getMessageCursor(params: { messageId: string; threadId: string }) {
      const message = state.messages.find(
        (item) => item.threadId === params.threadId && item.id === params.messageId
      )

      if (!message) return null

      return {
        createdAt: message.createdAt,
        id: message.id,
      }
    },
    async getParticipant(params: { threadId: string; userId: string }) {
      return state.participants.find(
        (item) => item.threadId === params.threadId && item.userId === params.userId
      ) ?? null
    },
    async getPendingAttachments(params: { attachmentIds: string[] }) {
      return state.attachments
        .filter((item) => params.attachmentIds.includes(item.id) && item.messageId === null)
        .map((item) => ({
          fileName: item.fileName,
          id: item.id,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          source: item.source,
          taskId: item.taskId,
          threadId: item.threadId,
          uploadedBy: item.uploadedBy,
        }))
    },
    async listMessagesPage(params: {
      cursor: { createdAt: Date; id: string } | null
      limit: number
      threadId: string
    }) {
      const rows = state.messages
        .filter((item) => item.threadId === params.threadId)
        .filter((item) => {
          if (!params.cursor) return true
          if (item.createdAt < params.cursor.createdAt) return true
          if (item.createdAt > params.cursor.createdAt) return false
          return item.id < params.cursor.id
        })
        .sort((left, right) => {
          if (left.createdAt.getTime() === right.createdAt.getTime()) {
            return right.id.localeCompare(left.id)
          }

          return right.createdAt.getTime() - left.createdAt.getTime()
        })

      return rows.slice(0, params.limit)
    },
    async updateParticipantReadState(params: {
      lastReadAt: Date
      lastReadMessageId: string
      threadId: string
      userId: string
    }) {
      const participant = state.participants.find(
        (item) => item.threadId === params.threadId && item.userId === params.userId
      )

      if (!participant) {
        throw new Error("Participant missing in test repository")
      }

      participant.lastReadAt = params.lastReadAt
      participant.lastReadMessageId = params.lastReadMessageId
    },
  }

  return repository
}

describe("task-chat-service", () => {
  let repository: ReturnType<typeof createRepository>
  let service: ReturnType<typeof createTaskChatService>

  beforeEach(() => {
    repository = createRepository()
    service = createTaskChatService({ repository: repository as never })
  })

  it("creates the thread and participant lazily on first list", async () => {
    const result = await service.listMessages({
      limit: 20,
      taskId: "task-1",
      userId: "user-1",
    })

    expect(result.thread.id).toBe("thread-1")
    expect(result.messages).toEqual([])
    expect(result.unreadCount).toBe(0)
    expect(repository.state.threads).toHaveLength(1)
    expect(repository.state.participants).toEqual([
      expect.objectContaining({ threadId: "thread-1", userId: "user-1" }),
    ])
  })

  it("returns the latest page in ascending order with nextCursor and unread count", async () => {
    const thread = await repository.createThread({ createdBy: "user-1", taskId: "task-1" })
    await repository.ensureParticipant({ threadId: thread.id, userId: "user-1" })
    repository.state.participants[0].lastReadAt = new Date("2026-03-29T12:00:02.000Z")
    repository.state.participants[0].lastReadMessageId = "message-2"

    repository.state.messages.push(
      {
        id: "message-1",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "11111111-1111-4111-8111-111111111111",
        text: "uno",
        createdAt: new Date("2026-03-29T12:00:01.000Z"),
      },
      {
        id: "message-2",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "22222222-2222-4222-8222-222222222222",
        text: "dos",
        createdAt: new Date("2026-03-29T12:00:02.000Z"),
      },
      {
        id: "message-3",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "33333333-3333-4333-8333-333333333333",
        text: "tres",
        createdAt: new Date("2026-03-29T12:00:03.000Z"),
      },
      {
        id: "message-4",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "44444444-4444-4444-8444-444444444444",
        text: "cuatro",
        createdAt: new Date("2026-03-29T12:00:04.000Z"),
      }
    )

    const result = await service.listMessages({
      limit: 2,
      taskId: "task-1",
      userId: "user-1",
    })

    expect(result.messages.map((message) => message.id)).toEqual(["message-3", "message-4"])
    expect(result.nextCursor).toBe("message-3")
    expect(result.unreadCount).toBe(2)
  })

  it("creates a message, binds staged attachments, and marks the author as read", async () => {
    const thread = await repository.createThread({ createdBy: "user-1", taskId: "task-1" })
    await repository.ensureParticipant({ threadId: thread.id, userId: "user-1" })
    repository.state.attachments.push({
      documentId: "document-1",
      fileName: "evidence.png",
      id: "attachment-1",
      messageId: null,
      mimeType: "image/png",
      sizeBytes: 1024,
      sortOrder: 0,
      source: "manual",
      taskId: "task-1",
      threadId: thread.id,
      uploadedBy: "user-1",
    })

    const result = await service.createMessage({
      attachmentIds: ["attachment-1"],
      clientRequestId: "55555555-5555-4555-8555-555555555555",
      taskId: "task-1",
      text: "Hola equipo",
      userId: "user-1",
    })

    expect(result.attachments).toEqual([
      expect.objectContaining({ id: "attachment-1", fileName: "evidence.png" }),
    ])
    expect(repository.state.attachments[0].messageId).toBe(result.id)
    expect(repository.state.participants[0].lastReadMessageId).toBe(result.id)
    expect(result.unreadCount).toBe(0)
  })

  it("returns the same message when clientRequestId is retried", async () => {
    const thread = await repository.createThread({ createdBy: "user-1", taskId: "task-1" })
    await repository.ensureParticipant({ threadId: thread.id, userId: "user-1" })

    const first = await service.createMessage({
      clientRequestId: "66666666-6666-4666-8666-666666666666",
      taskId: "task-1",
      text: "Idempotente",
      userId: "user-1",
    })

    const second = await service.createMessage({
      clientRequestId: "66666666-6666-4666-8666-666666666666",
      taskId: "task-1",
      text: "No deberia duplicarse",
      userId: "user-1",
    })

    expect(second.id).toBe(first.id)
    expect(repository.state.messages).toHaveLength(1)
  })

  it("rejects an empty message when staged attachments are invalid", async () => {
    await expect(service.createMessage({
      attachmentIds: ["missing-attachment"],
      clientRequestId: "77777777-7777-4777-8777-777777777777",
      taskId: "task-1",
      text: undefined,
      userId: "user-1",
    })).rejects.toBeInstanceOf(TaskChatValidationError)
  })

  it("marks the participant as read up to the selected message", async () => {
    const thread = await repository.createThread({ createdBy: "user-1", taskId: "task-1" })
    await repository.ensureParticipant({ threadId: thread.id, userId: "user-1" })
    repository.state.messages.push(
      {
        id: "message-a",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "88888888-8888-4888-8888-888888888888",
        text: "uno",
        createdAt: new Date("2026-03-29T12:00:01.000Z"),
      },
      {
        id: "message-b",
        threadId: thread.id,
        authorId: "user-2",
        authorName: "Ana",
        authorRole: "trabajador",
        kind: "user",
        clientRequestId: "99999999-9999-4999-8999-999999999999",
        text: "dos",
        createdAt: new Date("2026-03-29T12:00:02.000Z"),
      }
    )

    const result = await service.markRead({
      lastReadMessageId: "message-b",
      taskId: "task-1",
      userId: "user-1",
    })

    expect(result.unreadCount).toBe(0)
    expect(repository.state.participants[0].lastReadMessageId).toBe("message-b")
  })

  it("rejects markRead when the message does not belong to the thread", async () => {
    await expect(service.markRead({
      lastReadMessageId: "missing-message",
      taskId: "task-1",
      userId: "user-1",
    })).rejects.toBeInstanceOf(TaskChatNotFoundError)
  })
})
