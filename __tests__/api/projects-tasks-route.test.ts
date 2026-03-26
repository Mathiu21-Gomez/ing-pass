import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

let selectQueue: unknown[] = []
let insertedValues: unknown[] = []
let transactionCalls = 0
let transactionInsertOutcomes: Array<Record<string, unknown> | Error | undefined> = []

function takeSelectResult() {
  return Promise.resolve(selectQueue.shift() ?? [])
}

function createInsertMock() {
  return vi.fn(() => ({
    values: vi.fn((values) => {
      insertedValues.push(values)

      return {
        returning: vi.fn(() => {
          const outcome = transactionInsertOutcomes.shift()

          if (outcome instanceof Error) {
            return Promise.reject(outcome)
          }

          return Promise.resolve([
            {
              id: "task-created",
              ...(values as Record<string, unknown>),
              ...(outcome ?? {}),
            },
          ])
        }),
      }
    }),
  }))
}

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/project-access", () => ({
  getProjectAccessContext: vi.fn(),
}))

vi.mock("@/db", () => {
  const createSelectMock = () =>
    vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(takeSelectResult),
        })),
        where: vi.fn(takeSelectResult),
      })),
    }))

  const createTransactionClient = () => ({
    select: createSelectMock(),
    insert: createInsertMock(),
  })

  return {
    db: {
      select: createSelectMock(),
      insert: createInsertMock(),
      transaction: vi.fn(async (callback: (tx: ReturnType<typeof createTransactionClient>) => Promise<unknown>) => {
        transactionCalls += 1
        return callback(createTransactionClient())
      }),
    },
  }
})

import { getAuthUser } from "@/lib/api-auth"
import { getProjectAccessContext } from "@/lib/project-access"
import { GET, POST } from "@/app/api/projects/[id]/tasks/route"

const makeUser = (role: string, id = "user-1", email = "test@test.com") => ({
  id,
  name: "Test",
  email,
  role,
  position: "Dev",
  active: true,
})

const makeParams = () => ({ params: Promise.resolve({ id: "project-1" }) })

const createCorrelativeConflict = () => {
  const error = new Error("duplicate key") as Error & {
    code?: string
    constraint?: string
  }

  error.code = "23505"
  error.constraint = "tasks_project_correlative_unique"

  return error
}

describe("/api/projects/[id]/tasks hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue = []
    insertedValues = []
    transactionCalls = 0
    transactionInsertOutcomes = []

    vi.mocked(getProjectAccessContext).mockResolvedValue({
      context: {
        projectId: "project-1",
        coordinatorId: "coord-1",
        clientEmail: "client@test.com",
      },
      error: null,
    } as never)
  })

  it("hides project tasks when the caller lacks project context", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("coordinador", "coord-2"),
      error: null,
    } as never)

    vi.mocked(getProjectAccessContext).mockResolvedValue({
      context: null,
      error: new Response(JSON.stringify({ error: "Proyecto no encontrado" }), { status: 404 }),
    } as never)

    const res = await GET(new NextRequest("http://localhost/api/projects/project-1/tasks"), makeParams())

    expect(res.status).toBe(404)
  })

  it("returns 403 when a worker tries to create tasks in a project", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("trabajador", "worker-1"),
      error: null,
    } as never)

    const res = await POST(
      new NextRequest("http://localhost/api/projects/project-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Nueva tarea",
          description: "Descripcion valida",
        }),
      }),
      makeParams()
    )

    expect(res.status).toBe(403)
  })

  it("rejects assignees outside the project", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    selectQueue = [[{ userId: "worker-1" }]]

    const res = await POST(
      new NextRequest("http://localhost/api/projects/project-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Nueva tarea",
          description: "Descripcion valida",
          assignedTo: ["worker-1", "worker-2"],
        }),
      }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no pertenecen al proyecto/i)
    expect(insertedValues).toHaveLength(0)
  })

  it("rejects tags from another project", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    selectQueue = [[{ id: "tag-1", projectId: "other-project" }]]

    const res = await POST(
      new NextRequest("http://localhost/api/projects/project-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Nueva tarea",
          description: "Descripcion valida",
          tagIds: ["tag-1"],
        }),
      }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no pertenecen al proyecto/i)
    expect(insertedValues).toHaveLength(0)
  })

  it("forces external task creation into the safer review state", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("externo", "ext-1", "client@test.com"),
      error: null,
    } as never)

    selectQueue = [[{ maxId: 7 }]]

    const res = await POST(
      new NextRequest("http://localhost/api/projects/project-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Nueva tarea",
          description: "Descripcion valida",
          status: "finalizado",
          priority: 99,
          guidelines: "No deberia persistirse",
        }),
      }),
      makeParams()
    )

    const payload = insertedValues[0] as Record<string, unknown>

    expect(res.status).toBe(201)
    expect(payload.status).toBe("listo_para_revision")
    expect(payload.priority).toBe(0)
    expect(payload.guidelines).toBe("")
    expect(payload.projectId).toBe("project-1")
    expect(transactionCalls).toBe(1)
  })

  it("retries task creation when the project correlative collides", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      user: makeUser("admin", "admin-1"),
      error: null,
    } as never)

    selectQueue = [[{ maxId: 4 }], [{ maxId: 5 }]]
    transactionInsertOutcomes = [createCorrelativeConflict(), undefined]

    const res = await POST(
      new NextRequest("http://localhost/api/projects/project-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Nueva tarea",
          description: "Descripcion valida",
        }),
      }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.correlativeId).toBe(6)
    expect(transactionCalls).toBe(2)
  })
})
