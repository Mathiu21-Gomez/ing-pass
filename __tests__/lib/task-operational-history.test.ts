import { describe, expect, it } from "vitest"

import { taskOperationalHistoryInternals } from "@/lib/task-operational-history"

describe("task operational history helpers", () => {
  it("summarizes attachment and mention activity for the demo panel", () => {
    expect(
      taskOperationalHistoryInternals.formatSummary({
        attachmentCount: 2,
        kind: "user",
        mentionCount: 1,
        text: "@Ana te deje dos archivos",
      })
    ).toBe("Compartio 2 adjuntos y marco 1 mencion")
  })

  it("trims noisy message bodies for recent activity cards", () => {
    expect(taskOperationalHistoryInternals.trimDetail("  hola\n\nesto   es   una prueba  ")).toBe("hola esto es una prueba")
  })

  it("marks the worker context as active on the same task", () => {
    const result = taskOperationalHistoryInternals.buildWorkerContext({
      activeEntry: {
        date: "2026-04-01",
        projectName: "Proyecto Demo",
        startTime: "09:15",
        status: "trabajando",
        taskId: "task-1",
        taskName: "Detalle demo",
      },
      assignedWorker: {
        id: "worker-1",
        name: "Ana",
      },
      taskId: "task-1",
    })

    expect(result.state).toBe("active")
    expect(result.matchesCurrentTask).toBe(true)
    expect(result.currentTaskName).toBe("Detalle demo")
  })
})
