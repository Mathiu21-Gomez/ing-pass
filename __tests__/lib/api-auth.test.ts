import { describe, it, expect, vi } from "vitest"

// lib/api-auth importa lib/auth que importa db/index que requiere DATABASE_URL
// mockeamos auth para cortar esa cadena — requireRole no usa auth
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

import { requireRole } from "@/lib/api-auth"
import type { ApiUser } from "@/lib/api-auth"

const makeUser = (role: string): ApiUser => ({
  id: "user-1",
  name: "Test",
  email: "test@test.com",
  role,
  position: "Dev",
  active: true,
})

describe("requireRole", () => {
  it("returns null when role is allowed", () => {
    const result = requireRole(makeUser("admin"), ["admin", "coordinador"])
    expect(result).toBeNull()
  })

  it("returns 403 response when role is not allowed", async () => {
    const result = requireRole(makeUser("trabajador"), ["admin", "coordinador"])
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toBeDefined()
  })

  it("returns null for single-role match", () => {
    expect(requireRole(makeUser("admin"), ["admin"])).toBeNull()
  })

  it("returns 403 for externo on admin-only routes", async () => {
    const result = requireRole(makeUser("externo"), ["admin", "coordinador"])
    expect(result!.status).toBe(403)
  })
})
