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
import type { TimerStatus, HourlyProgress, TimeEntry, TimeEntryEnriched } from "@/lib/types"
import { timeEntriesApi } from "@/lib/services/api"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  isActiveTimerStatus,
  isValidTimerSnapshot,
  restoreTimerState,
  type TimerSnapshot,
} from "@/lib/contexts/timer-context-persistence"

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
  // Chat session ID — generated at startDay, groups messages for this jornada
  activeSessionId: string | null
  activeEntryId: string | null
}

interface EndDayPayload {
  notes?: string
  progressPercentage?: number
  progressJustification?: string
}

interface TimerContextType extends TimerState {
  startDay: (projectId: string, taskId: string, userId?: string, sessionId?: string) => Promise<string>
  startLunch: () => Promise<void>
  endLunch: () => Promise<void>
  pauseWork: () => void
  resumeWork: () => void
  startMeeting: () => Promise<void>
  endMeeting: () => Promise<void>
  endDay: (payload?: EndDayPayload) => Promise<void>
  switchTask: (projectId: string, taskId: string) => Promise<void>
  openSwitchTaskDialog: () => void
  closeSwitchTaskDialog: () => void
  dismissLunchAlert: () => void
  dismissEndWarning: () => void
  dismissDaySummary: () => void
  dismissAutoEndDialog: () => Promise<void>
  continueAsExtra: () => Promise<void>
  formatTime: (seconds: number) => string
  // Hourly progress functions
  recordHourlyProgress: (description: string) => Promise<void>
  dismissProgressPrompt: () => Promise<void>
  // Manual progress functions
  updateManualProgress: (percentage: number, note: string) => Promise<void>
  // Schedule
  scheduleEndTime: string | null
  setScheduleEndTime: (time: string | null) => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const ONE_HOUR = 60 * 60
const FOUR_HOURS = 4 * 60 * 60
const SEVEN_HOURS_55 = 7 * 60 * 60 + 55 * 60
const EIGHT_HOURS = 8 * 60 * 60

function formatClockTime(date: Date | null) {
  if (!date) return null

  return date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function parseEntryDateTime(date: string, time: string | null) {
  if (!time) return null

  const parsed = new Date(`${date}T${time}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function createFallbackSnapshot(entry: TimeEntryEnriched, userId: string): TimerSnapshot {
  const startTime = parseEntryDateTime(entry.date, entry.startTime)
  const lunchStartTime = parseEntryDateTime(entry.date, entry.lunchStartTime)
  const lunchEndTime = parseEntryDateTime(entry.date, entry.lunchEndTime)
  const now = Date.now()
  const safeStart = startTime?.getTime() ?? now

  return {
    version: 1,
    userId,
    scheduleEndTime: null,
    workStartTimestamp: safeStart,
    totalPausedMs: 0,
    totalLunchMs: lunchStartTime && lunchEndTime ? lunchEndTime.getTime() - lunchStartTime.getTime() : 0,
    lunchAlertShown: false,
    endWarningShown: false,
    autoEndShown: false,
    hourMilestonesShown: [],
    state: {
      status: entry.status,
      elapsedWorkSeconds: Math.max(0, Math.round(entry.effectiveHours * 3600)),
      elapsedLunchSeconds: 0,
      elapsedPauseSeconds: 0,
      elapsedMeetingSeconds: 0,
      startTime: startTime?.toISOString() ?? new Date(safeStart).toISOString(),
      lunchStartTime: lunchStartTime?.toISOString() ?? null,
      lunchEndTime: lunchEndTime?.toISOString() ?? null,
      pauseStartTime: null,
      meetingStartTime: entry.status === "reunion" ? new Date(now).toISOString() : null,
      userId,
      currentProjectId: entry.projectId,
      currentTaskId: entry.taskId,
      showLunchAlert: false,
      showEndWarning: false,
      showDaySummary: false,
      showSwitchTaskDialog: false,
      showAutoEndDialog: false,
      isExtraTime: false,
      hourlyProgress: [],
      showProgressPrompt: false,
      pendingHourMilestone: null,
      manualProgressPercentage: entry.progressPercentage,
      pauseCount: entry.pauseCount,
      meetingCount: 0,
      progressNotes: [],
      sessionEntries: [],
      activeSessionId: null,
      activeEntryId: entry.id,
    },
  }
}

const INITIAL_TIMER_STATE: TimerState = {
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
  hourlyProgress: [],
  showProgressPrompt: false,
  pendingHourMilestone: null,
  manualProgressPercentage: 0,
  pauseCount: 0,
  meetingCount: 0,
  progressNotes: [],
  sessionEntries: [],
  activeSessionId: null,
  activeEntryId: null,
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<TimerState>(INITIAL_TIMER_STATE)
  const [hasHydratedSnapshot, setHasHydratedSnapshot] = useState(false)

  const [scheduleEndTime, setScheduleEndTime] = useState<string | null>(null)
  const stateRef = useRef<TimerState>(state)
  stateRef.current = state
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lunchAlertShown = useRef(false)
  const endWarningShown = useRef(false)
  const autoEndShown = useRef(false)
  const hourMilestonesShown = useRef<Set<number>>(new Set())
  const hydratedUserIdRef = useRef<string | null>(null)
  const meetingBaseSecondsRef = useRef(0)

  // Store timestamps for accurate calculation
  const workStartTimestamp = useRef<number | null>(null)
  const totalPausedMs = useRef<number>(0)
  const totalLunchMs = useRef<number>(0)

  // Reset timer when authenticated user changes (e.g. logout → login as different user)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    // Skip the very first render (undefined → first value)
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = user?.id ?? null
      return
    }
    const incoming = user?.id ?? null
    if (prevUserIdRef.current !== incoming) {
      prevUserIdRef.current = incoming
      hydratedUserIdRef.current = null
      setHasHydratedSnapshot(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      workStartTimestamp.current = null
      totalPausedMs.current = 0
      totalLunchMs.current = 0
      lunchAlertShown.current = false
      endWarningShown.current = false
      autoEndShown.current = false
      hourMilestonesShown.current = new Set()
      setState(INITIAL_TIMER_STATE)
    }
  }, [user?.id])

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

  const startStatusInterval = useCallback(
    (status: TimerStatus) => {
      if (intervalRef.current) clearInterval(intervalRef.current)

      if (status === "trabajando") {
        intervalRef.current = setInterval(tick, 1000)
        return
      }

      if (status === "colacion") {
        intervalRef.current = setInterval(() => {
          setState((prev) => {
            if (prev.status !== "colacion" || !prev.lunchStartTime) return prev

            return {
              ...prev,
              elapsedLunchSeconds: Math.max(0, Math.floor((Date.now() - prev.lunchStartTime.getTime()) / 1000)),
            }
          })
        }, 1000)
        return
      }

      if (status === "reunion") {
        intervalRef.current = setInterval(() => {
          setState((prev) => {
            if (prev.status !== "reunion" || !prev.meetingStartTime) return prev

            return {
              ...prev,
              elapsedMeetingSeconds:
                meetingBaseSecondsRef.current +
                Math.max(0, Math.floor((Date.now() - prev.meetingStartTime.getTime()) / 1000)),
            }
          })
        }, 1000)
      }
    },
    [tick]
  )

  const buildRuntimeState = useCallback(
    (currentState: TimerState, effectiveUserId: string): TimerSnapshot => ({
      version: 1,
      userId: effectiveUserId,
      scheduleEndTime,
      workStartTimestamp: workStartTimestamp.current,
      totalPausedMs: totalPausedMs.current,
      totalLunchMs: totalLunchMs.current,
      lunchAlertShown: lunchAlertShown.current,
      endWarningShown: endWarningShown.current,
      autoEndShown: autoEndShown.current,
      hourMilestonesShown: Array.from(hourMilestonesShown.current),
      state: {
        status: currentState.status,
        elapsedWorkSeconds: currentState.elapsedWorkSeconds,
        elapsedLunchSeconds: currentState.elapsedLunchSeconds,
        elapsedPauseSeconds: currentState.elapsedPauseSeconds,
        elapsedMeetingSeconds: currentState.elapsedMeetingSeconds,
        startTime: currentState.startTime?.toISOString() ?? null,
        lunchStartTime: currentState.lunchStartTime?.toISOString() ?? null,
        lunchEndTime: currentState.lunchEndTime?.toISOString() ?? null,
        pauseStartTime: currentState.pauseStartTime?.toISOString() ?? null,
        meetingStartTime: currentState.meetingStartTime?.toISOString() ?? null,
        userId: currentState.userId,
        currentProjectId: currentState.currentProjectId,
        currentTaskId: currentState.currentTaskId,
        showLunchAlert: currentState.showLunchAlert,
        showEndWarning: currentState.showEndWarning,
        showDaySummary: currentState.showDaySummary,
        showSwitchTaskDialog: currentState.showSwitchTaskDialog,
        showAutoEndDialog: currentState.showAutoEndDialog,
        isExtraTime: currentState.isExtraTime,
        hourlyProgress: currentState.hourlyProgress.map((progress) => ({
          ...progress,
          timestamp: progress.timestamp.toISOString(),
        })),
        showProgressPrompt: currentState.showProgressPrompt,
        pendingHourMilestone: currentState.pendingHourMilestone,
        manualProgressPercentage: currentState.manualProgressPercentage,
        pauseCount: currentState.pauseCount,
        meetingCount: currentState.meetingCount,
        progressNotes: currentState.progressNotes.map((note) => ({
          ...note,
          timestamp: note.timestamp.toISOString(),
        })),
        sessionEntries: currentState.sessionEntries,
        activeSessionId: currentState.activeSessionId,
        activeEntryId: currentState.activeEntryId,
      },
    }),
    [scheduleEndTime]
  )

  const syncActiveEntry = useCallback(
    async (nextState: TimerState, overrides: Partial<TimeEntry> = {}) => {
      if (!nextState.activeEntryId || !nextState.userId) {
        throw new Error("No existe un registro activo en la base de datos para sincronizar la jornada")
      }

      await timeEntriesApi.update(nextState.activeEntryId, {
        projectId: nextState.currentProjectId ?? undefined,
        taskId: nextState.currentTaskId ?? undefined,
        status: nextState.status,
        lunchStartTime: formatClockTime(nextState.lunchStartTime),
        lunchEndTime: formatClockTime(nextState.lunchEndTime),
        progressPercentage: nextState.manualProgressPercentage,
        pauseCount: nextState.pauseCount,
        runtimeState: buildRuntimeState(nextState, nextState.userId),
        ...overrides,
      })
    },
    [buildRuntimeState]
  )

  useEffect(() => {
    const authUserId = user?.id ?? null
    if (!authUserId || hydratedUserIdRef.current === authUserId) return

    let cancelled = false

    async function hydrateFromDatabase() {
      if (!authUserId) return

      try {
        const activeEntries = await timeEntriesApi.getAll({ active: true, userId: authUserId })
        const activeEntry = activeEntries[0]

        if (!activeEntry) {
          if (cancelled) return
          hydratedUserIdRef.current = authUserId
          setHasHydratedSnapshot(true)
          return
        }

        const snapshot = isValidTimerSnapshot(activeEntry.runtimeState, authUserId)
          ? activeEntry.runtimeState
          : createFallbackSnapshot(activeEntry, authUserId)

        const restoredState = restoreTimerState(snapshot)

        workStartTimestamp.current = snapshot.workStartTimestamp
        totalPausedMs.current = snapshot.totalPausedMs
        totalLunchMs.current = snapshot.totalLunchMs
        lunchAlertShown.current = snapshot.lunchAlertShown
        endWarningShown.current = snapshot.endWarningShown
        autoEndShown.current = snapshot.autoEndShown
        hourMilestonesShown.current = new Set(snapshot.hourMilestonesShown)
        meetingBaseSecondsRef.current = snapshot.state.elapsedMeetingSeconds

        if (cancelled) return

        setScheduleEndTime(snapshot.scheduleEndTime)
        setState(restoredState)
        hydratedUserIdRef.current = authUserId
        setHasHydratedSnapshot(true)
        startStatusInterval(snapshot.state.status)
      } catch (error) {
        console.error("Error hydrating active workday from DB:", error)
        if (cancelled) return
        hydratedUserIdRef.current = authUserId
        setHasHydratedSnapshot(true)
      }
    }

    void hydrateFromDatabase()

    return () => {
      cancelled = true
    }
  }, [startStatusInterval, user?.id])

  const startDay = useCallback(
    async (projectId: string, taskId: string, userId?: string, existingSessionId?: string): Promise<string> => {
      const effectiveUserId = userId ?? user?.id ?? null

      if (!effectiveUserId) {
        throw new Error("No se pudo identificar al usuario de la jornada")
      }

      if (!projectId || !taskId) {
        throw new Error("Selecciona un proyecto y tarea válidos antes de iniciar")
      }

      lunchAlertShown.current = false
      endWarningShown.current = false
      autoEndShown.current = false
      hourMilestonesShown.current = new Set()
      workStartTimestamp.current = Date.now()
      totalPausedMs.current = 0
      totalLunchMs.current = 0
      meetingBaseSecondsRef.current = 0

      const sessionId = existingSessionId ?? crypto.randomUUID()
      const startTime = new Date()

      const createdEntry = await timeEntriesApi.create({
        userId: effectiveUserId,
        projectId,
        taskId,
        date: startTime.toISOString().split("T")[0],
        startTime: startTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }),
        lunchStartTime: null,
        lunchEndTime: null,
        endTime: null,
        effectiveHours: 0,
        status: "trabajando",
        notes: "",
        progressPercentage: 0,
        pauseCount: 0,
        progressJustification: "",
        editable: true,
      })

      const nextState: TimerState = {
        status: "trabajando",
        elapsedWorkSeconds: 0,
        elapsedLunchSeconds: 0,
        elapsedPauseSeconds: 0,
        elapsedMeetingSeconds: 0,
        startTime,
        lunchStartTime: null,
        lunchEndTime: null,
        pauseStartTime: null,
        meetingStartTime: null,
        userId: effectiveUserId,
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
        activeSessionId: sessionId,
        activeEntryId: createdEntry.id,
      }

      await syncActiveEntry(nextState)
      setState(nextState)
      startStatusInterval("trabajando")
      return sessionId
    },
    [startStatusInterval, syncActiveEntry, user?.id]
  )

  const startLunch = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== "trabajando") return
    if (!current.activeEntryId) {
      throw new Error("No existe un registro activo en la base de datos para iniciar la colación")
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const lunchStart = new Date()
    const nextState: TimerState = {
      ...current,
      status: "colacion",
      lunchStartTime: lunchStart,
      showLunchAlert: false,
    }

    await syncActiveEntry(nextState, {
      lunchEndTime: null,
      status: "colacion",
    })
    setState(nextState)
    startStatusInterval("colacion")
  }, [startStatusInterval, syncActiveEntry])

  const endLunch = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== "colacion") return
    if (!current.lunchStartTime || !current.activeEntryId) {
      throw new Error("No existe una colación activa para retomar la jornada")
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    totalLunchMs.current += Date.now() - current.lunchStartTime.getTime()

    const nextState: TimerState = {
      ...current,
      status: "trabajando",
      lunchEndTime: new Date(),
    }

    await syncActiveEntry(nextState, { status: "trabajando" })
    setState(nextState)
    startStatusInterval("trabajando")
  }, [startStatusInterval, syncActiveEntry])

  // Pausa eliminada — conservadas por compatibilidad de interfaz, no hacen nada
  const pauseWork = useCallback(() => {}, [])
  const resumeWork = useCallback(() => {}, [])

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

  const endDay = useCallback(async (payload?: EndDayPayload) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const currentState = stateRef.current

    if (!currentState.activeEntryId) {
      throw new Error("No existe un registro activo en la base de datos para cerrar esta jornada")
    }

    const entryData = buildTimeEntry(currentState)
    const saved = await timeEntriesApi.update(currentState.activeEntryId, {
      ...entryData,
      notes: payload?.notes ?? entryData.notes,
      progressPercentage: payload?.progressPercentage ?? entryData.progressPercentage,
      progressJustification: payload?.progressJustification ?? entryData.progressJustification,
      runtimeState: null,
    })

    setState((prev) => ({
      ...prev,
      status: "finalizado",
      showDaySummary: true,
      sessionEntries: [...prev.sessionEntries, saved],
      activeEntryId: null,
    }))
  }, [buildTimeEntry])

  const switchTask = useCallback(async (newProjectId: string, newTaskId: string) => {
    const current = stateRef.current
    if (current.status !== "trabajando") return

    if (!current.activeEntryId) {
      throw new Error("No existe un registro activo en la base de datos para cambiar de tarea")
    }

    const nextState: TimerState = {
      ...current,
      currentProjectId: newProjectId,
      currentTaskId: newTaskId,
      showSwitchTaskDialog: false,
      progressNotes: [],
      manualProgressPercentage: 0,
    }

    await syncActiveEntry(nextState, {
      projectId: newProjectId,
      taskId: newTaskId,
      progressPercentage: 0,
      progressJustification: "",
    })
    setState(nextState)
  }, [syncActiveEntry])

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
  const startMeeting = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== "trabajando") return
    if (!current.activeEntryId) {
      throw new Error("No existe un registro activo en la base de datos para iniciar la reunión")
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const meetingStart = new Date()
    meetingBaseSecondsRef.current = current.elapsedMeetingSeconds

    const nextState: TimerState = {
      ...current,
      status: "reunion" as const,
      meetingStartTime: meetingStart,
      meetingCount: current.meetingCount + 1,
    }

    await syncActiveEntry(nextState, { status: "reunion" })
    setState(nextState)
    startStatusInterval("reunion")
  }, [startStatusInterval, syncActiveEntry])

  const endMeeting = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== "reunion") return
    if (!current.meetingStartTime || !current.activeEntryId) {
      throw new Error("No existe una reunión activa para retomar la jornada")
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const meetingDuration = Date.now() - current.meetingStartTime.getTime()
    totalPausedMs.current += meetingDuration
    const totalMeetingSecs = meetingBaseSecondsRef.current + Math.floor(meetingDuration / 1000)
    meetingBaseSecondsRef.current = totalMeetingSecs

    const nextState: TimerState = {
      ...current,
      status: "trabajando" as const,
      meetingStartTime: null,
      elapsedMeetingSeconds: totalMeetingSecs,
    }

    await syncActiveEntry(nextState, { status: "trabajando" })
    setState(nextState)
    startStatusInterval("trabajando")
  }, [startStatusInterval, syncActiveEntry])

  const dismissAutoEndDialog = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const currentState = stateRef.current

    if (!currentState.activeEntryId) {
      throw new Error("No existe un registro activo en la base de datos para cerrar esta jornada")
    }

    const entryData = buildTimeEntry(currentState)
    const saved = await timeEntriesApi.update(currentState.activeEntryId, {
      ...entryData,
      runtimeState: null,
    })

    setState((prev) => ({
      ...prev,
      status: "finalizado" as const,
      showAutoEndDialog: false,
      showDaySummary: true,
      sessionEntries: [...prev.sessionEntries, saved],
      activeEntryId: null,
    }))
  }, [buildTimeEntry])

  const continueAsExtra = useCallback(async () => {
    const current = stateRef.current
    if (!current.activeEntryId) return

    const nextState: TimerState = {
      ...current,
      showAutoEndDialog: false,
      isExtraTime: true,
    }

    await syncActiveEntry(nextState)
    setState(nextState)
  }, [syncActiveEntry])

  const recordHourlyProgress = useCallback(async (description: string) => {
    const current = stateRef.current
    if (current.pendingHourMilestone === null) return

    const hour = current.pendingHourMilestone
    const percentage = Math.round((hour / 8) * 100 * 10) / 10
    const newProgress: HourlyProgress = {
      hour,
      timestamp: new Date(),
      description: description || `Hora ${hour} completada`,
      percentage,
    }

    const nextState: TimerState = {
      ...current,
      hourlyProgress: [...current.hourlyProgress, newProgress],
      showProgressPrompt: false,
      pendingHourMilestone: null,
    }

    await syncActiveEntry(nextState)
    setState(nextState)
  }, [syncActiveEntry])

  const dismissProgressPrompt = useCallback(async () => {
    const current = stateRef.current
    if (current.pendingHourMilestone === null) return

    const hour = current.pendingHourMilestone
    const percentage = Math.round((hour / 8) * 100 * 10) / 10
    const newProgress: HourlyProgress = {
      hour,
      timestamp: new Date(),
      description: `Hora ${hour} completada`,
      percentage,
    }

    const nextState: TimerState = {
      ...current,
      hourlyProgress: [...current.hourlyProgress, newProgress],
      showProgressPrompt: false,
      pendingHourMilestone: null,
    }

    await syncActiveEntry(nextState)
    setState(nextState)
  }, [syncActiveEntry])

  const updateManualProgress = useCallback(async (percentage: number, note: string) => {
    const current = stateRef.current
    const clampedPercentage = Math.min(100, Math.max(0, percentage))
    const nextState: TimerState = {
      ...current,
      manualProgressPercentage: clampedPercentage,
      progressNotes: [
        ...current.progressNotes,
        {
          percentage: clampedPercentage,
          note,
          timestamp: new Date(),
        },
      ],
    }

    await syncActiveEntry(nextState)
    setState(nextState)
  }, [syncActiveEntry])

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
