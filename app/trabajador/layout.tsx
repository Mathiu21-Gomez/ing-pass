"use client"

import React from "react"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { TrabajadorSidebar } from "@/components/trabajador-sidebar"
import { PermissionsStatusBanner } from "@/components/permissions-status-banner"
import { TimerAlerts } from "@/components/timer-alerts"
import { TaskNotificationsBell } from "@/components/task-notifications-bell"
import { WorkdayHeaderStrip } from "@/components/workday-header-strip"
import { toast } from "sonner"

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const shownAlerts = useRef<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // ── Alert polling ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    async function checkAlerts() {
      try {
        const res = await fetch("/api/alerts")
        if (!res.ok) return
        const alerts: { id: string; taskId: string; taskName: string; correlativeId: number; message: string }[] = await res.json()
        for (const alert of alerts) {
          if (shownAlerts.current.has(alert.id)) continue
          shownAlerts.current.add(alert.id)
          toast(`#${alert.correlativeId} · ${alert.taskName}`, {
            description: alert.message || "Recordatorio de tarea",
            icon: "🔔",
            duration: Infinity,
            action: {
              label: "Descartar",
              onClick: () => fetch(`/api/alerts/${alert.id}`, { method: "PATCH" }),
            },
          })
        }
      } catch { /* silent */ }
    }

    checkAlerts()
    const interval = setInterval(checkAlerts, 60_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated) {
      router.push("/")
    } else if (user?.role !== "trabajador") {
      router.push("/admin/dashboard")
    }
  }, [ready, isAuthenticated, user, router])

  if (!isAuthenticated || user?.role !== "trabajador") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean)
    const page = segments[segments.length - 1] ?? "home"
    const titles: Record<string, string> = {
      tareas: "Mis Tareas",
      historial: "Mi Historial",
      calendario: "Calendario",
      comunicacion: "Comunicados",
    }
    return titles[page] ?? "Panel"
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TrabajadorSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PermissionsStatusBanner />

        {/* Top bar */}
        <header className="header-glass hidden md:flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-4 w-0.5 rounded-full bg-blue-500/40" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {getPageTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <WorkdayHeaderStrip basePath="/trabajador" />
            <TaskNotificationsBell basePath="/trabajador/tareas" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 page-enter">{children}</div>
        </main>
      </div>
      <TimerAlerts />
    </div>
  )
}
