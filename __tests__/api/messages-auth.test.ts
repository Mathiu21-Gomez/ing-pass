import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let insertedValues: unknown[] = []
let updateWhereCalls = 0

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/message-access", () => ({
  getProjectMessageAccessContext: vi.fn(),
  getSessionMessageAccessContext: vi.fn(),
  getTaskMessageAccessContext: vi.fn(),
}))

vi.mock("@/lib/validate-attachments", () => ({
  validateAttachments: vi.fn(() => null),
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
        leftJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => {
        insertedValues.push(values)

        return {
          returning: vi.fn(() => Promise.resolve([{ id: "created-1", ...(values as Record<string, unknown>) }])),
        }
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          updateWhereCalls += 1
          return Promise.resolve()
        }),
      })),
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import {
  getProjectMessageAccessContext,
  getSessionMessageAccessContext,
  getTaskMessageAccessContext,
} from "@/lib/message-access"
import { GET, PATCH, POST } from "@/app/api/messages/route"

const makeUser = (role: string, id = "user-1", email = "user@test.com") => ({
  id,
  name: "Test",
  email,
  role,
  position: "Dev",
  active: true,
})

describe("/api/messages auth hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedValues = []
    updateWhereCalls = 0

    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    vi.mocked(getTaskMessageAccessContext).mockResolvedValue({
      context: {
        taskId: "task-1",
        projectId: "project-1",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
      error: null,
    } as never)

    vi.mocked(getProjectMessageAccessContext).mockResolvedValue({
      context: {
        projectId: "project-1",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
      error: null,
    } as never)

    vi.mocked(getSessionMessageAccessContext).mockResolvedValue({
      context: { sessionId: "session-1" },
      error: null,
      exists: true,
    } as never)
  })

  it("rejects GET requests that mix multiple message contexts", async () => {
    const req = new NextRequest(
      "http://localhost/api/messages?taskId=task-1&projectId=project-1"
    )

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/only one message context/i)
  })

  it("rejects PATCH requests that try to mark multiple contexts as read at once", async () => {
    const req = new NextRequest("http://localhost/api/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-1", projectId: "project-1" }),
    })

    const res = await PATCH(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/exactly one message context/i)
    expect(updateWhereCalls).toBe(0)
  })

  it("rejects starting a new session thread without project or task context", async () => {
    vi.mocked(getSessionMessageAccessContext).mockResolvedValue({
      context: null,
      error: null,
      exists: false,
    } as never)

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Hola", sessionId: "session-new" }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/projectId or taskId required/i)
    expect(insertedValues).toHaveLength(0)
  })

  it("rejects POST requests when taskId and projectId do not match", async () => {
    vi.mocked(getTaskMessageAccessContext).mockResolvedValue({
      context: {
        taskId: "task-1",
        projectId: "other-project",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
      error: null,
    } as never)

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "Hola",
        sessionId: "session-1",
        projectId: "project-1",
        taskId: "task-1",
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/does not belong/i)
    expect(insertedValues).toHaveLength(0)
  })
})
