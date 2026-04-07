import type { HourlyProgress, TimeEntry, TimerStatus } from "@/lib/types"

export interface TimerProgressNote {
  percentage: number
  note: string
  timestamp: Date
}

export interface RestoredTimerState {
  status: TimerStatus
  elapsedWorkSeconds: number
  elapsedLunchSeconds: number
  elapsedPauseSeconds: number
  elapsedMeetingSeconds: number
  startTime: Date | null
  lunchStartTime: Date | null
  lunchEndTime: Date | null
  pauseStartTime: Date | null
  meetingStartTime: Date | null
  userId: string | null
  currentProjectId: string | null
  currentTaskId: string | null
  showLunchAlert: boolean
  showEndWarning: boolean
  showDaySummary: boolean
  showSwitchTaskDialog: boolean
  showAutoEndDialog: boolean
  isExtraTime: boolean
  hourlyProgress: HourlyProgress[]
  showProgressPrompt: boolean
  pendingHourMilestone: number | null
  manualProgressPercentage: number
  pauseCount: number
  meetingCount: number
  progressNotes: TimerProgressNote[]
  sessionEntries: TimeEntry[]
  activeSessionId: string | null
  activeEntryId: string | null
}

export interface TimerSnapshot {
  version: 1
  userId: string
  scheduleEndTime: string | null
  workStartTimestamp: number | null
  totalPausedMs: number
  totalLunchMs: number
  lunchAlertShown: boolean
  endWarningShown: boolean
  autoEndShown: boolean
  hourMilestonesShown: number[]
  state: {
    status: TimerStatus
    elapsedWorkSeconds: number
    elapsedLunchSeconds: number
    elapsedPauseSeconds: number
    elapsedMeetingSeconds: number
    startTime: string | null
    lunchStartTime: string | null
    lunchEndTime: string | null
    pauseStartTime: string | null
    meetingStartTime: string | null
    userId: string | null
    currentProjectId: string | null
    currentTaskId: string | null
    showLunchAlert: boolean
    showEndWarning: boolean
    showDaySummary: boolean
    showSwitchTaskDialog: boolean
    showAutoEndDialog: boolean
    isExtraTime: boolean
    hourlyProgress: Array<Omit<HourlyProgress, "timestamp"> & { timestamp: string }>
    showProgressPrompt: boolean
    pendingHourMilestone: number | null
    manualProgressPercentage: number
    pauseCount: number
    meetingCount: number
    progressNotes: Array<Omit<TimerProgressNote, "timestamp"> & { timestamp: string }>
    sessionEntries: TimeEntry[]
    activeSessionId: string | null
    activeEntryId: string | null
  }
}

export const ACTIVE_TIMER_STATUSES: TimerStatus[] = ["trabajando", "colacion", "pausado", "reunion"]

export function getTimerStorageKey(userId: string) {
  return `ing-pass:timer:${userId}`
}

