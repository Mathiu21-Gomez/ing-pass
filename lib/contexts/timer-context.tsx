"use client"

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import type { TimerStatus, HourlyProgress, TimeEntry } from "@/lib/types"
import { timeEntriesApi } from "@/lib/services/api"

interface TimerState {
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
  // Hourly progress tracking
  hourlyProgress: HourlyProgress[]
  showProgressPrompt: boolean
  pendingHourMilestone: number | null
  // Manual progress tracking
  manualProgressPercentage: number
  pauseCount: number
  meetingCount: number
  progressNotes: { percentage: number; note: string; timestamp: Date }[]
  // Persisted entries from current session
  sessionEntries: TimeEntry[]
}

interface TimerContextType extends TimerState {
  startDay: (projectId: string, taskId: string, userId?: string) => void
  startLunch: () => void
  endLunch: () => void
  pauseWork: () => void
  resumeWork: () => void
  startMeeting: () => void
  endMeeting: () => void
  endDay: () => void
  switchTask: (projectId: string, taskId: string) => void
  openSwitchTaskDialog: () => void
  closeSwitchTaskDialog: () => void
  dismissLunchAlert: () => void
  dismissEndWarning: () => void
  dismissDaySummary: () => void
  dismissAutoEndDialog: () => void
  continueAsExtra: () => void
  formatTime: (seconds: number) => string
  // Hourly progress functions
  recordHourlyProgress: (description: string) => void
  dismissProgressPrompt: () => void
  // Manual progress functions
  updateManualProgress: (percentage: number, note: string) => void
  // Schedule
  scheduleEndTime: string | null
  setScheduleEndTime: (time: string | null) => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const ONE_HOUR = 60 * 60
const FOUR_HOURS = 4 * 60 * 60
const SEVEN_HOURS_55 = 7 * 60 * 60 + 55 * 60
const EIGHT_HOURS = 8 * 60 * 60

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>({
    status: "inactivo",
    elapsedWorkSeconds: 0,
    elapsedLunchSeconds: 0,
    elapsedPauseSeconds: 0,
    elapsedMeetingSeconds: 0,
    startTime: null,
    lunchStartTime: null,
    lunchEndTime: null,
    pauseStartTime: null,
    meetingStartTime: null,
    userId: null,
    currentProjectId: null,
    currentTaskId: null,
    showLunchAlert: false,
    showEndWarning: false,
    showDaySummary: false,
    showSwitchTaskDialog: false,
    showAutoEndDialog: false,
    isExtraTime: false,
    // Hourly progress tracking
    hourlyProgress: [],
    showProgressPrompt: false,
    pendingHourMilestone: null,
    // Manual progress tracking
    manualProgressPercentage: 0,
    pauseCount: 0,
    meetingCount: 0,
    progressNotes: [],
    sessionEntries: [],
  })

  const [scheduleEndTime, setScheduleEndTime] = useState<string | null>(null)
  const stateRef = useRef<TimerState>(state)
  stateRef.current = state
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lunchAlertShown = useRef(false)
  const endWarningShown = useRef(false)
  const autoEndShown = useRef(false)
  const hourMilestonesShown = useRef<Set<number>>(new Set())

  // Store timestamps for accurate calculation
  const workStartTimestamp = useRef<number | null>(null)
  const totalPausedMs = useRef<number>(0)
  const totalLunchMs = useRef<number>(0)

