import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getTimerStorageKey,
  isValidTimerSnapshot,
  restoreTimerState,
  type TimerSnapshot,
} from "@/lib/contexts/timer-context-persistence"

describe("timer-context persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"))
  })

  it("scopes the storage key by user", () => {
    expect(getTimerStorageKey("user-123")).toBe("ing-pass:timer:user-123")
  })

  it("rejects snapshots that do not belong to the current user", () => {
    const snapshot: TimerSnapshot = {
      version: 1,
      userId: "user-a",
      scheduleEndTime: "18:00",
      workStartTimestamp: Date.parse("2026-03-26T11:00:00.000Z"),
      totalPausedMs: 0,
      totalLunchMs: 0,
      lunchAlertShown: false,
      endWarningShown: false,
      autoEndShown: false,
      hourMilestonesShown: [],
      state: {
        status: "trabajando",
        elapsedWorkSeconds: 0,
        elapsedLunchSeconds: 0,
        elapsedPauseSeconds: 0,
        elapsedMeetingSeconds: 0,
        startTime: "2026-03-26T11:00:00.000Z",
        lunchStartTime: null,
        lunchEndTime: null,
        pauseStartTime: null,
        meetingStartTime: null,
        userId: "user-a",
        currentProjectId: "project-1",
        currentTaskId: "task-1",
        showLunchAlert: false,
        showEndWarning: false,
        showDaySummary: false,
        showSwitchTaskDialog: false,
        showAutoEndDialog: false,
        isExtraTime: false,
        hourlyProgress: [],
        showProgressPrompt: false,
        pendingHourMilestone: null,
        manualProgressPercentage: 0,
        pauseCount: 0,
        meetingCount: 0,
        progressNotes: [],
        sessionEntries: [],
        activeSessionId: "session-1",
        activeEntryId: "entry-1",
      },
    }

    expect(isValidTimerSnapshot(snapshot, "user-b")).toBe(false)
  })

  it("recomputes elapsed work and pause time when restoring an active session", () => {
    const snapshot: TimerSnapshot = {
      version: 1,
      userId: "user-1",
      scheduleEndTime: "18:00",
      workStartTimestamp: Date.parse("2026-03-26T10:00:00.000Z"),
      totalPausedMs: 15 * 60 * 1000,
      totalLunchMs: 30 * 60 * 1000,
      lunchAlertShown: false,
      endWarningShown: false,
      autoEndShown: false,
      hourMilestonesShown: [1, 2],
      state: {
        status: "pausado",
        elapsedWorkSeconds: 0,
        elapsedLunchSeconds: 0,
        elapsedPauseSeconds: 0,
        elapsedMeetingSeconds: 0,
        startTime: "2026-03-26T10:00:00.000Z",
        lunchStartTime: null,
        lunchEndTime: null,
        pauseStartTime: "2026-03-26T11:45:00.000Z",
        meetingStartTime: null,
        userId: "user-1",
        currentProjectId: "project-1",
        currentTaskId: "task-1",
        showLunchAlert: false,
        showEndWarning: false,
        showDaySummary: false,
        showSwitchTaskDialog: false,
        showAutoEndDialog: false,
        isExtraTime: false,
        hourlyProgress: [],
        showProgressPrompt: false,
        pendingHourMilestone: null,
        manualProgressPercentage: 25,
        pauseCount: 1,
        meetingCount: 0,
        progressNotes: [],
        sessionEntries: [],
        activeSessionId: "session-1",
        activeEntryId: "entry-1",
      },
    }

    const restored = restoreTimerState(snapshot)

    expect(restored.elapsedWorkSeconds).toBe(3600)
    expect(restored.elapsedPauseSeconds).toBe(1800)
    expect(restored.activeSessionId).toBe("session-1")
    expect(restored.activeEntryId).toBe("entry-1")
    expect(restored.pauseStartTime?.toISOString()).toBe("2026-03-26T11:45:00.000Z")
  })
})
