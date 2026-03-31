import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDb = {
  taskRows: [] as Array<{ taskId: string; projectId: string; coordinatorId: string }>,
  projectMembershipRows: [] as Array<{ projectId: string }>,
  taskAssignmentRows: [] as Array<{ taskId: string }>,
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn((selection) => {
      const keys = Object.keys(selection as Record<string, unknown>)

      if (keys.includes("taskId") && keys.includes("coordinatorId")) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve(mockDb.taskRows)),
            })),
          })),
        }
      }

      if (keys.includes("projectId")) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve(mockDb.projectMembershipRows)),
          })),
        }
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockDb.taskAssignmentRows)),
        })),
      }
    }),
  },
}))

import {
  createTaskChatNotFoundResponse,
  getTaskChatAccessContext,
} from "@/lib/task-chat-access"

const makeUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("getTaskChatAccessContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.taskRows = [
      {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
      },
    ]
    mockDb.projectMembershipRows = []
    mockDb.taskAssignmentRows = []
  })

  it("allows admin with full task-chat access", async () => {
    const result = await getTaskChatAccessContext("task-1", makeUser("admin", "admin-1"))

    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(false)
    expect(result.context).toEqual({
      taskId: "task-1",
      projectId: "project-1",
      coordinatorId: "coord-1",
      accessSource: "admin",
    })
  })

  it("allows the owning coordinador", async () => {
    const result = await getTaskChatAccessContext("task-1", makeUser("coordinador", "coord-1"))

    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(false)
    expect(result.context?.accessSource).toBe("coordinator")
  })

  it("masks tasks from other coordinadores", async () => {
    const result = await getTaskChatAccessContext("task-1", makeUser("coordinador", "coord-2"))

    expect(result.context).toBeNull()
    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(true)
  })

  it("allows trabajador assigned directly to the task", async () => {
    mockDb.taskAssignmentRows = [{ taskId: "task-1" }]

    const result = await getTaskChatAccessContext("task-1", makeUser("trabajador", "worker-1"))

    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(false)
    expect(result.context?.accessSource).toBe("task-assignment")
  })

  it("allows trabajador through project membership", async () => {
    mockDb.projectMembershipRows = [{ projectId: "project-1" }]

    const result = await getTaskChatAccessContext("task-1", makeUser("trabajador", "worker-1"))

    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(false)
    expect(result.context?.accessSource).toBe("project-membership")
  })

  it("masks task chat for trabajadores outside the task scope", async () => {
    const result = await getTaskChatAccessContext("task-1", makeUser("trabajador", "worker-2"))

    expect(result.context).toBeNull()
    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(true)
  })

  it("rejects externos with masked not-found semantics", async () => {
    const result = await getTaskChatAccessContext("task-1", makeUser("externo", "ext-1"))

    expect(result.context).toBeNull()
    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(true)
  })

  it("masks missing tasks so handlers can return 404", async () => {
    mockDb.taskRows = []

    const result = await getTaskChatAccessContext("missing-task", makeUser("admin", "admin-1"))

    expect(result.context).toBeNull()
    expect(result.error).toBeNull()
    expect(result.maskAsNotFound).toBe(true)
  })
})

describe("createTaskChatNotFoundResponse", () => {
  it("returns the masked 404 response for scoped handlers", async () => {
    const response = createTaskChatNotFoundResponse()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Chat de tarea no encontrado" })
  })
})
