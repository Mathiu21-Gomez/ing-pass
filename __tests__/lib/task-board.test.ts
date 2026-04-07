import { describe, expect, it } from "vitest"

import type { Task } from "@/lib/types"
import {
  filterTasksByView,
  getTaskStatusDate,
  getTaskViewForStatus,
  groupTasksByStatus,
  sortTasks,
} from "@/lib/task-board"

function makeTask(overrides: Partial<Task> & { id: string; correlativeId: number; name: string; status: Task["status"] }): Task {
  return {
    id: overrides.id,
    correlativeId: overrides.correlativeId,
    name: overrides.name,
    description: "",
    guidelines: null,
    priority: 0,
    projectId: "project-1",
    assignedTo: [],
    createdBy: "user-1",
    createdAt: overrides.createdAt ?? "2026-03-01T10:00:00.000Z",
    dueDate: overrides.dueDate ?? null,
    status: overrides.status,
    documents: [],
    activities: [],
    tags: [],
  }
}

describe("task board helpers", () => {
  it("sorts by due date and keeps null values last", () => {
    const sorted = sortTasks(
      [
        makeTask({ id: "3", correlativeId: 3, name: "Sin fecha", status: "pendiente", dueDate: null }),
        makeTask({ id: "2", correlativeId: 2, name: "Segundo", status: "pendiente", dueDate: "2026-03-07" }),
        makeTask({ id: "1", correlativeId: 1, name: "Primero", status: "pendiente", dueDate: "2026-03-03" }),
      ],
      "dueDate",
      "asc"
    )

    expect(sorted.map((task) => task.correlativeId)).toEqual([1, 2, 3])
  })

  it("falls back to createdAt for status date when no dedicated timestamp exists", () => {
    const task = makeTask({
      id: "1",
      correlativeId: 1,
      name: "Fallback",
      status: "en_curso",
      createdAt: "2026-03-04T09:00:00.000Z",
    })

    expect(getTaskStatusDate(task)).toBe("2026-03-04T09:00:00.000Z")
  })

  it("uses a dedicated status timestamp when present", () => {
    const task = {
      ...makeTask({ id: "1", correlativeId: 1, name: "Con status date", status: "listo_para_revision" }),
      statusChangedAt: "2026-03-05T11:30:00.000Z",
    }

    expect(getTaskStatusDate(task)).toBe("2026-03-05T11:30:00.000Z")
  })

  it("filters tasks into the expected role-neutral views", () => {
    const tasks = [
      makeTask({ id: "1", correlativeId: 1, name: "Activa", status: "en_curso" }),
      makeTask({ id: "2", correlativeId: 2, name: "Revision", status: "listo_para_revision" }),
      makeTask({ id: "3", correlativeId: 3, name: "Finalizada", status: "finalizado" }),
    ]

    expect(filterTasksByView(tasks, "active")).toHaveLength(1)
    expect(filterTasksByView(tasks, "review")).toHaveLength(1)
    expect(filterTasksByView(tasks, "completed")).toHaveLength(1)
    expect(filterTasksByView(tasks, "history")).toHaveLength(2)
  })

  it("maps statuses to the right primary view", () => {
    expect(getTaskViewForStatus("en_curso")).toBe("active")
    expect(getTaskViewForStatus("listo_para_revision")).toBe("review")
    expect(getTaskViewForStatus("finalizado")).toBe("completed")
  })

  it("groups tasks by status preserving non-empty groups only", () => {
    const grouped = groupTasksByStatus(
      [
        makeTask({ id: "1", correlativeId: 1, name: "Activa", status: "en_curso" }),
        makeTask({ id: "2", correlativeId: 2, name: "Pendiente", status: "pendiente" }),
      ],
      ["en_curso", "bloqueado", "pendiente"]
    )

    expect(grouped.map((group) => group.status)).toEqual(["en_curso", "pendiente"])
  })
})
