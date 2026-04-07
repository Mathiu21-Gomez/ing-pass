import { beforeEach, describe, expect, it, vi } from "vitest"

let selectQueue: unknown[] = []
let insertedValues: unknown[] = []
let deleteCalls = 0

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        deleteCalls += 1
        return Promise.resolve()
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => {
        insertedValues.push(values)
        return Promise.resolve()
      }),
    })),
  },
}))

import {
  getProjectMemberships,
  ProjectMembershipDriftError,
  syncProjectMembershipsForUser,
} from "@/lib/project-membership-store"

describe("project membership store", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue = []
    insertedValues = []
    deleteCalls = 0
  })

  it("fails explicitly when project_members has no rows for a requested project", async () => {
    selectQueue = [
      [],
      [{ projectId: "project-1", userId: "worker-1" }],
    ]

    await expect(getProjectMemberships(["project-1"])).rejects.toBeInstanceOf(ProjectMembershipDriftError)
  })

  it("rebuilds impacted memberships from current DB state while preserving special contextual roles", async () => {
    selectQueue = [
      [{ projectId: "project-1" }],
      [{ projectId: "project-1" }],
      [{ projectId: "project-1", coordinatorId: "coord-1" }],
      [
        { projectId: "project-1", userId: "worker-2" },
        { projectId: "project-1", userId: "leader-1" },
        { projectId: "project-1", userId: "modeler-1" },
      ],
      [
        { projectId: "project-1", userId: "coord-1", role: "coordinador" },
        { projectId: "project-1", userId: "coord-2", role: "coordinador" },
        { projectId: "project-1", userId: "leader-1", role: "lider" },
        { projectId: "project-1", userId: "modeler-1", role: "modelador" },
      ],
    ]

    await expect(syncProjectMembershipsForUser("user-1")).resolves.toBe(1)

    expect(deleteCalls).toBe(1)
    expect(insertedValues[0]).toEqual([
      { projectId: "project-1", userId: "coord-1", role: "coordinador" },
      { projectId: "project-1", userId: "coord-2", role: "coordinador" },
      { projectId: "project-1", userId: "leader-1", role: "lider" },
      { projectId: "project-1", userId: "modeler-1", role: "modelador" },
      { projectId: "project-1", userId: "worker-2", role: "colaborador" },
    ])
  })
})
