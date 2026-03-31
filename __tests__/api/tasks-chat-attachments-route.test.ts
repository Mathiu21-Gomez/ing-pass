import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/task-chat-access", () => ({
  createTaskChatNotFoundResponse: vi.fn(() => NextResponse.json({ error: "Chat de tarea no encontrado" }, { status: 404 })),
  getTaskChatAccessContext: vi.fn(),
}))

vi.mock("@/lib/task-chat-storage", () => ({
  stageTaskChatAttachment: vi.fn(),
}))

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import { stageTaskChatAttachment } from "@/lib/task-chat-storage"
import { POST } from "@/app/api/tasks/[id]/chat/attachments/route"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("POST /api/tasks/[id]/chat/attachments", () => {
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

    vi.mocked(stageTaskChatAttachment).mockResolvedValue({
      attachmentId: "11111111-1111-4111-8111-111111111111",
      fileName: "evidence.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      source: "manual",
      status: "pending",
    } as never)
  })

  it("returns 404 when task chat access is masked", async () => {
    vi.mocked(getTaskChatAccessContext).mockResolvedValue({
      context: null,
      error: null,
      maskAsNotFound: true,
    } as never)

    const formData = new FormData()
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "masked.png", { type: "image/png" }))

    const req = new NextRequest("http://localhost/api/tasks/task-1/chat/attachments", {
      method: "POST",
      body: formData,
    })

    const res = await POST(req, { params: Promise.resolve({ id: "task-1" }) })

    expect(res.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
    expect(stageTaskChatAttachment).not.toHaveBeenCalled()
  })

  it("returns 400 when the multipart payload does not include a file", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task-1/chat/attachments", {
      method: "POST",
      body: new FormData(),
    })

    const res = await POST(req, { params: Promise.resolve({ id: "task-1" }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/campo file/i)
    expect(stageTaskChatAttachment).not.toHaveBeenCalled()
  })

  it("stages the uploaded image and returns attachment metadata", async () => {
    const formData = new FormData()
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "evidence.png", { type: "image/png" }))
    formData.set("source", "clipboard")

    const req = new NextRequest("http://localhost/api/tasks/task-1/chat/attachments", {
      method: "POST",
      body: formData,
    })

    const res = await POST(req, { params: Promise.resolve({ id: "task-1" }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({
      attachmentId: "11111111-1111-4111-8111-111111111111",
      fileName: "evidence.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      source: "manual",
      status: "pending",
    })
    expect(stageTaskChatAttachment).toHaveBeenCalledWith({
      file: expect.any(File),
      projectId: "project-1",
      source: "clipboard",
      taskId: "task-1",
      uploaderId: "admin-1",
    })
  })
})
