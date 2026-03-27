import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

const loadAuthModule = async () => {
  vi.resetModules()
  return import("@/lib/auth")
}

describe("auth host handling", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("keeps the canonical auth url and trusts the current Vercel origin", async () => {
    process.env.DATABASE_URL = "postgresql://user:password@db.example.com/app"
    process.env.BETTER_AUTH_SECRET = "super-secret-value-with-32-characters"
    process.env.BETTER_AUTH_URL = "https://app.example.com"
    process.env.VERCEL_URL = "ing-pass-git-feature-team.vercel.app"

    const { getTrustedAuthOrigins, getAllowedAuthHosts } = await loadAuthModule()

    expect(getAllowedAuthHosts()).toEqual([
      "app.example.com",
      "ing-pass-git-feature-team.vercel.app",
    ])
    expect(getTrustedAuthOrigins()).toEqual([
      "https://app.example.com",
      "https://ing-pass-git-feature-team.vercel.app",
    ])
  })

  it("merges optional extra allowed hosts without duplicating the canonical host", async () => {
    process.env.DATABASE_URL = "postgresql://user:password@db.example.com/app"
    process.env.BETTER_AUTH_SECRET = "super-secret-value-with-32-characters"
    process.env.BETTER_AUTH_URL = "https://app.example.com"
    process.env.BETTER_AUTH_ALLOWED_HOSTS = "preview.example.com, https://app.example.com , bad host"

    const { getAllowedAuthHosts, getTrustedAuthOrigins } = await loadAuthModule()

    expect(getAllowedAuthHosts()).toEqual([
      "app.example.com",
      "preview.example.com",
    ])
    expect(getTrustedAuthOrigins()).toEqual([
      "https://app.example.com",
      "https://preview.example.com",
    ])
  })
})
