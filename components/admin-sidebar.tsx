"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  LogOut,
  History,
  Menu,
  ShieldCheck,
  Home,
  Inbox,
  ListTodo,
  Timer,
  Clock,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navItems = [
  { href: "/admin/home", label: "Inicio", icon: Home },
  { href: "/admin/mi-jornada", label: "Mi Jornada", icon: Timer },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/historial", label: "Historial Equipo", icon: History },
  { href: "/admin/mi-historial", label: "Mi Historial", icon: Clock },
  { href: "/admin/clientes", label: "Clientes", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/admin/tareas", label: "Tareas", icon: ListTodo },
  { href: "/admin/bandeja", label: "Bandeja", icon: Inbox },
  { href: "/admin/roles", label: "Roles y Permisos", icon: ShieldCheck },
]

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const router = useRouter()

  const { data: messages = [] } = useSWR<{ isPreStart: boolean; readAt: string | null }[]>(
    "/api/messages",
    { refreshInterval: 30_000, dedupingInterval: 15_000 }
  )
  const preStartCount = messages.filter((m) => m.isPreStart && !m.readAt).length

  function handleLogout() {
    logout()
    router.push("/")
  }

  return (
    <>
      {/* Header corporativo con gradiente sutil */}
      <div className="relative px-4 py-4">
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar-primary/8 to-transparent border-b border-sidebar-border/50" />
        <div className="relative flex items-center gap-3">
          <Image
            src="/Logo BIMakers con Texto Gris.png"
            alt="BIMakers"
            width={150}
            height={50}
            className="object-contain"
          />
        </div>
      </div>

      {/* Separador con label */}
      <div className="px-6 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Navegación
        </p>
      </div>

      {/* Nav items con indicador lateral animado */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isBandeja = item.href.endsWith("/bandeja")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "nav-indicator relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
              data-active={isActive}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive && "text-sidebar-primary"
                )}
              />
              {item.label}
              {isBandeja && preStartCount > 0 ? (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {preStartCount}
                </span>
              ) : isActive ? (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse-soft" />
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Footer con perfil corporativo */}
      <div className="border-t border-sidebar-border p-3">
        {/* User card corporativo */}
        <div className="rounded-xl bg-sidebar-accent/60 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-xs font-bold text-sidebar-primary-foreground shadow-sm">
              {user?.name?.charAt(0) ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/50">
                {user?.position}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-sidebar-foreground/40 hover:bg-sidebar-border hover:text-destructive transition-all duration-200"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: Sheet trigger button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-background/80 backdrop-blur btn-press"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 p-0 bg-sidebar text-sidebar-foreground"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menú de navegación</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <SidebarContent onItemClick={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Fixed sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col bg-sidebar/95 backdrop-blur-xl text-sidebar-foreground border-r border-sidebar-border">
        <SidebarContent />
      </aside>
    </>
  )
}
