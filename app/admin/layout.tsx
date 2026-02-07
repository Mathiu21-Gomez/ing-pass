"use client"

import React from "react"

import { useAuth } from "@/lib/contexts/auth-context"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated) {
      router.push("/")
    } else if (user?.role !== "admin") {
      router.push("/trabajador/mi-jornada")
    }
  }, [ready, isAuthenticated, user, router])

  if (!isAuthenticated || user?.role !== "admin") {
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
      dashboard: "Dashboard",
      historial: "Historial",
      clientes: "Clientes",
      usuarios: "Usuarios",
      proyectos: "Proyectos",
    }
    return titles[page] ?? "Panel"
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar corporativo */}
        <header className="hidden md:flex h-14 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {getPageTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-soft" />
              <span className="text-xs font-medium text-muted-foreground">Sistema activo</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("es-CL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </header>

        {/* Content area con padding mejorado */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 page-enter">{children}</div>
        </main>
      </div>
    </div>
  )
}
