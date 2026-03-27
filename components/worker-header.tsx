"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { cn } from "@/lib/utils"
import { History, Timer, LogOut, Home } from "lucide-react"
import Image from "next/image"

const navItems = [
  { href: "/trabajador/home", label: "Inicio", icon: Home },
  { href: "/trabajador/mi-jornada", label: "Mi Jornada", icon: Timer },
  { href: "/trabajador/historial", label: "Historial", icon: History },
]

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; dot: string }> = {
    trabajando: {
      label: "Trabajando",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    colacion: {
      label: "En Colación",
      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
      dot: "bg-amber-500",
    },
    pausado: {
      label: "Pausado",
      className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20",
      dot: "bg-orange-500",
    },
    reunion: {
      label: "En Reunión",
      className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20",
      dot: "bg-indigo-500",
    },
    finalizado: {
      label: "Jornada Finalizada",
      className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
      dot: "bg-slate-400",
    },
    inactivo: {
      label: "Sin iniciar",
      className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
      dot: "bg-slate-300",
    },
  }
  const c = config[status] ?? config.inactivo
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", c.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot, status === "trabajando" && "animate-pulse")} />
      {c.label}
    </span>
  )
}

export function WorkerHeader() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { status } = useTimer()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-surface-1/95 backdrop-blur-xl shadow-[0_1px_3px_0_rgb(0_0_0/0.05)] dark:shadow-[0_1px_3px_0_rgb(0_0_0/0.2)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/trabajador/mi-jornada" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/Logo BIMakers con Texto Gris.png"
              alt="BIMakers"
              width={120}
              height={40}
              className="object-contain"
            />
          </Link>

          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                  <span className="hidden md:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary hidden md:block" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          <StatusBadge status={status} />

          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/50 bg-muted px-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {user?.name?.split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight capitalize">
                {user?.position ?? user?.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
