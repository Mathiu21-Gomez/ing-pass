"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTimer } from "@/lib/contexts/timer-context"
import { cn } from "@/lib/utils"
import { FolderKanban, Timer, LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import Image from "next/image"

const navItems = [
  { href: "/trabajador/mi-jornada", label: "Mi Jornada", icon: Timer },
  { href: "/trabajador/mis-proyectos", label: "Mis Proyectos", icon: FolderKanban },
]

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    trabajando: { label: "Trabajando", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    colacion: { label: "En Colación", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    pausado: { label: "Pausado", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
    finalizado: { label: "Jornada Finalizada", className: "bg-muted text-muted-foreground border-border" },
    inactivo: { label: "Sin iniciar", className: "bg-muted text-muted-foreground border-border" },
  }
  const c = config[status] ?? config.inactivo
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  )
}

export function WorkerHeader() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { status } = useTimer()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  function handleLogout() {
    logout()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/trabajador/mi-jornada" className="flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="Ingeniera PASS"
              width={120}
              height={52}
              className="dark:invert-0"
            />
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={status} />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </Button>

          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <span className="text-sm font-medium text-foreground hidden sm:block">
              {user?.name?.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
