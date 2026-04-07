"use client"

import { AlertTriangle } from "lucide-react"

import { useAuth } from "@/lib/contexts/auth-context"

export function PermissionsStatusBanner() {
  const { permissionsError, permissionsStatus } = useAuth()

  if (permissionsStatus !== "error" || !permissionsError) {
    return null
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Permisos no sincronizados desde DB: {permissionsError}</span>
      </div>
    </div>
  )
}
