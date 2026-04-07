import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const insertReturning = vi.fn()
const updateReturning = vi.fn()
const projectWorkersValues = vi.fn()
let insertCalls = 0

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(() => null),
}))

vi.mock("@/lib/project-membership-store", () => ({
  getProjectMembership: vi.fn(() => Promise.resolve({
    projectId: "project-1",
    coordinatorIds: ["coord-1"],
    assignedWorkerIds: ["worker-1"],
    projectMembers: [
      { userId: "coord-1", role: "coordinador" },
      { userId: "worker-1", role: "colaborador" },
    ],
  })),
  syncProjectMembers: vi.fn(() => Promise.resolve(true)),
}))

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => {
      insertCalls += 1

      if (insertCalls > 1) {
        return {
          values: projectWorkersValues,
        }
      }

      return {
        values: vi.fn(() => ({
          returning: insertReturning,
        })),
      }
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: updateReturning,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}))

import { getAuthUser } from "@/lib/api-auth"
import { POST } from "@/app/api/projects/route"
import { PATCH } from "@/app/api/projects/[id]/route"

const projectPayload = {
  name: "Proyecto Andino",
  description: "Descripcion valida para crear proyecto",
  clientId: "client-1",
  coordinatorId: "coord-1",
  stage: "Planificacion",
  startDate: "2026-01-01",
  endDate: "2026-02-01",
  status: "Activo",
  assignedWorkers: ["worker-1"],
}

describe("project route response shape", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertCalls = 0

    vi.mocked(getAuthUser).mockResolvedValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        position: "Admin",
        active: true,
      },
      error: null,
    } as never)

    insertReturning.mockResolvedValue([
      {
        id: "project-1",
        ...projectPayload,
      },
    ])

    updateReturning.mockResolvedValue([
      {
        id: "project-1",
        ...projectPayload,
      },
    ])

    projectWorkersValues.mockResolvedValue(undefined)
  })

  it("returns empty nested collections when creating a project", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectPayload),
      })
    )

    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.assignedWorkers).toEqual(["worker-1"])
    expect(body.tasks).toEqual([])
    expect(body.documents).toEqual([])
    expect(body.urls).toEqual([])
  })

  it("returns empty nested collections when updating a project", async () => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/projects/project-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectPayload),
      }),
      { params: Promise.resolve({ id: "project-1" }) }
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.assignedWorkers).toEqual(["worker-1"])
    expect(body.tasks).toEqual([])
    expect(body.documents).toEqual([])
    expect(body.urls).toEqual([])
  })
})
