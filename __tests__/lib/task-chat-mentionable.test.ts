import { beforeEach, describe, expect, it, vi } from "vitest"

let selectQueue: unknown[][] = []

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      const rows = selectQueue.shift() ?? []

      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(rows)),
            })),
          })),
          where: vi.fn(() => Promise.resolve(rows)),
        })),
      }
    }),
  },
}))

vi.mock("@/lib/project-membership-store", () => ({
  getProjectMembership: vi.fn((projectId: string) => Promise.resolve({
    projectId,
    coordinatorIds: ["coord-1"],
    assignedWorkerIds: ["worker-1", "worker-2"],
    projectMembers: [
      { userId: "coord-1", role: "coordinador" },
      { userId: "worker-1", role: "colaborador" },
      { userId: "worker-2", role: "modelador" },
    ],
  })),
}))

import { getTaskChatMentionableUsers } from "@/lib/task-chat-mentionable"

describe("getTaskChatMentionableUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns admins, coordinator and directly assigned workers", async () => {
    selectQueue = [
      [{ projectId: "project-1" }],
      [{ id: "admin-1", name: "Admin Uno" }],
      [
        { id: "coord-1", name: "Coord Uno" },
        { id: "worker-1", name: "Worker Uno" },
        { id: "worker-2", name: "Worker Dos" },
      ],
    ]

    const result = await getTaskChatMentionableUsers("task-1")

    expect(result).toEqual([
      { id: "admin-1", name: "Admin Uno" },
      { id: "coord-1", name: "Coord Uno" },
      { id: "worker-1", name: "Worker Uno" },
      { id: "worker-2", name: "Worker Dos" },
    ])
  })

  it("excludes the requesting user from mention suggestions", async () => {
    selectQueue = [
      [{ projectId: "project-1" }],
      [{ id: "admin-1", name: "Admin Uno" }],
      [
        { id: "coord-1", name: "Coord Uno" },
        { id: "worker-1", name: "Worker Uno" },
      ],
    ]

    const result = await getTaskChatMentionableUsers("task-1", { excludeUserId: "worker-1" })

    expect(result).toEqual([
      { id: "admin-1", name: "Admin Uno" },
      { id: "coord-1", name: "Coord Uno" },
    ])
  })
})
