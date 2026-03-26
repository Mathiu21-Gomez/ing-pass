import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn((user, roles) => {
    if (!roles.includes(user.role)) {
      return new Response(JSON.stringify({ error: "Sin permisos suficientes" }), { status: 403 })
    }

    return null
  }),
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import { GET, PATCH, DELETE } from "@/app/api/projects/[id]/route"

const makeAuthUser = (role: string) => ({
  id: "user-1",
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

const makeRequest = (method: "GET" | "PATCH" | "DELETE") =>
  new NextRequest("http://localhost/api/projects/project-1", {
    method,
    body: method === "PATCH" ? JSON.stringify({
      name: "Project",
      description: "Desc",
      clientId: "client-1",
      coordinatorId: "user-1",
      stage: "stage",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "Activo",
      assignedWorkers: [],
    }) : undefined,
    headers: method === "PATCH" ? { "content-type": "application/json" } : undefined,
  })

const makeParams = () => ({ params: Promise.resolve({ id: "project-1" }) })

describe("/api/projects/[id] auth hardening", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 403 when trabajador tries to read a project by id", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador"),
      error: null,
    } as never)

    const res = await GET(makeRequest("GET"), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when trabajador tries to patch a project", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador"),
      error: null,
    } as never)

    const res = await PATCH(makeRequest("PATCH"), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when trabajador tries to delete a project", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador"),
      error: null,
    } as never)

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(403)
  })
})
