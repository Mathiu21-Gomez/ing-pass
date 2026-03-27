import { beforeEach, describe, expect, it, vi } from "vitest"

const getAuth = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuth,
  auth: {},
}))

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: (auth: { handler: (request: Request) => Promise<Response> } | ((request: Request) => Promise<Response>)) => {
    const handle = (request: Request) =>
      "handler" in auth ? auth.handler(request) : auth(request)

    return {
      GET: handle,
      POST: handle,
    }
  },
}))

describe("/api/auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses getAuth lazily through a valid Better Auth handler contract", async () => {
    const handler = vi.fn(async () => new Response("ok", { status: 200 }))

    getAuth.mockReturnValue({ handler })

    const { GET } = await import("@/app/api/auth/[...all]/route")

    expect(getAuth).not.toHaveBeenCalled()

    const response = await GET(new Request("http://localhost/api/auth/sign-in"))

    expect(response.status).toBe(200)
    expect(getAuth).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
