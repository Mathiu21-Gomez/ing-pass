import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDb = {
  projectRows: [] as Array<{ projectId: string; coordinatorId: string; clientEmail: string }>,
  taskRows: [] as Array<{ taskId: string; projectId: string; coordinatorId: string; clientEmail: string }>,
  projectMembershipRows: [] as Array<{ projectId: string }>,
  taskMembershipRows: [] as Array<{ taskId: string }>,
  sessionRows: [] as Array<{ sessionId: string | null; fromUserId: string; projectId: string | null; coordinatorId: string | null }>,
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn((selection) => {
      const keys = Object.keys(selection as Record<string, unknown>)

      if (keys.includes("clientEmail") && keys.includes("projectId") && !keys.includes("taskId")) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve(mockDb.projectRows)),
            })),
          })),
        }
      }

      if (keys.includes("clientEmail") && keys.includes("taskId")) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve(mockDb.taskRows)),
              })),
            })),
          })),
        }
      }

      if (keys.includes("sessionId") && keys.includes("fromUserId")) {
        return {
          from: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve(mockDb.sessionRows)),
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
          where: vi.fn(() => Promise.resolve(mockDb.taskMembershipRows)),
        })),
      }
    }),
  },
}))

vi.mock("@/lib/project-membership-store", () => ({
  getProjectMembership: vi.fn((projectId: string, options?: { legacyCoordinatorId?: string | null }) => {
    const coordinatorId = options?.legacyCoordinatorId ?? "coord-1"

    return Promise.resolve({
      projectId,
      coordinatorIds: [coordinatorId],
      assignedWorkerIds: ["worker-1"],
      projectMembers: [
        { userId: coordinatorId, role: "coordinador" },
        { userId: "worker-1", role: "colaborador" },
      ],
    })
  }),
}))

import {
  getProjectMessageAccessContext,
  getSessionMessageAccessContext,
  getTaskMessageAccessContext,
} from "@/lib/message-access"

const makeUser = (role: string, id = "user-1", email = "user@test.com") => ({
  id,
  name: "Test",
  email,
  role,
  position: "Dev",
  active: true,
})

describe("message access helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.projectRows = [
      {
        projectId: "project-1",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
    ]
    mockDb.taskRows = [
      {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
    ]
    mockDb.projectMembershipRows = []
    mockDb.taskMembershipRows = []
    mockDb.sessionRows = [
      {
        sessionId: "session-1",
        fromUserId: "worker-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
      },
      {
        sessionId: "session-1",
        fromUserId: "admin-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
      },
    ]
  })

  it("allows matching external users to access a project message context", async () => {
    const result = await getProjectMessageAccessContext(
      "project-1",
      makeUser("externo", "ext-1", "client@test.com")
    )

    expect(result.error).toBeNull()
    expect(result.context).toEqual({
      ...mockDb.projectRows[0],
      coordinatorIds: ["coord-1"],
    })
  })

  it("hides project message contexts from unrelated external users", async () => {
    const result = await getProjectMessageAccessContext(
      "project-1",
      makeUser("externo", "ext-1", "other@test.com")
    )

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })

  it("allows task message contexts for contextual project members", async () => {
    const result = await getTaskMessageAccessContext(
      "task-1",
      makeUser("trabajador", "worker-1")
    )

    expect(result.error).toBeNull()
    expect(result.context?.projectId).toBe("project-1")
  })

  it("hides task message contexts from workers outside the task project", async () => {
    const result = await getTaskMessageAccessContext(
      "task-1",
      makeUser("trabajador", "worker-2")
    )

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })

  it("allows workers to reuse their own session thread", async () => {
    const result = await getSessionMessageAccessContext(
      "session-1",
      makeUser("trabajador", "worker-1")
    )

    expect(result.exists).toBe(true)
    expect(result.error).toBeNull()
    expect(result.context).toEqual({ sessionId: "session-1" })
  })

  it("returns allowMissing when a session thread does not exist yet", async () => {
    mockDb.sessionRows = []

    const result = await getSessionMessageAccessContext(
      "session-new",
      makeUser("admin", "admin-1"),
      { allowMissing: true }
    )

    expect(result.exists).toBe(false)
    expect(result.error).toBeNull()
    expect(result.context).toBeNull()
  })
})
