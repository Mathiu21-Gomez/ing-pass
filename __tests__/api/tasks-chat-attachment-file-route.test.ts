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
  deleteTaskChatStagedAttachment: vi.fn(),
  getTaskChatAttachmentFile: vi.fn(),
}))

import { getAuthUser } from "@/lib/api-auth"
import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"
import {
  deleteTaskChatStagedAttachment,
  getTaskChatAttachmentFile,
} from "@/lib/task-chat-storage"
import {
  DELETE,
  GET,
} from "@/app/api/tasks/[id]/chat/attachments/[attachmentId]/route"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("/api/tasks/[id]/chat/attachments/[attachmentId]", () => {
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
  })

  it("streams an accessible attachment", async () => {
    vi.mocked(getTaskChatAttachmentFile).mockResolvedValue({
      attachmentId: "att-1",
      body: Buffer.from("hello"),
      fileName: "evidence.png",
      messageId: "msg-1",
      mimeType: "image/png",
      sizeBytes: 5,
      taskId: "task-1",
      uploadedBy: "admin-1",
    } as never)

    const response = await GET(
      new NextRequest("http://localhost/api/tasks/task-1/chat/attachments/att-1"),
      { params: Promise.resolve({ attachmentId: "att-1", id: "task-1" }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(await response.text()).toBe("hello")
  })

  it("masks missing attachments as not found", async () => {
    vi.mocked(getTaskChatAttachmentFile).mockResolvedValue(null)

    const response = await GET(
      new NextRequest("http://localhost/api/tasks/task-1/chat/attachments/att-1"),
      { params: Promise.resolve({ attachmentId: "att-1", id: "task-1" }) }
    )

    expect(response.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
  })

  it("masks pending attachments from other uploaders", async () => {
    vi.mocked(getTaskChatAttachmentFile).mockResolvedValue({
      attachmentId: "att-1",
      body: Buffer.from("hello"),
      fileName: "evidence.png",
      messageId: null,
      mimeType: "image/png",
      sizeBytes: 5,
      taskId: "task-1",
      uploadedBy: "worker-2",
    } as never)

    const response = await GET(
      new NextRequest("http://localhost/api/tasks/task-1/chat/attachments/att-1"),
      { params: Promise.resolve({ attachmentId: "att-1", id: "task-1" }) }
    )

    expect(response.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
  })

  it("deletes staged attachments for the uploader", async () => {
    vi.mocked(deleteTaskChatStagedAttachment).mockResolvedValue(true)

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks/task-1/chat/attachments/att-1", { method: "DELETE" }),
      { params: Promise.resolve({ attachmentId: "att-1", id: "task-1" }) }
    )

    expect(response.status).toBe(200)
    expect(deleteTaskChatStagedAttachment).toHaveBeenCalledWith({
      attachmentId: "att-1",
      taskId: "task-1",
      uploaderId: "admin-1",
    })
  })

  it("returns 404 when deleting a missing staged attachment", async () => {
    vi.mocked(deleteTaskChatStagedAttachment).mockResolvedValue(false)

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks/task-1/chat/attachments/att-1", { method: "DELETE" }),
      { params: Promise.resolve({ attachmentId: "att-1", id: "task-1" }) }
    )

    expect(response.status).toBe(404)
    expect(createTaskChatNotFoundResponse).toHaveBeenCalledTimes(1)
  })
})
