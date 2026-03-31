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
  ListTodo,
  Clock,
  ChevronRight,
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

const navSections = [
  {
    label: "General",
    items: [
      { href: "/admin/home",        label: "Inicio",          icon: Home },
      { href: "/admin/dashboard",   label: "Dashboard",       icon: LayoutDashboard },
      { href: "/admin/historial",   label: "Historial Equipo",icon: History },
      { href: "/admin/mi-historial",label: "Mi Historial",    icon: Clock },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/admin/clientes",    label: "Clientes",        icon: Building2 },
      { href: "/admin/usuarios",    label: "Usuarios",        icon: Users },
      { href: "/admin/proyectos",   label: "Proyectos",       icon: FolderKanban },
      { href: "/admin/tareas",      label: "Tareas",          icon: ListTodo },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/roles",       label: "Roles y Permisos",icon: ShieldCheck },
    ],
  },
]

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const router = useRouter()

  const { data: notifData } = useSWR<{ unreadCount: number }>(
    "/api/notifications",
    { refreshInterval: 30_000, dedupingInterval: 15_000 }
  )
  const unreadCount = notifData?.unreadCount ?? 0

  function handleLogout() {
    logout()
    router.push("/")
  }

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "A"

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo area ── */}
      <div className="relative px-5 py-5 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/10 via-sidebar-primary/5 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-border/80 to-transparent" />
        <div className="relative">
          <Image
            src="/Logo BIMakers con Texto Gris.png"
            alt="BIMakers"
            width={140}
            height={46}
            className="object-contain"
            priority
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            <span className="text-[10px] font-medium text-sidebar-foreground/40">Admin</span>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
        {navSections.map((section) => (
          <div key={section.label} className="mb-2">
            <p className="sidebar-section-label mb-1">{section.label}</p>
            {section.items.map((item) => {
              const isActive = pathname === item.href
              const isTareas = item.href.endsWith("/tareas")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "nav-item-active text-sidebar-primary"
                      : "text-sidebar-foreground/55 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-150",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "text-sidebar-foreground/40 group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                  )}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 leading-none">{item.label}</span>
                  {isTareas && unreadCount > 0 ? (
                    <span className="badge-pop flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
                      {unreadCount}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="h-3 w-3 text-sidebar-primary/50" />
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── User card ── */}
      <div className="shrink-0 p-3">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-border/60 to-transparent -mt-3 mb-3" />
        <div className="rounded-xl border border-sidebar-border/50 bg-sidebar-accent/40 p-3 hover:bg-sidebar-accent/70 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-[11px] font-bold text-sidebar-primary-foreground shadow-sm ring-2 ring-sidebar-primary/20">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-sidebar-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-sidebar-accent-foreground leading-snug">
                {user?.name}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/45 leading-snug">
                {user?.position ?? "Administrador"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/35 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-background/80 backdrop-blur btn-press shadow-sm"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Menú de navegación</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <SidebarContent onItemClick={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="sidebar-glass hidden md:flex h-screen w-64 flex-col text-sidebar-foreground">
        <SidebarContent />
      </aside>
    </>
  )
}
