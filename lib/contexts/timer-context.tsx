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
import { mockTimeEntries, mockProjects } from "@/lib/mock-data"

interface TimerState {
  status: TimerStatus
  elapsedWorkSeconds: number
  elapsedLunchSeconds: number
  elapsedPauseSeconds: number
  startTime: Date | null
  lunchStartTime: Date | null
  lunchEndTime: Date | null
  pauseStartTime: Date | null
  currentProjectId: string | null
  currentTaskId: string | null
  showLunchAlert: boolean
  showEndWarning: boolean
  showDaySummary: boolean
  showSwitchTaskDialog: boolean
  // Hourly progress tracking
  hourlyProgress: HourlyProgress[]
  showProgressPrompt: boolean
  pendingHourMilestone: number | null
  // Manual progress tracking
  manualProgressPercentage: number
  pauseCount: number
  progressNotes: { percentage: number; note: string; timestamp: Date }[]
  // Persisted entries from current session
  sessionEntries: TimeEntry[]
}

interface TimerContextType extends TimerState {
  startDay: (projectId: string, taskId: string) => void
  startLunch: () => void
  endLunch: () => void
  pauseWork: () => void
  resumeWork: () => void
  endDay: () => void
  switchTask: (projectId: string, taskId: string) => void
  openSwitchTaskDialog: () => void
  closeSwitchTaskDialog: () => void
  dismissLunchAlert: () => void
  dismissEndWarning: () => void
  dismissDaySummary: () => void
  formatTime: (seconds: number) => string
  // Hourly progress functions
  recordHourlyProgress: (description: string) => void
  dismissProgressPrompt: () => void
  // Manual progress functions
  updateManualProgress: (percentage: number, note: string) => void
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
    startTime: null,
    lunchStartTime: null,
    lunchEndTime: null,
    pauseStartTime: null,
    currentProjectId: null,
    currentTaskId: null,
    showLunchAlert: false,
    showEndWarning: false,
    showDaySummary: false,
    showSwitchTaskDialog: false,
    // Hourly progress tracking
    hourlyProgress: [],
    showProgressPrompt: false,
    pendingHourMilestone: null,
    // Manual progress tracking
    manualProgressPercentage: 0,
    pauseCount: 0,
    progressNotes: [],
    sessionEntries: [],
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lunchAlertShown = useRef(false)
  const endWarningShown = useRef(false)
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
        updates.status = "finalizado"
        updates.showDaySummary = true
        updates.showProgressPrompt = false
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

      return { ...prev, ...updates }
    })
  }, [])

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(tick, 1000)
  }, [tick])

  const startDay = useCallback(
    (projectId: string, taskId: string) => {
      lunchAlertShown.current = false
      endWarningShown.current = false
      hourMilestonesShown.current = new Set()
      workStartTimestamp.current = Date.now()
      totalPausedMs.current = 0
      totalLunchMs.current = 0

      setState({
        status: "trabajando",
        elapsedWorkSeconds: 0,
        elapsedLunchSeconds: 0,
        elapsedPauseSeconds: 0,
        startTime: new Date(),
        lunchStartTime: null,
        lunchEndTime: null,
        pauseStartTime: null,
        currentProjectId: projectId,
        currentTaskId: taskId,
        showLunchAlert: false,
        showEndWarning: false,
        showDaySummary: false,
        showSwitchTaskDialog: false,
        hourlyProgress: [],
        showProgressPrompt: false,
        pendingHourMilestone: null,
        manualProgressPercentage: 0,
        pauseCount: 0,
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

  // Create and persist TimeEntry
  const createTimeEntry = useCallback((prev: TimerState): TimeEntry => {
    const project = mockProjects.find(p => p.id === prev.currentProjectId)
    const task = project?.tasks.find(t => t.id === prev.currentTaskId)

    const now = new Date()
    const effectiveHours = Math.round((prev.elapsedWorkSeconds / 3600) * 100) / 100

    // Get last progress note as justification
    const lastNote = prev.progressNotes[prev.progressNotes.length - 1]

    const entry: TimeEntry = {
      id: `te${Date.now()}`,
      userId: "u2", // Would come from auth context in real app
      projectId: prev.currentProjectId ?? "",
      taskId: prev.currentTaskId ?? "",
      date: now.toISOString().split("T")[0],
      startTime: prev.startTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) ?? "",
      lunchStartTime: prev.lunchStartTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) ?? null,
      lunchEndTime: prev.lunchEndTime?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) ?? null,
      endTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      effectiveHours,
      status: "finalizado",
      notes: `${task?.name ?? "Tarea"} - ${Math.round(effectiveHours)}h trabajadas`,
      progressPercentage: prev.manualProgressPercentage,
      pauseCount: prev.pauseCount,
      progressJustification: lastNote?.note ?? "",
    }

    return entry
  }, [])

  const endDay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState((prev) => {
      // Create and persist entry
      const entry = createTimeEntry(prev)
      mockTimeEntries.unshift(entry) // Add to beginning of array

      return {
        ...prev,
        status: "finalizado",
        showDaySummary: true,
        sessionEntries: [...prev.sessionEntries, entry],
      }
    })
  }, [createTimeEntry])

  // Switch task mid-day (creates partial entry for previous task)
  const switchTask = useCallback((newProjectId: string, newTaskId: string) => {
    setState((prev) => {
      if (prev.status !== "trabajando" && prev.status !== "pausado") return prev

      // Create partial entry for current task
      const partialEntry = createTimeEntry(prev)
      partialEntry.notes = `[Parcial] ${partialEntry.notes}`
      mockTimeEntries.unshift(partialEntry)

      // Reset for new task but keep time running
      return {
        ...prev,
        currentProjectId: newProjectId,
        currentTaskId: newTaskId,
        showSwitchTaskDialog: false,
        sessionEntries: [...prev.sessionEntries, partialEntry],
        progressNotes: [],
        manualProgressPercentage: 0,
      }
    })
  }, [createTimeEntry])

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
        endDay,
        switchTask,
        openSwitchTaskDialog,
        closeSwitchTaskDialog,
        dismissLunchAlert,
        dismissEndWarning,
        dismissDaySummary,
        formatTime,
        recordHourlyProgress,
        dismissProgressPrompt,
        updateManualProgress,
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
