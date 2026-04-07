import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let selectQueue: unknown[] = []

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
        })),
      })),
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import { GET } from "@/app/api/me/permissions/route"

describe("GET /api/me/permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue = []

    vi.mocked(getAuthUser).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Test",
        email: "test@test.com",
        role: "trabajador",
        position: "Dev",
        active: true,
      },
      error: null,
    } as never)
  })

  it("returns a drift error when user_roles is missing instead of falling back silently", async () => {
    selectQueue = [[], [{ role: "trabajador" }]]

    const response = await GET(new NextRequest("http://localhost/api/me/permissions"))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe("USER_ROLES_MISSING")
    expect(body.legacyRole).toBe("trabajador")
  })

  it("returns deduped permissions from the database when role mappings exist", async () => {
    selectQueue = [
      [{ roleId: "role-1" }, { roleId: "role-2" }],
      [
        { module: "projects", action: "view" },
        { module: "projects", action: "view" },
        { module: "tasks", action: "edit" },
      ],
    ]

    const response = await GET(new NextRequest("http://localhost/api/me/permissions"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("database")
    expect(body.permissions).toEqual(["projects:view", "tasks:edit"])
  })
})
