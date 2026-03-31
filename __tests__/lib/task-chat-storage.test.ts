import { beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"

const { mkdirMock, randomUUIDMock, unlinkMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(() => Promise.resolve()),
  randomUUIDMock: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  unlinkMock: vi.fn(() => Promise.resolve()),
  writeFileMock: vi.fn(() => Promise.resolve()),
}))

const mockDb = {
  threadRows: [] as Array<{ id: string }>,
  insertCalls: [] as unknown[],
}

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  unlink: unlinkMock,
  writeFile: writeFileMock,
}))

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(mockDb.threadRows)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => ({
        returning: vi.fn(() => {
          mockDb.insertCalls.push(values)

          if (mockDb.insertCalls.length === 1 && mockDb.threadRows.length === 0) {
            return Promise.resolve([{ id: "thread-created" }])
          }

          if (mockDb.insertCalls.length === (mockDb.threadRows.length === 0 ? 2 : 1)) {
            return Promise.resolve([{
              id: "document-1",
              name: (values as { name: string }).name,
              type: (values as { type: string }).type,
              sizeBytes: (values as { sizeBytes: number }).sizeBytes,
            }])
          }

          return Promise.resolve([{ id: "attachment-row-1" }])
        }),
      })),
    })),
  },
}))

import { stageTaskChatAttachment } from "@/lib/task-chat-storage"

describe("stageTaskChatAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.threadRows = []
    mockDb.insertCalls = []
  })

  it("creates a pending attachment, stores the blob privately, and bootstraps the thread", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "evidence.png", { type: "image/png" })

    const result = await stageTaskChatAttachment({
      file,
      projectId: "project-1",
      taskId: "task-1",
      uploaderId: "user-1",
    })

    expect(result).toEqual({
      attachmentId: "11111111-1111-4111-8111-111111111111",
      fileName: "evidence.png",
      mimeType: "image/png",
      sizeBytes: 3,
      source: "manual",
      status: "pending",
    })
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(mkdirMock).toHaveBeenCalledTimes(1)
    expect(mockDb.insertCalls).toHaveLength(3)
    expect(mockDb.insertCalls[0]).toMatchObject({
      createdBy: "user-1",
      taskId: "task-1",
    })
    expect(mockDb.insertCalls[1]).toMatchObject({
      name: "evidence.png",
      projectId: "project-1",
      sizeBytes: 3,
      taskId: "task-1",
      type: "image/png",
      uploadedBy: "user-1",
    })
    expect(mockDb.insertCalls[2]).toMatchObject({
      documentId: "document-1",
      id: "11111111-1111-4111-8111-111111111111",
      messageId: null,
      source: "manual",
      threadId: "thread-created",
      uploadedBy: "user-1",
    })
  })

  it("reuses the existing thread when the task already has one", async () => {
    mockDb.threadRows = [{ id: "thread-existing" }]

    const file = new File([new Uint8Array([1, 2, 3])], "clipboard.webp", { type: "image/webp" })

    await stageTaskChatAttachment({
      file,
      projectId: "project-1",
      source: "clipboard",
      taskId: "task-1",
      uploaderId: "user-1",
    })

    expect(mockDb.insertCalls).toHaveLength(2)
    expect(mockDb.insertCalls[1]).toMatchObject({
      source: "clipboard",
      threadId: "thread-existing",
    })
  })

  it("rejects unsupported files before touching storage", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "archive.zip", { type: "application/zip" })

    await expect(stageTaskChatAttachment({
      file,
      projectId: "project-1",
      taskId: "task-1",
      uploaderId: "user-1",
    })).rejects.toBeInstanceOf(ZodError)

    expect(writeFileMock).not.toHaveBeenCalled()
    expect(mockDb.insertCalls).toHaveLength(0)
    expect(unlinkMock).not.toHaveBeenCalled()
  })
})
