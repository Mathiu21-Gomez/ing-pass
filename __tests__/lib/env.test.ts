import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

const loadEnvModule = async () => {
  vi.resetModules()
  return import("@/lib/env")
}

describe("env", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("parses required production env vars", async () => {
    process.env.DATABASE_URL = "postgresql://user:password@db.example.com/app"
    process.env.BETTER_AUTH_SECRET = "super-secret-value-with-32-characters"
    process.env.BETTER_AUTH_URL = "https://app.example.com"

    const { getEnv } = await loadEnvModule()
    const env = getEnv()

    expect(env.DATABASE_URL).toBe("postgresql://user:password@db.example.com/app")
    expect(env.BETTER_AUTH_SECRET).toBe("super-secret-value-with-32-characters")
    expect(env.BETTER_AUTH_URL).toBe("https://app.example.com")
  })

  it("fails fast when a required env var is missing", async () => {
    delete process.env.DATABASE_URL
    process.env.BETTER_AUTH_SECRET = "super-secret-value-with-32-characters"
    process.env.BETTER_AUTH_URL = "https://app.example.com"

    const { getEnv } = await loadEnvModule()

    expect(() => getEnv()).toThrow(/DATABASE_URL/i)
  })
})
