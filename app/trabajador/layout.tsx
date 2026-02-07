"use client"

import React from "react"

import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { WorkerHeader } from "@/components/worker-header"

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
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

  return (
    <div className="min-h-screen bg-background">
      <WorkerHeader />
      <main className="mx-auto max-w-7xl p-4 lg:p-6">{children}</main>
    </div>
  )
}
