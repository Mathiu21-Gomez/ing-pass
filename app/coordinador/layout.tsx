"use client"

import React from "react"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { CoordinadorSidebar } from "@/components/coordinador-sidebar"
import { TimerAlerts } from "@/components/timer-alerts"
import { toast } from "sonner"

export default function CoordinadorLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
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
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 page-enter">{children}</div>
            </main>
            <TimerAlerts />
        </div>
    )
}
