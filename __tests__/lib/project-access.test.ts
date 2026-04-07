import { beforeEach, describe, expect, it, vi } from "vitest"

let selectQueue: unknown[] = []

const baseProjectContext = {
  projectId: "project-1",
  coordinatorId: "coord-1",
  clientEmail: "client@test.com",
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
        })),
        where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
      })),
    })),
  },
}))

vi.mock("@/lib/project-membership-store", () => ({
  getProjectMembership: vi.fn(() => Promise.resolve({
    projectId: "project-1",
    coordinatorIds: ["coord-1"],
    assignedWorkerIds: ["worker-1"],
    projectMembers: [
      { userId: "coord-1", role: "coordinador" },
      { userId: "worker-1", role: "colaborador" },
    ],
  })),
}))

import { getProjectAccessContext } from "@/lib/project-access"

const makeUser = (role: string, id = "user-1", email = "test@test.com") => ({
  id,
  name: "Test",
  email,
  role,
  position: "Dev",
  active: true,
})

describe("getProjectAccessContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue = [
      [baseProjectContext],
    ]
  })

  it("allows the matching external client", async () => {
    const result = await getProjectAccessContext(
      "project-1",
      makeUser("externo", "ext-1", "client@test.com")
    )

    expect(result.error).toBeNull()
    expect(result.context).toEqual({
      ...baseProjectContext,
      coordinatorIds: ["coord-1"],
    })
  })

  it("conceals projects from unrelated external users", async () => {
    const result = await getProjectAccessContext(
      "project-1",
      makeUser("externo", "ext-1", "other@test.com")
    )

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })

  it("allows workers assigned to the project", async () => {
    selectQueue.push([{ projectId: "project-1" }])

    const result = await getProjectAccessContext(
      "project-1",
      makeUser("trabajador", "worker-1")
    )

    expect(result.error).toBeNull()
    expect(result.context).toEqual({
      projectId: "project-1",
      coordinatorId: "coord-1",
      coordinatorIds: ["coord-1"],
      clientEmail: "client@test.com",
    })
  })

  it("conceals projects from workers outside the project", async () => {
    selectQueue.push([])

    const result = await getProjectAccessContext(
      "project-1",
      makeUser("trabajador", "worker-2")
    )

    expect(result.context).toBeNull()
    expect(result.error?.status).toBe(404)
  })
})
