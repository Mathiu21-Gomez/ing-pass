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
    expect(result.context).toEqual(baseProjectContext)
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
