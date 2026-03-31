import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/task-chat-access", () => ({
  createTaskChatNotFoundResponse: vi.fn(() =>
    NextResponse.json({ error: "Chat de tarea no encontrado" }, { status: 404 })
  ),
  getTaskChatAccessContext: vi.fn(),
}))

vi.mock("@/lib/task-chat-service", () => ({
  TaskChatNotFoundError: class TaskChatNotFoundError extends Error {},
  TaskChatValidationError: class TaskChatValidationError extends Error {
    details?: unknown

    constructor(message: string, details?: unknown) {
      super(message)
      this.details = details
    }
  },
  getTaskChatService: vi.fn(),
}))

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import {
  TaskChatValidationError,
  getTaskChatService,
} from "@/lib/task-chat-service"
import { GET, POST } from "@/app/api/tasks/[id]/chat/route"

const listMessagesMock = vi.fn()
const createMessageMock = vi.fn()

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("/api/tasks/[id]/chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    vi.mocked(getTaskChatAccessContext).mockResolvedValue({
      context: {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
        accessSource: "admin",
      },
      error: null,
      maskAsNotFound: false,
    } as never)

    vi.mocked(getTaskChatService).mockReturnValue({
      createMessage: createMessageMock,
      listMessages: listMessagesMock,
    } as never)
  })

  it("returns the masked 404 when task chat access is hidden", async () => {
    vi.mocked(getTaskChatAccessContext).mockResolvedValue({
      context: null,
      error: null,
      maskAsNotFound: true,
    } as never)

    const request = new NextRequest("http://localhost/api/tasks/task-1/chat")
    const response = await GET(request, { params: Promise.resolve({ id: "task-1" }) })

    expect(response.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
    expect(listMessagesMock).not.toHaveBeenCalled()
  })

  it("lists task chat messages using the parsed cursor contract", async () => {
    listMessagesMock.mockResolvedValue({
      messages: [],
      nextCursor: null,
      participant: {
        joinedAt: new Date("2026-03-29T12:00:00.000Z"),
        lastReadAt: null,
        lastReadMessageId: null,
      },
      thread: { id: "thread-1", taskId: "task-1" },
      unreadCount: 0,
    })

    const request = new NextRequest(
      "http://localhost/api/tasks/task-1/chat?cursor=11111111-1111-4111-8111-111111111111&limit=10"
    )
    const response = await GET(request, { params: Promise.resolve({ id: "task-1" }) })

    expect(response.status).toBe(200)
    expect(listMessagesMock).toHaveBeenCalledWith({
      cursor: "11111111-1111-4111-8111-111111111111",
      limit: 10,
      taskId: "task-1",
      userId: "admin-1",
    })
  })

  it("creates a task chat message and maps validation errors to 400", async () => {
    createMessageMock.mockRejectedValue(
      new TaskChatValidationError("Adjuntos inválidos", { attachmentIds: ["broken"] })
    )

    const request = new NextRequest("http://localhost/api/tasks/task-1/chat", {
      method: "POST",
      body: JSON.stringify({
        attachmentIds: ["11111111-1111-4111-8111-111111111111"],
        clientRequestId: "22222222-2222-4222-8222-222222222222",
      }),
      headers: {
        "content-type": "application/json",
      },
    })

    const response = await POST(request, { params: Promise.resolve({ id: "task-1" }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Adjuntos inválidos")
    expect(createMessageMock).toHaveBeenCalledWith({
      attachmentIds: ["11111111-1111-4111-8111-111111111111"],
      clientRequestId: "22222222-2222-4222-8222-222222222222",
      taskId: "task-1",
      text: undefined,
      userId: "admin-1",
    })
  })
})
