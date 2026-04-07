"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { cn } from "@/lib/utils"
import { History, ListTodo, LogOut, Home } from "lucide-react"
import Image from "next/image"

import { TaskNotificationsBell } from "@/components/task-notifications-bell"
import { WorkdayHeaderStrip } from "@/components/workday-header-strip"

const navItems = [
  { href: "/trabajador/home", label: "Inicio", icon: Home },
  { href: "/trabajador/tareas", label: "Mis Tareas", icon: ListTodo },
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

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "U"

  return (
    <header className="header-glass sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo + nav */}
        <div className="flex items-center gap-5">
          <Link href="/trabajador/home" className="flex items-center shrink-0 hover-lift">
            <Image
              src="/Logo BIMakers con Texto Gris.png"
              alt="BIMakers"
              width={110}
              height={36}
              className="object-contain"
            />
          </Link>

          <div className="h-5 w-px bg-border/60" />

          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  <item.icon className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-foreground"
                  )} />
                  <span className="hidden md:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary hidden md:block" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <WorkdayHeaderStrip basePath="/trabajador" />
          </div>

          <div className="lg:hidden">
            <StatusBadge status={status} />
          </div>

          <div className="hidden sm:flex lg:hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Sistema activo</span>
          </div>

          <TaskNotificationsBell basePath="/trabajador/tareas" />

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border/50 bg-muted/60 px-2.5 py-1.5 hover-lift cursor-default">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-[11px] font-bold text-primary-foreground shadow-sm">
              {initials}
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
            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
