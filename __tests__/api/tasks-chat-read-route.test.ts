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
  TaskChatValidationError: class TaskChatValidationError extends Error {},
  getTaskChatService: vi.fn(),
}))

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import { getTaskChatService } from "@/lib/task-chat-service"
import { PATCH } from "@/app/api/tasks/[id]/chat/read/route"

const markReadMock = vi.fn()

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("PATCH /api/tasks/[id]/chat/read", () => {
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
      markRead: markReadMock,
    } as never)
  })

  it("returns the masked 404 when read access is hidden", async () => {
    vi.mocked(getTaskChatAccessContext).mockResolvedValue({
      context: null,
      error: null,
      maskAsNotFound: true,
    } as never)

    const request = new NextRequest("http://localhost/api/tasks/task-1/chat/read", {
      method: "PATCH",
      body: JSON.stringify({
        lastReadMessageId: "11111111-1111-4111-8111-111111111111",
      }),
      headers: {
        "content-type": "application/json",
      },
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: "task-1" }) })

    expect(response.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
    expect(markReadMock).not.toHaveBeenCalled()
  })

  it("marks the participant as read", async () => {
    markReadMock.mockResolvedValue({
      lastReadAt: new Date("2026-03-29T12:00:02.000Z"),
      lastReadMessageId: "11111111-1111-4111-8111-111111111111",
      unreadCount: 0,
    })

    const request = new NextRequest("http://localhost/api/tasks/task-1/chat/read", {
      method: "PATCH",
      body: JSON.stringify({
        lastReadMessageId: "11111111-1111-4111-8111-111111111111",
      }),
      headers: {
        "content-type": "application/json",
      },
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: "task-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.unreadCount).toBe(0)
    expect(markReadMock).toHaveBeenCalledWith({
      lastReadMessageId: "11111111-1111-4111-8111-111111111111",
      taskId: "task-1",
      userId: "admin-1",
    })
  })
})
