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

// El handler del dashboard hace múltiples select().from() sin .where() y algunos con .where()
// El objeto from() debe ser thenable (para await db.select().from(x))
// y también exponer .where() (para db.select().from(x).where(y))
const makeFromResult = (data: unknown[] = []) => {
  const obj = {
    then: (resolve: (v: unknown[]) => void) => resolve(data),
    where: vi.fn(() => Promise.resolve(data)),
  }
  return obj
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => makeFromResult([])),
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import { GET } from "@/app/api/dashboard/kpis/route"

const makeUser = (role: string) => ({
  id: "u1", name: "Test", email: "t@t.com", role, position: "", active: true,
})
const makeReq = () => new NextRequest("http://localhost/api/dashboard/kpis")

describe("GET /api/dashboard/kpis", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 403 for trabajador", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ user: makeUser("trabajador"), error: null } as never)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it("returns 403 for externo", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ user: makeUser("externo"), error: null } as never)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it("passes role check for admin (db mock returns empty data)", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ user: makeUser("admin"), error: null } as never)
    const res = await GET(makeReq())
    // Con el db mock retornando arrays vacíos, el handler puede terminar bien o crashear
    // Lo que nos importa: NO retorna 403
    expect(res.status).not.toBe(403)
  })

  it("passes role check for coordinador", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ user: makeUser("coordinador"), error: null } as never)
    const res = await GET(makeReq())
    expect(res.status).not.toBe(403)
  })
})