  // Timestamp-based tick for accuracy
  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "trabajando" || !workStartTimestamp.current) return prev

      const now = Date.now()
      const totalElapsedMs = now - workStartTimestamp.current
      const effectiveWorkMs = totalElapsedMs - totalPausedMs.current - totalLunchMs.current
      const newElapsed = Math.max(0, Math.floor(effectiveWorkMs / 1000))

      const updates: Partial<TimerState> = { elapsedWorkSeconds: newElapsed }

      // Check for hourly milestones (1h, 2h, 3h, 5h, 6h, 7h - skip 4h as it has lunch alert)
      const currentHour = Math.floor(newElapsed / ONE_HOUR)
      const previousHour = Math.floor(prev.elapsedWorkSeconds / ONE_HOUR)

      if (currentHour > previousHour && currentHour <= 8) {
        if (!hourMilestonesShown.current.has(currentHour) && currentHour !== 4) {
          hourMilestonesShown.current.add(currentHour)
          updates.showProgressPrompt = true
          updates.pendingHourMilestone = currentHour
        }
      }

      if (newElapsed >= FOUR_HOURS && !lunchAlertShown.current) {
        lunchAlertShown.current = true
        hourMilestonesShown.current.add(4)
        updates.showLunchAlert = true
        updates.showProgressPrompt = false
        updates.pendingHourMilestone = 4
      }

      if (newElapsed >= SEVEN_HOURS_55 && !endWarningShown.current) {
        endWarningShown.current = true
        updates.showEndWarning = true
      }

      if (newElapsed >= EIGHT_HOURS) {
        if (!hourMilestonesShown.current.has(8)) {
          hourMilestonesShown.current.add(8)
        }
      }

      // Auto-finalize at schedule end time
      if (scheduleEndTime && !autoEndShown.current && !prev.isExtraTime) {
        const now = new Date()
        const [endH, endM] = scheduleEndTime.split(":").map(Number)
        const endDate = new Date()
        endDate.setHours(endH, endM, 0, 0)
        if (now >= endDate) {
          autoEndShown.current = true
          updates.showAutoEndDialog = true
        }
      }

      return { ...prev, ...updates }
    })
  }, [scheduleEndTime])

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(tick, 1000)
  }, [tick])

  const startDay = useCallback(
    (projectId: string, taskId: string, userId?: string) => {
      lunchAlertShown.current = false
      endWarningShown.current = false
      autoEndShown.current = false
      hourMilestonesShown.current = new Set()
      workStartTimestamp.current = Date.now()
      totalPausedMs.current = 0
      totalLunchMs.current = 0

      setState({
        status: "trabajando",
        elapsedWorkSeconds: 0,
        elapsedLunchSeconds: 0,
        elapsedPauseSeconds: 0,
        elapsedMeetingSeconds: 0,
        startTime: new Date(),
        lunchStartTime: null,
        lunchEndTime: null,
        pauseStartTime: null,
        meetingStartTime: null,
        userId: userId ?? null,
        currentProjectId: projectId,
        currentTaskId: taskId,
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
      })
      startInterval()
    },
    [startInterval]
  )

  const startLunch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const lunchStart = new Date()
    setState((prev) => ({
      ...prev,
      status: "colacion",
      lunchStartTime: lunchStart,
      showLunchAlert: false,
    }))
    // Track lunch time
    const lunchStartMs = Date.now()
    intervalRef.current = setInterval(() => {
      const lunchElapsed = Math.floor((Date.now() - lunchStartMs) / 1000)
      setState((prev) => {
        if (prev.status !== "colacion") return prev
        return { ...prev, elapsedLunchSeconds: lunchElapsed }
      })
    }, 1000)
  }, [])

  const endLunch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState((prev) => {
      // Calculate lunch duration and add to total
      if (prev.lunchStartTime) {
        const lunchDuration = Date.now() - prev.lunchStartTime.getTime()
        totalLunchMs.current += lunchDuration
      }
      return {
        ...prev,
        status: "trabajando",
        lunchEndTime: new Date(),
      }
    })
    startInterval()
  }, [startInterval])

  const pauseWork = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const pauseStart = new Date()
    setState((prev) => ({
      ...prev,
      status: "pausado",
      pauseStartTime: pauseStart,
      pauseCount: prev.pauseCount + 1,
    }))
    // Track pause time
    const pauseStartMs = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pauseStartMs) / 1000)
      setState((prev) => {
        if (prev.status !== "pausado") return prev
        return { ...prev, elapsedPauseSeconds: prev.elapsedPauseSeconds + 0 } // Keep current value, update below
      })
    }, 1000)
  }, [])

  const resumeWork = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState((prev) => {
      // Calculate pause duration and add to total
      if (prev.pauseStartTime) {
        const pauseDuration = Date.now() - prev.pauseStartTime.getTime()
        totalPausedMs.current += pauseDuration
        const totalPauseSecs = Math.floor(totalPausedMs.current / 1000)
        return { ...prev, status: "trabajando", pauseStartTime: null, elapsedPauseSeconds: totalPauseSecs }
      }
      return { ...prev, status: "trabajando", pauseStartTime: null }
    })
    startInterval()
  }, [startInterval])

  const buildTimeEntry = useCallback((prev: TimerState): Omit<TimeEntry, "id"> => {
    const now = new Date()
    const effectiveHours = Math.round((prev.elapsedWorkSeconds / 3600) * 100) / 100
    const lastNote = prev.progressNotes[prev.progressNotes.length - 1]

    return {
      userId: prev.userId ?? "",
      projectId: prev.currentProjectId ?? "",
      taskId: prev.currentTaskId ?? "",
      date: now.toISOString().split("T")[0],
      startTime: prev.startTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? "",
      lunchStartTime: prev.lunchStartTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? null,
      lunchEndTime: prev.lunchEndTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? null,
      endTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }),
      effectiveHours,
      status: "finalizado",
      notes: `Tarea ${prev.currentTaskId ?? ""} - ${Math.round(effectiveHours)}h trabajadas`,
      progressPercentage: prev.manualProgressPercentage,
      pauseCount: prev.pauseCount,
      progressJustification: lastNote?.note ?? "",
      editable: true,
    }
  }, [])

  const persistEntry = useCallback(async (entryData: Omit<TimeEntry, "id">): Promise<TimeEntry> => {
    try {
      const saved = await timeEntriesApi.create(entryData)
      return saved
    } catch (err) {
      console.error("Error persisting time entry:", err)
      return { id: `local_${Date.now()}`, ...entryData }
    }
  }, [])

  const endDay = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const entryData = buildTimeEntry(stateRef.current)
    const saved = await persistEntry(entryData)

    setState((prev) => ({
      ...prev,
      status: "finalizado",
      showDaySummary: true,
      sessionEntries: [...prev.sessionEntries, saved],
    }))
  }, [buildTimeEntry, persistEntry])

  const switchTask = useCallback(async (newProjectId: string, newTaskId: string) => {
    const current = stateRef.current
    if (current.status !== "trabajando" && current.status !== "pausado") return

    const entryData = buildTimeEntry(current)
    entryData.notes = `[Parcial] ${entryData.notes}`
    const saved = await persistEntry(entryData)

    setState((prev) => ({
      ...prev,
      currentProjectId: newProjectId,
      currentTaskId: newTaskId,
      showSwitchTaskDialog: false,
      sessionEntries: [...prev.sessionEntries, saved],
      progressNotes: [],
      manualProgressPercentage: 0,
    }))
  }, [buildTimeEntry, persistEntry])

  const openSwitchTaskDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showSwitchTaskDialog: true }))
  }, [])

  const closeSwitchTaskDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showSwitchTaskDialog: false }))
  }, [])

  const dismissLunchAlert = useCallback(() => {
    setState((prev) => ({ ...prev, showLunchAlert: false }))
  }, [])

  const dismissEndWarning = useCallback(() => {
    setState((prev) => ({ ...prev, showEndWarning: false }))
  }, [])

  const dismissDaySummary = useCallback(() => {
    setState((prev) => ({ ...prev, showDaySummary: false, status: "inactivo" }))
  }, [])

  // ── Meeting ──
  const startMeeting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const meetingStart = new Date()
    // Accumulate pause time if we were paused
    setState((prev) => {
      let extraPause = 0
      if (prev.status === "pausado" && prev.pauseStartTime) {
        extraPause = Date.now() - prev.pauseStartTime.getTime()
        totalPausedMs.current += extraPause
      }
      return {
        ...prev,
        status: "reunion" as const,
        meetingStartTime: meetingStart,
        meetingCount: prev.meetingCount + 1,
        pauseStartTime: null,
      }
    })
    // Track meeting elapsed time
    const meetingStartMs = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - meetingStartMs) / 1000)
      setState((prev) => {
        if (prev.status !== "reunion") return prev
        return { ...prev, elapsedMeetingSeconds: prev.elapsedMeetingSeconds + 0 } // just keep interval alive
      })
    }, 1000)
  }, [])

  const endMeeting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState((prev) => {
      if (prev.meetingStartTime) {
        const meetingDuration = Date.now() - prev.meetingStartTime.getTime()
        totalPausedMs.current += meetingDuration
        const totalMeetingSecs = Math.floor(meetingDuration / 1000)
        return {
          ...prev,
          status: "trabajando" as const,
          meetingStartTime: null,
          elapsedMeetingSeconds: prev.elapsedMeetingSeconds + totalMeetingSecs,
        }
      }
      return { ...prev, status: "trabajando" as const, meetingStartTime: null }
    })
    startInterval()
  }, [startInterval])

  const dismissAutoEndDialog = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const entryData = buildTimeEntry(stateRef.current)
    const saved = await persistEntry(entryData)

    setState((prev) => ({
      ...prev,
      status: "finalizado" as const,
      showAutoEndDialog: false,
      showDaySummary: true,
      sessionEntries: [...prev.sessionEntries, saved],
    }))
  }, [buildTimeEntry, persistEntry])

  const continueAsExtra = useCallback(() => {
    // User chose to continue — mark as extra time
    setState((prev) => ({
      ...prev,
      showAutoEndDialog: false,
      isExtraTime: true,
    }))
  }, [])

  const recordHourlyProgress = useCallback((description: string) => {
    setState((prev) => {
      if (prev.pendingHourMilestone === null) return prev

      const hour = prev.pendingHourMilestone
      const percentage = Math.round((hour / 8) * 100 * 10) / 10

      const newProgress: HourlyProgress = {
        hour,
        timestamp: new Date(),
        description: description || `Hora ${hour} completada`,
        percentage,
      }

      return {
        ...prev,
        hourlyProgress: [...prev.hourlyProgress, newProgress],
        showProgressPrompt: false,
        pendingHourMilestone: null,
      }
    })
  }, [])

  const dismissProgressPrompt = useCallback(() => {
    setState((prev) => {
      if (prev.pendingHourMilestone === null) return prev

      const hour = prev.pendingHourMilestone
      const percentage = Math.round((hour / 8) * 100 * 10) / 10

      const newProgress: HourlyProgress = {
        hour,
        timestamp: new Date(),
        description: `Hora ${hour} completada`,
        percentage,
      }

      return {
        ...prev,
        hourlyProgress: [...prev.hourlyProgress, newProgress],
        showProgressPrompt: false,
        pendingHourMilestone: null,
      }
    })
  }, [])

  const updateManualProgress = useCallback((percentage: number, note: string) => {
    setState((prev) => ({
      ...prev,
      manualProgressPercentage: Math.min(100, Math.max(0, percentage)),
      progressNotes: [
        ...prev.progressNotes,
        {
          percentage: Math.min(100, Math.max(0, percentage)),
          note,
          timestamp: new Date(),
        },
      ],
    }))
  }, [])

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <TimerContext.Provider
      value={{
        ...state,
        startDay,
        startLunch,
        endLunch,
        pauseWork,
        resumeWork,
        startMeeting,
        endMeeting,
        endDay,
        switchTask,
        openSwitchTaskDialog,
        closeSwitchTaskDialog,
        dismissLunchAlert,
        dismissEndWarning,
        dismissDaySummary,
        dismissAutoEndDialog,
        continueAsExtra,
        formatTime,
        recordHourlyProgress,
        dismissProgressPrompt,
        updateManualProgress,
        scheduleEndTime,
        setScheduleEndTime,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider")
  }
  return context
}
