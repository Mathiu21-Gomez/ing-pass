import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let rootSelectRows: unknown[] = []
let transactionSelectRows: unknown[] = []
let batchCalls = 0
let deleteWhereCalls = 0
let insertedValues: unknown[] = []

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/task-access", () => ({
  getTaskAccessContext: vi.fn(),
}))

vi.mock("@/db", () => {
  const createSelectMock = (source: "root" | "transaction") =>
    vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(source === "root" ? rootSelectRows : transactionSelectRows)),
      })),
    }))

  const createUpdateMock = () =>
    vi.fn(() => ({
      set: vi.fn((values) => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "task-1", ...values }])),
        })),
      })),
    }))

  const createDeleteMock = () =>
    vi.fn(() => ({
      where: vi.fn(() => {
        deleteWhereCalls += 1
        return Promise.resolve()
      }),
    }))

  const createInsertMock = () =>
    vi.fn(() => ({
      values: vi.fn((values) => {
        insertedValues.push(values)
        return Promise.resolve()
      }),
    }))

  return {
    db: {
      select: createSelectMock("root"),
      update: createUpdateMock(),
      delete: createDeleteMock(),
      insert: createInsertMock(),
      batch: vi.fn(async (queries: Promise<unknown>[]) => {
        batchCalls += 1
        return Promise.all(queries)
      }),
    },
  }
})

import { getAuthUser } from "@/lib/api-auth"
import { getTaskAccessContext } from "@/lib/task-access"
import { PATCH } from "@/app/api/tasks/[id]/route"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

const makeParams = () => ({ params: Promise.resolve({ id: "task-1" }) })

describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rootSelectRows = [{ id: "task-1", name: "Existing task" }]
    transactionSelectRows = [{ id: "task-1", name: "Existing task" }]
    batchCalls = 0
    deleteWhereCalls = 0
    insertedValues = []

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

  it("updates the task and replaces assignments in a single Neon batch", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Renamed task",
        assignedTo: ["worker-1", "worker-1", "worker-2"],
      }),
    })

    const res = await PATCH(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(batchCalls).toBe(1)
    expect(deleteWhereCalls).toBe(1)
    expect(insertedValues[0]).toEqual([{ taskId: "task-1", userId: "worker-1" }, { taskId: "task-1", userId: "worker-2" }])
    expect(body.assignedTo).toEqual(["worker-1", "worker-2"])
  })

  it("rejects invalid assignedTo payloads before mutating the task", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignedTo: ["worker-1", 42] }),
    })

    const res = await PATCH(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/assignedTo debe ser un array de strings/i)
    expect(batchCalls).toBe(0)
    expect(deleteWhereCalls).toBe(0)
    expect(insertedValues).toHaveLength(0)
  })
})
