"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, LogOut, Menu, Settings, type LucideIcon } from "lucide-react"
import useSWR from "swr"

import { useAuth } from "@/lib/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type SidebarItem = {
  href: string
  label: string
  icon: LucideIcon
}

type SidebarSection = {
  label: string
  items: SidebarItem[]
}

type AppSidebarShellProps = {
  storageKey: string
  roleLabel: string
  roleTitleFallback: string
  roleDotClassName: string
  avatarClassName: string
  navSections: SidebarSection[]
}

// ── Badge ────────────────────────────────────────────────────────────────────
function NavBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null
  return (
    <span
      className={cn(
        "flex min-w-[20px] items-center justify-center rounded-md px-1 py-0.5 text-[10px] font-bold leading-none",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

// ── Collapsed nav icon button ────────────────────────────────────────────────
function CollapsedNavItem({
  item,
  isActive,
  badge,
  onClick,
}: {
  item: SidebarItem
  isActive: boolean
  badge?: number
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          onClick={onClick}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
            isActive
              ? "bg-white text-foreground shadow-sm dark:bg-sidebar-accent dark:text-sidebar-accent-foreground"
              : "text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70"
          )}
        >
          <item.icon className="h-[15px] w-[15px]" />
          {badge && badge > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-md bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Main sidebar content ─────────────────────────────────────────────────────
function SidebarContent({
  collapsed,
  navSections,
  onToggle,
  onItemClick,
  roleLabel,
  roleTitleFallback,
  roleDotClassName,
  avatarClassName,
}: {
  collapsed: boolean
  navSections: SidebarSection[]
  onToggle?: () => void
  onItemClick?: () => void
  roleLabel: string
  roleTitleFallback: string
  roleDotClassName: string
  avatarClassName: string
}) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const router = useRouter()

  // Accordion state — all sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((s) => [s.label, true]))
  )

  const { data: notifData } = useSWR<{ unreadCount: number }>("/api/notifications", {
    refreshInterval: 30_000,
    dedupingInterval: 15_000,
  })
  const unreadCount = notifData?.unreadCount ?? 0

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : roleLabel[0]?.toUpperCase() ?? "U"

  function handleLogout() {
    logout()
    router.push("/")
  }

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  // Flat list of all items (for collapsed mode)
  const allItems = navSections.flatMap((s) => s.items)

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col">

        {/* ── Logo header ──────────────────────────────────────────── */}
        <div className={cn("shrink-0 pb-2 pt-4", collapsed ? "flex justify-center px-2" : "px-4")}>
          {collapsed ? (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 transition-colors hover:bg-foreground/10"
              aria-label="Expandir barra lateral"
            >
              <Image
                src="/Logo BIMakers con Texto Gris.png"
                alt="BIMakers"
                width={26}
                height={26}
                className="object-contain"
                priority
              />
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <Image
                src="/Logo BIMakers con Texto Gris.png"
                alt="BIMakers"
                width={120}
                height={40}
                className="object-contain"
                priority
              />
              {onToggle ? (
                <button
                  type="button"
                  onClick={onToggle}
                  className="rounded-lg p-1.5 text-sidebar-foreground/30 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground/60"
                  aria-label="Colapsar barra lateral"
                >
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────────────── */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto",
            collapsed ? "flex flex-col items-center gap-0.5 px-2 py-3" : "px-3 py-2"
          )}
        >
          {collapsed ? (
            // Collapsed: all icons flat
            allItems.map((item) => {
              const isTasks = item.href.endsWith("/tareas")
              return (
                <CollapsedNavItem
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  badge={isTasks ? unreadCount : undefined}
                  onClick={onItemClick}
                />
              )
            })
          ) : (
            // Expanded: accordion sections
            navSections.map((section) => {
              const isOpen = openSections[section.label] ?? true
              return (
                <div key={section.label} className="mb-1 last:mb-0">
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35">
                      {section.label}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-3 w-3 text-sidebar-foreground/25" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-sidebar-foreground/25" />
                    )}
                  </button>

                  {/* Section items */}
                  {isOpen ? (
                    <div className="mt-0.5 space-y-0.5">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href
                        const isTasks = item.href.endsWith("/tareas")
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onItemClick}
                            className={cn(
                              "group flex h-9 items-center gap-3 rounded-xl px-3 text-sm transition-all duration-150",
                              isActive
                                ? "bg-white font-semibold text-foreground shadow-sm dark:bg-sidebar-accent dark:text-sidebar-accent-foreground"
                                : "font-medium text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/80"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
                                isActive
                                  ? "text-foreground dark:text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/65"
                              )}
                            >
                              <item.icon className="h-[14px] w-[14px]" />
                            </div>
                            <span className="flex-1 truncate leading-none">{item.label}</span>
                            {isTasks && unreadCount > 0 ? (
                              <NavBadge
                                count={unreadCount}
                                className="bg-primary/15 text-primary"
                              />
                            ) : null}
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className={cn("shrink-0 pb-4 pt-2", collapsed ? "flex flex-col items-center gap-2 px-2" : "px-3")}>
          <div className={cn("mb-2 h-px bg-sidebar-border/50", collapsed && "w-8")} />

          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-sidebar-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Cerrar sesión"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs">
                  Ajustes
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative cursor-default">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-background",
                        avatarClassName
                      )}
                    >
                      {initials}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-background bg-emerald-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs">
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-muted-foreground">{user?.position ?? roleTitleFallback}</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-background",
                    avatarClassName
                  )}
                >
                  {initials}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-background bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground/80">
                  {user?.name}
                </p>
                <p className="truncate text-[10px] leading-tight text-sidebar-foreground/35">
                  {user?.position ?? roleTitleFallback}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function AppSidebarShell({
  storageKey,
  roleLabel,
  roleTitleFallback,
  roleDotClassName,
  avatarClassName,
  navSections,
}: AppSidebarShellProps) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
    setCollapsed(raw === "collapsed")
  }, [storageKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(storageKey, collapsed ? "collapsed" : "expanded")
  }, [collapsed, storageKey])

  return (
    <>
      {/* Mobile trigger */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 bg-background/80 shadow-sm backdrop-blur">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Menú de navegación</SheetTitle>
            </SheetHeader>
            <SidebarContent
              collapsed={false}
              navSections={navSections}
              onItemClick={() => setOpen(false)}
              roleLabel={roleLabel}
              roleTitleFallback={roleTitleFallback}
              roleDotClassName={roleDotClassName}
              avatarClassName={avatarClassName}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sidebar-glass hidden h-screen flex-col text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-[60px]" : "w-[228px]"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          navSections={navSections}
          onToggle={() => setCollapsed((v) => !v)}
          roleLabel={roleLabel}
          roleTitleFallback={roleTitleFallback}
          roleDotClassName={roleDotClassName}
          avatarClassName={avatarClassName}
        />
      </aside>
    </>
  )
}

export type { SidebarSection, SidebarItem }
