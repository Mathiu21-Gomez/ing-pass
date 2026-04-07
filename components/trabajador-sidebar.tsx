"use client"

import { CalendarDays, History, ListTodo, Megaphone } from "lucide-react"

import { AppSidebarShell, type SidebarSection } from "@/components/app-sidebar-shell"

const navSections: SidebarSection[] = [
  {
    label: "General",
    items: [
      { href: "/trabajador/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/trabajador/historial", label: "Mi Historial", icon: History },
    ],
  },
  {
    label: "Mis Tareas",
    items: [
      { href: "/trabajador/tareas", label: "Tareas", icon: ListTodo },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { href: "/trabajador/comunicacion", label: "Comunicados", icon: Megaphone },
    ],
  },
]

export function TrabajadorSidebar() {
  return (
    <AppSidebarShell
      storageKey="sidebar:trabajador"
      roleLabel="Trabajador"
      roleTitleFallback="Colaborador"
      roleDotClassName="bg-blue-500 animate-pulse-soft"
      avatarClassName="bg-gradient-to-br from-blue-500 to-blue-600 text-white"
      navSections={navSections}
    />
  )
}
