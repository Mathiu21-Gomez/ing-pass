import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let selectQueue: unknown[] = []
const updateReturning = vi.fn()
const insertValues = vi.fn(() => Promise.resolve())
const { syncProjectMembershipsForUser } = vi.hoisted(() => ({
  syncProjectMembershipsForUser: vi.fn(() => Promise.resolve(1)),
}))

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(() => null),
}))

vi.mock("@/lib/project-membership-store", () => ({
  syncProjectMembershipsForUser,
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: updateReturning,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    insert: vi.fn(() => ({
      values: insertValues,
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import { PATCH } from "@/app/api/users/[id]/route"

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue = [
      [{ id: "user-1", role: "trabajador", active: true, name: "Pat", email: "pat@test.com" }],
      [{ projectId: "project-1", role: "colaborador" }],
      [{ taskId: "task-1" }],
      [{ id: "role-coord", name: "coordinador" }],
      [{ id: "user-1", role: "coordinador", active: true, name: "Pat", email: "pat@test.com" }],
      [],
    ]
    updateReturning.mockResolvedValue([
      { id: "user-1", role: "coordinador", active: true, name: "Pat", email: "pat@test.com" },
    ])
    insertValues.mockResolvedValue(undefined)
    syncProjectMembershipsForUser.mockResolvedValue(1)

    vi.mocked(getAuthUser).mockResolvedValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        position: "Admin",
        active: true,
      },
      error: null,
    } as never)
  })

  it("resyncs project_members after promoting a worker to coordinador", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/users/user-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "coordinador" }),
      }),
      { params: Promise.resolve({ id: "user-1" }) }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(syncProjectMembershipsForUser).toHaveBeenCalledWith("user-1")
    expect(body.roleTransition).toEqual({
      changed: true,
      fromRole: "trabajador",
      toRole: "coordinador",
      removedProjectMemberships: 1,
      removedTaskAssignments: 1,
    })
  })
})