export function isActiveTimerStatus(status: TimerStatus) {
  return ACTIVE_TIMER_STATUSES.includes(status)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isValidTimerSnapshot(snapshot: unknown, userId: string): snapshot is TimerSnapshot {
  if (!isObject(snapshot)) return false
  if (snapshot.version !== 1 || snapshot.userId !== userId) return false
  if (!Array.isArray(snapshot.hourMilestonesShown)) return false
  if (!isObject(snapshot.state)) return false

  const state = snapshot.state

  if (!isActiveTimerStatus(state.status as TimerStatus)) return false
  if (typeof state.currentProjectId !== "string" || !state.currentProjectId) return false
  if (typeof state.currentTaskId !== "string" || !state.currentTaskId) return false
  if (typeof state.activeSessionId !== "string" || !state.activeSessionId) return false
  if (typeof state.activeEntryId !== "string" || !state.activeEntryId) return false
  if (typeof state.userId !== "string" || state.userId !== userId) return false
  if (typeof state.startTime !== "string" || !state.startTime) return false

  if (state.status === "trabajando" && typeof snapshot.workStartTimestamp !== "number") return false
  if (state.status === "colacion" && (typeof state.lunchStartTime !== "string" || !state.lunchStartTime)) return false
  if (state.status === "pausado" && (typeof state.pauseStartTime !== "string" || !state.pauseStartTime)) return false
  if (state.status === "reunion" && (typeof state.meetingStartTime !== "string" || !state.meetingStartTime)) return false

  return true
}

export function restoreTimerState(snapshot: TimerSnapshot): RestoredTimerState {
  const startTime = parseDate(snapshot.state.startTime)
  const lunchStartTime = parseDate(snapshot.state.lunchStartTime)
  const lunchEndTime = parseDate(snapshot.state.lunchEndTime)
  const pauseStartTime = parseDate(snapshot.state.pauseStartTime)
  const meetingStartTime = parseDate(snapshot.state.meetingStartTime)
  const now = Date.now()

  let elapsedWorkSeconds = snapshot.state.elapsedWorkSeconds

  if (snapshot.workStartTimestamp) {
    const ongoingPauseMs = snapshot.state.status === "pausado" && pauseStartTime ? now - pauseStartTime.getTime() : 0
    const ongoingLunchMs = snapshot.state.status === "colacion" && lunchStartTime ? now - lunchStartTime.getTime() : 0
    const ongoingMeetingMs = snapshot.state.status === "reunion" && meetingStartTime ? now - meetingStartTime.getTime() : 0
    const effectiveWorkMs =
      now -
      snapshot.workStartTimestamp -
      snapshot.totalPausedMs -
      snapshot.totalLunchMs -
      ongoingPauseMs -
      ongoingLunchMs -
      ongoingMeetingMs

    elapsedWorkSeconds = Math.max(0, Math.floor(effectiveWorkMs / 1000))
  }

  const elapsedLunchSeconds =
    snapshot.state.status === "colacion" && lunchStartTime
      ? Math.max(0, Math.floor((now - lunchStartTime.getTime()) / 1000))
      : snapshot.state.elapsedLunchSeconds

  const elapsedPauseSeconds =
    snapshot.state.status === "pausado" && pauseStartTime
      ? Math.max(0, Math.floor((snapshot.totalPausedMs + (now - pauseStartTime.getTime())) / 1000))
      : snapshot.state.elapsedPauseSeconds

  const elapsedMeetingSeconds =
    snapshot.state.status === "reunion" && meetingStartTime
      ? Math.max(0, snapshot.state.elapsedMeetingSeconds + Math.floor((now - meetingStartTime.getTime()) / 1000))
      : snapshot.state.elapsedMeetingSeconds

  return {
    status: snapshot.state.status,
    elapsedWorkSeconds,
    elapsedLunchSeconds,
    elapsedPauseSeconds,
    elapsedMeetingSeconds,
    startTime,
    lunchStartTime,
    lunchEndTime,
    pauseStartTime,
    meetingStartTime,
    userId: snapshot.state.userId,
    currentProjectId: snapshot.state.currentProjectId,
    currentTaskId: snapshot.state.currentTaskId,
    showLunchAlert: snapshot.state.showLunchAlert,
    showEndWarning: snapshot.state.showEndWarning,
    showDaySummary: false,
    showSwitchTaskDialog: false,
    showAutoEndDialog: false,
    isExtraTime: snapshot.state.isExtraTime,
    hourlyProgress: snapshot.state.hourlyProgress.map((progress) => ({
      ...progress,
      timestamp: new Date(progress.timestamp),
    })),
    showProgressPrompt: false,
    pendingHourMilestone: null,
    manualProgressPercentage: snapshot.state.manualProgressPercentage,
    pauseCount: snapshot.state.pauseCount,
    meetingCount: snapshot.state.meetingCount,
    progressNotes: snapshot.state.progressNotes.map((note) => ({
      ...note,
      timestamp: new Date(note.timestamp),
    })),
    sessionEntries: snapshot.state.sessionEntries,
    activeSessionId: snapshot.state.activeSessionId,
    activeEntryId: snapshot.state.activeEntryId,
  }
}
