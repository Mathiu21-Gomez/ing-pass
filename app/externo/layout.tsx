"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { ExternoSidebar } from "@/components/externo-sidebar"

export default function ExternoLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            router.replace("/")
        }
        if (mounted && isAuthenticated && user?.role !== "externo") {
            if (user?.role === "admin") router.replace("/admin/dashboard")
            else if (user?.role === "coordinador") router.replace("/coordinador/dashboard")
            else if (user?.role === "trabajador") router.replace("/trabajador/mi-jornada")
            else router.replace("/")
        }
    }, [mounted, isAuthenticated, user, router])

    if (!mounted || !isAuthenticated || user?.role !== "externo") {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background">
            <ExternoSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8">{children}</div>
            </main>
        </div>
    )
}
