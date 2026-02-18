"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    LogOut,
    Moon,
    Sun,
    Menu,
} from "lucide-react"
import { useTheme } from "next-themes"
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
    { href: "/coordinador/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/coordinador/tareas", label: "Gestión de Tareas", icon: ClipboardList },
    { href: "/coordinador/equipo", label: "Panel Equipo", icon: Users },
]

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
    const pathname = usePathname()
    const { logout, user } = useAuth()
    const router = useRouter()
    const { theme, setTheme } = useTheme()

    function handleLogout() {
        logout()
        router.push("/")
    }

    return (
        <>
            <div className="relative px-4 py-4">
                <div className="absolute inset-0 bg-gradient-to-b from-sidebar-primary/5 to-transparent" />
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

            <div className="px-6 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                    Coordinador
                </p>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 px-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
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
                            {isActive && (
                                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse-soft" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            <div className="border-t border-sidebar-border p-3">
                <div className="flex items-center gap-2 mb-3 px-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>
                </div>

                <div className="rounded-xl bg-sidebar-accent/60 p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-xs font-bold text-white shadow-sm">
                            {user?.name?.charAt(0) ?? "C"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">
                                {user?.name}
                            </p>
                            <p className="truncate text-[11px] text-sidebar-foreground/50">
                                Coordinador
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

export function CoordinadorSidebar() {
    const [open, setOpen] = useState(false)

    return (
        <>
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

            <aside className="hidden md:flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
                <SidebarContent />
            </aside>
        </>
    )
}
