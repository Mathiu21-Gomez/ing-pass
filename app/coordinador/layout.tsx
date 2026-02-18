"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { CoordinadorSidebar } from "@/components/coordinador-sidebar"

export default function CoordinadorLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

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
        <div className="flex h-screen bg-background">
            <CoordinadorSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8">{children}</div>
            </main>
        </div>
    )
}
