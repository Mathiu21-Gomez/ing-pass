import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock de getAuthUser y requireRole
vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn((user, roles) => {
    if (!roles.includes(user.role)) {
      return new Response(JSON.stringify({ error: "Sin permisos suficientes" }), { status: 403 })
    }
    return null
  }),
}))

// Mock de db
const mockEntry = {
  id: "entry-1",
  userId: "owner-user",
  editable: true,
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockEntry])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockEntry])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([mockEntry])),
      })),
    })),
  },
}))

// Importar mocks para manipularlos en los tests
import { getAuthUser } from "@/lib/api-auth"
import { GET, PATCH, DELETE } from "@/app/api/time-entries/[id]/route"

const makeAuthUser = (role: string, id = "user-1") => ({
  id,
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

const makeRequest = (method = "PATCH", body = {}) =>
  new NextRequest("http://localhost/api/time-entries/entry-1", {
    method,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body),
    headers:
      method === "GET" || method === "DELETE"
        ? undefined
        : { "content-type": "application/json" },
  })

const makeParams = () => ({ params: Promise.resolve({ id: "entry-1" }) })

describe("PATCH /api/time-entries/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 403 when externo tries to edit any entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("externo", "external-user"),
      error: null,
    } as never)

    const res = await PATCH(makeRequest("PATCH", { notes: "test" }), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when trabajador tries to edit another user's entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador", "other-user"), // diferente al owner
      error: null,
    } as never)

    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it("allows trabajador to edit their own entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador", "owner-user"), // mismo userId que el entry
      error: null,
    } as never)

    const res = await PATCH(makeRequest("PATCH", { notes: "test" }), makeParams())
    expect(res.status).toBe(200)
  })

  it("allows admin to edit any entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("admin", "completely-different-id"),
      error: null,
    } as never)

    const res = await PATCH(makeRequest("PATCH", { notes: "test" }), makeParams())
    expect(res.status).toBe(200)
  })
})

describe("DELETE /api/time-entries/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 403 for trabajador", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador"),
      error: null,
    } as never)

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(403)
  })

  it("allows admin to delete", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("admin"),
      error: null,
    } as never)

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(200)
  })
})

describe("GET /api/time-entries/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 403 for externo", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("externo", "external-user"),
      error: null,
    } as never)

    const res = await GET(makeRequest("GET"), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when trabajador tries to read another user's entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador", "other-user"),
      error: null,
    } as never)

    const res = await GET(makeRequest("GET"), makeParams())
    expect(res.status).toBe(403)
  })

  it("allows trabajador to read their own entry", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeAuthUser("trabajador", "owner-user"),
      error: null,
    } as never)

    const res = await GET(makeRequest("GET"), makeParams())
    expect(res.status).toBe(200)
  })
})
