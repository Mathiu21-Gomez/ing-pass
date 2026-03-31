"use client"

import React from "react"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { CoordinadorSidebar } from "@/components/coordinador-sidebar"
import { TimerAlerts } from "@/components/timer-alerts"
import { TaskNotificationsBell } from "@/components/task-notifications-bell"
import { toast } from "sonner"

export default function CoordinadorLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    function getPageTitle() {
        const segments = pathname.split("/").filter(Boolean)
        const page = segments[segments.length - 1] ?? "home"
        const titles: Record<string, string> = {
            home: "Inicio",
            dashboard: "Dashboard",
            "mi-historial": "Mi Historial",
            tareas: "Gestión de Tareas",
            equipo: "Panel Equipo",
            noticias: "Novedades",
        }
        return titles[page] ?? "Panel"
    }
    const shownAlerts = useRef<Set<string>>(new Set())

    useEffect(() => setMounted(true), [])

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
        if (mounted && !isAuthenticated) {
            router.replace("/")
        }
        if (mounted && isAuthenticated && user?.role !== "coordinador") {
            if (user?.role === "admin") router.replace("/admin/dashboard")
            else if (user?.role === "trabajador") router.replace("/trabajador/mi-jornada")
            else router.replace("/")
        }
    }, [mounted, isAuthenticated, user, router])

    if (!mounted || !isAuthenticated || user?.role !== "coordinador") {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <CoordinadorSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top bar */}
                <header className="header-glass hidden md:flex h-14 items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-0.5 rounded-full bg-amber-500/50" />
                        <h2 className="text-sm font-semibold text-foreground tracking-tight">
                            {getPageTitle()}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Sistema activo</span>
                        </div>
                        <TaskNotificationsBell basePath="/coordinador/tareas" />
                        <span className="text-[11px] text-muted-foreground/50 select-none tabular-nums">
                            {new Date().toLocaleDateString("es-CL", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </span>
                    </div>
                </header>

                {pathname.endsWith("/noticias") ? (
                    <main className="flex-1 overflow-hidden flex flex-col min-h-0">
                        {children}
                    </main>
                ) : (
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-6 md:p-8 page-enter">{children}</div>
                    </main>
                )}
            </div>
            <TimerAlerts />
        </div>
    )
}
