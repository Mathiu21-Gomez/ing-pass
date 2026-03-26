import { describe, expect, it } from "vitest"

import {
  canCreateWorkdayTask,
  getWorkdayTaskCreationHint,
} from "@/lib/workday-task-permissions"

describe("workday task permissions", () => {
  it("allows admins, coordinators and workers to create tasks from Mi Jornada", () => {
    expect(canCreateWorkdayTask("admin")).toBe(true)
    expect(canCreateWorkdayTask("coordinador")).toBe(true)
    expect(canCreateWorkdayTask("trabajador")).toBe(true)
    expect(canCreateWorkdayTask("externo")).toBe(false)
  })

  it("shows the self-assignment hint for workers", () => {
    expect(getWorkdayTaskCreationHint("trabajador")).toMatch(/automaticamente/i)
    expect(getWorkdayTaskCreationHint("admin")).not.toMatch(/automaticamente/i)
  })
})
