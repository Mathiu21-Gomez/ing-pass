import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let mockSelectRows: Array<{ id: string; projectId: string | null }> = []
let insertedValues: unknown[] = []
let deleteWhereCalls = 0
let transactionCalls = 0

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/task-access", () => ({
  getTaskAccessContext: vi.fn(),
}))

vi.mock("@/lib/validate-attachments", () => ({
  validateAttachments: vi.fn(() => null),
}))

vi.mock("@/db", () => {
  const createInsertMock = () =>
    vi.fn(() => ({
      values: vi.fn((values) => {
        insertedValues.push(values)

        return {
          returning: vi.fn(() => Promise.resolve([{ id: "created-1", ...(values as Record<string, unknown>) }])),
        }
      }),
    }))

  const createDeleteMock = () =>
    vi.fn(() => ({
      where: vi.fn(() => {
        deleteWhereCalls += 1
        return Promise.resolve()
      }),
    }))

  const createTransactionClient = () => ({
    delete: createDeleteMock(),
    insert: createInsertMock(),
  })

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockSelectRows)),
        })),
      })),
      insert: createInsertMock(),
      delete: createDeleteMock(),
      transaction: vi.fn(async (callback: (tx: ReturnType<typeof createTransactionClient>) => Promise<unknown>) => {
        transactionCalls += 1
        return callback(createTransactionClient())
      }),
    },
  }
})

import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"
import { POST as postComment } from "@/app/api/tasks/[id]/comments/route"
import { PUT as putTags } from "@/app/api/tasks/[id]/tags/route"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("/api/tasks/[id] subroutes hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectRows = []
    insertedValues = []
    deleteWhereCalls = 0
    transactionCalls = 0

    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    vi.mocked(getTaskAccessContext).mockResolvedValue({
      context: {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
      },
      error: null,
    } as never)
  })

  it("forces comments created from /comments to stay attached to the task route id", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task-1/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Nuevo comentario",
        parentType: "activity",
        parentId: "activity-9",
        referenceId: "REF-1",
      }),
    })

    const res = await postComment(req, { params: Promise.resolve({ id: "task-1" }) })
    const payload = insertedValues[0] as Record<string, unknown>

    expect(res.status).toBe(201)
    expect(payload.parentType).toBe("task")
    expect(payload.parentId).toBe("task-1")
    expect(payload.referenceId).toBe("REF-1")
  })

  it("rejects tags that belong to another project", async () => {
    mockSelectRows = [{ id: "tag-1", projectId: "other-project" }]

    const req = new NextRequest("http://localhost/api/tasks/task-1/tags", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds: ["tag-1"] }),
    })

    const res = await putTags(req, { params: Promise.resolve({ id: "task-1" }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no pertenecen al proyecto/i)
    expect(deleteWhereCalls).toBe(0)
    expect(transactionCalls).toBe(0)
  })

  it("replaces task tags inside a single transaction", async () => {
    mockSelectRows = [{ id: "tag-1", projectId: "project-1" }]

    const req = new NextRequest("http://localhost/api/tasks/task-1/tags", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds: ["tag-1", "tag-1"] }),
    })

    const res = await putTags(req, { params: Promise.resolve({ id: "task-1" }) })

    expect(res.status).toBe(200)
    expect(transactionCalls).toBe(1)
    expect(deleteWhereCalls).toBe(1)
    expect(insertedValues).toEqual([[{ taskId: "task-1", tagId: "tag-1" }]])
  })
})
