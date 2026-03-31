"use client"

import React from "react"

import { useAuth } from "@/lib/contexts/auth-context"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { TimerAlerts } from "@/components/timer-alerts"
import { TaskNotificationsBell } from "@/components/task-notifications-bell"
import { toast } from "sonner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
    } else if (user?.role === "trabajador" || user?.role === "externo") {
      router.push("/")
    }
  }, [ready, isAuthenticated, user, router])

  if (!isAuthenticated || user?.role === "trabajador" || user?.role === "externo") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Get page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean)
    const page = segments[segments.length - 1] ?? "dashboard"
    const titles: Record<string, string> = {
      home: "Inicio",
      dashboard: "Dashboard",
      "mi-jornada": "Mi Jornada",
      "mi-historial": "Mi Historial",
      historial: "Historial Equipo",
      tareas: "Tareas",
      bandeja: "Bandeja",
      clientes: "Clientes",
      usuarios: "Usuarios",
      proyectos: "Proyectos",
      notas: "Notas",
      comunicacion: "Comunicación",
      roles: "Roles y Permisos",
    }
    return titles[page] ?? "Panel"
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar corporativo */}
        <header className="header-glass hidden md:flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-4 w-0.5 rounded-full bg-sidebar-primary/40" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {getPageTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Sistema activo</span>
            </div>
            <TaskNotificationsBell basePath="/admin/tareas" />
            <span className="text-[11px] text-muted-foreground/50 select-none tabular-nums">
              {new Date().toLocaleDateString("es-CL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
        </header>

        {/* Content area */}
        {pathname.endsWith("/noticias") ? (
          <main className="flex-1 overflow-hidden flex flex-col min-h-0">
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 page-enter">{children}</div>
          </main>
        )}
      </div>
      <TimerAlerts />
    </div>
  )
}
