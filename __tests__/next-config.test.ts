import { describe, expect, it } from "vitest"

describe("next config security headers", () => {
  it("returns the minimum hardening headers for all routes", async () => {
    const { default: nextConfig } = await import("../next.config.mjs")

    expect(typeof nextConfig.headers).toBe("function")

    const headers = await nextConfig.headers?.()

    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: expect.arrayContaining([
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ]),
      },
    ])
  })
})
