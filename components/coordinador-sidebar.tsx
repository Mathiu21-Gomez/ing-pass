"use client"

import { CalendarDays, ClipboardList, Clock, LayoutDashboard, Megaphone, Users } from "lucide-react"

import { AppSidebarShell, type SidebarSection } from "@/components/app-sidebar-shell"

const navSections: SidebarSection[] = [
  {
    label: "General",
    items: [
      { href: "/coordinador/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/coordinador/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/coordinador/mi-historial", label: "Mi Historial", icon: Clock },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { href: "/coordinador/comunicacion", label: "Comunicados", icon: Megaphone },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/coordinador/tareas", label: "Gestión de Tareas", icon: ClipboardList },
      { href: "/coordinador/equipo", label: "Panel Equipo", icon: Users },
    ],
  },
]

export function CoordinadorSidebar() {
  return (
    <AppSidebarShell
      storageKey="sidebar:coordinador"
      roleLabel="Coordinador"
      roleTitleFallback="Coordinador"
      roleDotClassName="bg-amber-500 animate-pulse-soft"
      avatarClassName="bg-gradient-to-br from-amber-500 to-amber-600"
      navSections={navSections}
    />
  )
}
