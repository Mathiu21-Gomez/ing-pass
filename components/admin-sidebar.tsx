"use client"

import { Building2, CalendarDays, Clock, FolderKanban, History, LayoutDashboard, ListTodo, Megaphone, ShieldCheck, Users } from "lucide-react"

import { AppSidebarShell, type SidebarSection } from "@/components/app-sidebar-shell"

const navSections: SidebarSection[] = [
  {
    label: "General",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/admin/historial", label: "Historial Equipo", icon: History },
      { href: "/admin/mi-historial", label: "Mi Historial", icon: Clock },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { href: "/admin/comunicacion", label: "Comunicados", icon: Megaphone },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/admin/clientes", label: "Clientes", icon: Building2 },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      { href: "/admin/proyectos", label: "Proyectos", icon: FolderKanban },
      { href: "/admin/tareas", label: "Tareas", icon: ListTodo },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/admin/roles", label: "Roles y Permisos", icon: ShieldCheck }],
  },
]

export function AdminSidebar() {
  return (
    <AppSidebarShell
      storageKey="sidebar:admin"
      roleLabel="Admin"
      roleTitleFallback="Administrador"
      roleDotClassName="bg-emerald-500 animate-pulse-soft"
      avatarClassName="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground"
      navSections={navSections}
    />
  )
}
