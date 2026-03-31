import { beforeEach, describe, expect, it, vi } from "vitest"

let mockTaskRows: Array<{ taskId: string; projectId: string; coordinatorId: string }> = []

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockTaskRows)),
        })),
        // Direct .where() used in the trabajador assignment check
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}))

import { getTaskAccessContext } from "@/lib/task-access"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("getTaskAccessContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTaskRows = [
      {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
      },
    ]
  })

  it("allows admin to access any task context", async () => {
    const result = await getTaskAccessContext("task-1", makeUser("admin", "admin-1"))

    expect(result.error).toBeNull()
    expect(result.context).toEqual(mockTaskRows[0])
  })

  it("allows the owning coordinador", async () => {
    const result = await getTaskAccessContext("task-1", makeUser("coordinador", "coord-1"))

    expect(result.error).toBeNull()
    expect(result.context).toEqual(mockTaskRows[0])
  })

  it("conceals out-of-scope tasks from other coordinadores", async () => {
    const result = await getTaskAccessContext("task-1", makeUser("coordinador", "coord-2"))

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })

  it("returns 403 for trabajador", async () => {
    const result = await getTaskAccessContext("task-1", makeUser("trabajador", "worker-1"))

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(403)
  })

  it("returns 404 when the task does not exist", async () => {
    mockTaskRows = []

    const result = await getTaskAccessContext("missing-task", makeUser("admin", "admin-1"))

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })
})
