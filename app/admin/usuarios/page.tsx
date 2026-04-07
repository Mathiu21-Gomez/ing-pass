"use client"

import { useState, useCallback } from "react"
import { usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { User, UserRole, DaySchedule } from "@/lib/types"
import { DAY_LABELS } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { userSchema, createUserSchema, formatZodErrors } from "@/lib/schemas"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskShellHeader } from "@/components/task-shell"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Plus, Pencil, Search, Clock, Eye, EyeOff, FolderKanban, Mail, User as UserIcon, AtSign, Briefcase, ShieldCheck, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function getUserProjectSummary(user: User) {
  const coordinated = user.projectSummary?.coordinated.length ?? 0
  const worker = user.projectSummary?.worker.length ?? 0
  const activeTasks = user.projectSummary?.activeTaskAssignments ?? 0

  return [
    coordinated > 0 ? `Coordina ${coordinated}` : null,
    worker > 0 ? `Opera en ${worker}` : null,
    activeTasks > 0 ? `${activeTasks} tarea${activeTasks === 1 ? "" : "s"} activa${activeTasks === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ") || "Sin carga operativa"
}

function getUserProjectHighlight(user: User) {
  const coordinated = user.projectSummary?.coordinated ?? []
  if (coordinated.length > 0) {
    return coordinated.slice(0, 2).map((project) => project.name).join(", ")
  }

  const worker = user.projectSummary?.worker ?? []
  if (worker.length > 0) {
    return worker.slice(0, 2).map((project) => project.name).join(", ")
  }

  return "Sin proyectos vinculados"
}

// ── Role visual config ────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  label: string
  gradient: string
  avatarGradient: string
  bg: string
  text: string
  border: string
}> = {
  admin: {
    label: "Admin",
    gradient: "from-emerald-500 to-teal-400",
    avatarGradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  coordinador: {
    label: "Coordinador",
    gradient: "from-blue-500 to-indigo-500",
    avatarGradient: "from-blue-500 to-indigo-500",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  trabajador: {
    label: "Trabajador",
    gradient: "from-violet-500 to-purple-500",
    avatarGradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-500/20",
  },
  externo: {
    label: "Externo",
    gradient: "from-amber-500 to-orange-400",
    avatarGradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20",
  },
}

// ── UserCard ──────────────────────────────────────────────────────────────────
function UserCard({
  user,
  onEdit,
  onPromote,
  onToggle,
}: {
  user: User
  onEdit: (u: User) => void
  onPromote: (u: User) => void
  onToggle: (id: string) => void
}) {
  const config = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.trabajador
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const scheduleLabel = (() => {
    if (user.scheduleType === "libre") return "Libre · 24h"
    const workDays = user.weeklySchedule?.filter((d) => d.isWorkingDay) ?? []
    if (workDays.length === 0) return "Sin horario"
    const first = workDays[0]
    return `${workDays.length}d · ${first.startTime}–${first.endTime}`
  })()

  return (
    <div className={cn(
      "group relative flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden",
      "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      !user.active && "opacity-60"
    )}>
      {/* Role gradient strip */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", config.gradient)} />

      <div className="flex flex-1 flex-col p-5 gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                config.avatarGradient
              )}>
                {initials}
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                user.active ? "bg-emerald-500" : "bg-muted-foreground/40"
              )} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground leading-tight truncate">{user.position}</p>
            </div>
          </div>
          <span className={cn(
            "shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border",
            config.bg, config.text, config.border
          )}>
            {config.label}
          </span>
        </div>

        {/* Project summary */}
        <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-xs font-medium text-foreground leading-tight">
              {getUserProjectSummary(user)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight truncate pl-4">
            {getUserProjectHighlight(user)}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="font-mono truncate">{scheduleLabel}</span>
          </div>
          <Switch
            checked={user.active}
            onCheckedChange={() => onToggle(user.id)}
            aria-label={user.active ? "Desactivar usuario" : "Activar usuario"}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3 mt-auto">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {user.promotion?.canPromoteToCoordinator ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onPromote(user)}
              >
                Promover
              </Button>
            ) : null}
            <button
              onClick={() => onEdit(user)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={`Editar ${user.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UsuariosPage() {
  const { user: currentUser, refreshSession } = useAuth()
  const fetchUsers = useCallback(() => usersApi.getAll(), [])
  const { data: apiUsers } = useApiData(fetchUsers, [] as User[])
  const crud = useCrud<User>(apiUsers, {
    searchFields: ["name", "email", "position"],
  })
  const DEFAULT_SCHEDULE: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    startTime: "08:00",
    endTime: "17:00",
    isWorkingDay: i < 5,
    reason: "",
  }))

  const [form, setForm] = useState({ name: "", email: "", emailPersonal: "", role: "trabajador" as UserRole, position: "", active: true, scheduleType: "fijo" as "fijo" | "libre", password: "", confirmPassword: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function updateDay(dayOfWeek: number, patch: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    )
  }

  function openNew() {
    setForm({ name: "", email: "", emailPersonal: "", role: "trabajador", position: "", active: true, scheduleType: "fijo", password: "", confirmPassword: "" })
    setShowPassword(false)
    setSchedule(DEFAULT_SCHEDULE)
    setErrors({})
    crud.openCreate()
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      emailPersonal: user.emailPersonal,
      role: user.role,
      position: user.position,
      active: user.active,
      scheduleType: user.scheduleType,
      password: "",
      confirmPassword: "",
    })
    setSchedule(user.weeklySchedule.length > 0 ? user.weeklySchedule : DEFAULT_SCHEDULE)
    setErrors({})
    crud.openEdit(user)
  }

  async function handleSave() {
    const { password, confirmPassword, ...baseFields } = form

    if (crud.editing) {
      const result = userSchema.safeParse(baseFields)
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        toast.error("Corrige los errores del formulario")
        return
      }
    } else {
      if (password !== confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Las contraseñas no coinciden" }))
        toast.error("Las contraseñas no coinciden")
        return
      }
      const result = createUserSchema.safeParse({ ...baseFields, password })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        toast.error("Corrige los errores del formulario")
        return
      }
    }

    setErrors({})

    const payload = crud.editing
      ? { ...baseFields, weeklySchedule: schedule }
      : { ...baseFields, password, weeklySchedule: schedule }

    try {
      if (crud.editing) {
        const updated = await usersApi.update(crud.editing.id, payload as Partial<User>)
        crud.update(crud.editing.id, updated)
        toast.success("Usuario actualizado")
        if (crud.editing.id === currentUser?.id) {
          await refreshSession()
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newUser = await usersApi.create(payload as any)
        crud.add(newUser)
        toast.success("Usuario creado")
      }
      crud.closeDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar usuario")
    }
  }

  async function toggleActive(id: string) {
    const u = crud.items.find((u) => u.id === id)
    if (u) {
      try {
        await usersApi.update(id, { active: !u.active })
        crud.update(id, { active: !u.active })
      } catch {
        toast.error("Error al cambiar estado")
      }
    }
  }

  async function handlePromote(user: User) {
    try {
      const updated = await usersApi.update(user.id, { role: "coordinador" })
      crud.update(user.id, updated)
      const cleanup = updated.roleTransition
      const cleanupParts = cleanup
        ? [
            cleanup.removedProjectMemberships > 0 ? `${cleanup.removedProjectMemberships} proyecto${cleanup.removedProjectMemberships === 1 ? "" : "s"}` : null,
            cleanup.removedTaskAssignments > 0 ? `${cleanup.removedTaskAssignments} tarea${cleanup.removedTaskAssignments === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join(" y ")
        : ""

      toast.success(cleanupParts ? `Ascenso aplicado. Se liberaron ${cleanupParts} del rol trabajador.` : "Usuario ascendido a coordinador")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ascender al usuario")
    }
  }

  // Live preview values for Sheet header
  const previewConfig = ROLE_CONFIG[form.role] ?? ROLE_CONFIG.trabajador
  const previewInitials = form.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-col gap-6 page-enter">
      <TaskShellHeader
        eyebrow="Gestión"
        title="Usuarios"
        description={`${crud.items.filter((u) => u.active).length} activos de ${crud.items.length} usuarios registrados.`}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        }
      />

      {/* Sheet at page level — controlled by crud.dialogOpen */}
      <Sheet open={crud.dialogOpen} onOpenChange={(open) => { if (!open) crud.closeDialog() }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg overflow-hidden">
          {/* Role gradient strip — updates live as role changes */}
          <div className={cn("h-1.5 w-full shrink-0 bg-gradient-to-r transition-all duration-500", previewConfig.gradient)} />

          {/* Header with live avatar preview */}
          <SheetHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-md transition-all duration-300",
                previewConfig.avatarGradient
              )}>
                {previewInitials || <UserIcon className="h-6 w-6" />}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <SheetTitle className="text-base">
                  {crud.editing ? "Editar usuario" : "Nuevo usuario"}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {crud.editing
                    ? `Modificando datos de ${crud.editing.name}.`
                    : "Completá los datos del nuevo colaborador."}
                </SheetDescription>
                <span className={cn(
                  "mt-1 inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all duration-300",
                  previewConfig.bg, previewConfig.text, previewConfig.border
                )}>
                  {previewConfig.label}
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* Section: Identidad */}
            <div className="px-6 pt-5 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Identidad</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="u-name">Nombre completo *</Label>
                  <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="u-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Juan Pérez González"
                      className={cn("h-11 pl-10", errors.name && "border-destructive")}
                    />
                  </div>
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="u-position">Cargo *</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="u-position"
                        value={form.position}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                        placeholder="Desarrollador"
                        className={cn("h-11 pl-10", errors.position && "border-destructive")}
                      />
                    </div>
                    {errors.position && <p className="text-xs text-destructive">{errors.position}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Rol *</Label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                      <Select value={form.role} onValueChange={(v: UserRole) => setForm({ ...form, role: v })}>
                        <SelectTrigger className={cn("h-11 pl-10", errors.role && "border-destructive")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="coordinador">Coordinador</SelectItem>
                          <SelectItem value="trabajador">Trabajador</SelectItem>
                          <SelectItem value="externo">Externo (Cliente)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Contacto */}
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contacto</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="u-email">Email corporativo *</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="u-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="usuario@empresa.cl"
                      className={cn("h-11 pl-10", errors.email && "border-destructive")}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="u-email-personal">Email personal</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="u-email-personal"
                      type="email"
                      value={form.emailPersonal}
                      onChange={(e) => setForm({ ...form, emailPersonal: e.target.value })}
                      placeholder="correo.personal@gmail.com"
                      className={cn("h-11 pl-10", errors.emailPersonal && "border-destructive")}
                    />
                  </div>
                  {errors.emailPersonal && <p className="text-xs text-destructive">{errors.emailPersonal}</p>}
                </div>
              </div>
            </div>

            {!crud.editing && (
              <>
                <div className="h-px bg-border/50 mx-6" />

                {/* Section: Acceso */}
                <div className="px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Acceso</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="u-password">Contraseña *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="u-password"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="Mín. 8 caracteres"
                          className={cn("h-11 pl-10 pr-9", errors.password && "border-destructive")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="u-confirm-password">Confirmar *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="u-confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          placeholder="Repetir contraseña"
                          className={cn("h-11 pl-10", errors.confirmPassword && "border-destructive")}
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Estado */}
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Estado</p>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-sm font-medium">Usuario activo</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.active ? "Puede iniciar sesión y registrar jornada" : "Acceso bloqueado al sistema"}
                  </p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>

            <div className="h-px bg-border/50 mx-6" />

            {/* Section: Horario */}
            <div className="px-6 py-4 pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Horario laboral</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Tipo de horario</span>
                  </div>
                  <Select value={form.scheduleType} onValueChange={(v: "fijo" | "libre") => {
                    setForm({ ...form, scheduleType: v })
                    if (v === "libre") {
                      setSchedule((prev) => prev.map((d) => ({ ...d, startTime: "00:00", endTime: "23:59", isWorkingDay: true })))
                    } else {
                      setSchedule(DEFAULT_SCHEDULE)
                    }
                  }}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fijo">Fijo</SelectItem>
                      <SelectItem value="libre">Libre (24h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.scheduleType === "fijo" && (
                  <div className="space-y-1.5">
                    {schedule.map((day) => {
                      const isWeekend = day.dayOfWeek >= 5
                      return (
                        <div key={day.dayOfWeek} className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                          !day.isWorkingDay && "opacity-50",
                          isWeekend && day.isWorkingDay && "bg-amber-500/10 border border-amber-500/20"
                        )}>
                          <Switch
                            checked={day.isWorkingDay}
                            onCheckedChange={(v) => updateDay(day.dayOfWeek, { isWorkingDay: v, reason: v && isWeekend ? day.reason : "" })}
                            className="scale-75"
                          />
                          <span className={cn("text-xs font-medium w-12", isWeekend && "text-amber-600 dark:text-amber-400")}>
                            {DAY_LABELS[day.dayOfWeek].slice(0, 3)}
                          </span>
                          {day.isWorkingDay ? (
                            <>
                              <Input type="time" value={day.startTime} onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })} className="h-7 text-xs font-mono w-24" />
                              <span className="text-muted-foreground text-xs">→</span>
                              <Input type="time" value={day.endTime} onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })} className="h-7 text-xs font-mono w-24" />
                              {isWeekend && (
                                <Input placeholder="Motivo..." value={day.reason} onChange={(e) => updateDay(day.dayOfWeek, { reason: e.target.value })} className="h-7 text-xs flex-1" />
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {isWeekend ? "No laboral" : "Día libre"}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {form.scheduleType === "libre" && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    El trabajador puede registrar jornada en cualquier horario (contrato por obra).
                  </p>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t border-border bg-muted/20 px-6 py-4 flex-row gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={crud.closeDialog}>Cancelar</Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              {crud.editing ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o cargo..."
          value={crud.search}
          onChange={(e) => crud.setSearch(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      {/* Stats bar */}
      {crud.filteredItems.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
            const count = crud.filteredItems.filter((u) => u.role === role).length
            if (count === 0) return null
            return (
              <div key={role} className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full bg-gradient-to-br", cfg.gradient)} />
                <span>{cfg.label}: <span className="font-semibold text-foreground">{count}</span></span>
              </div>
            )
          })}
        </div>
      )}

      {/* Cards grid */}
      {crud.filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Sin usuarios</p>
          <p className="text-xs text-muted-foreground mt-1">Ajustá el filtro o creá un nuevo usuario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {crud.filteredItems.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={openEdit}
              onPromote={handlePromote}
              onToggle={toggleActive}
            />
          ))}
        </div>
      )}

    </div>
  )
}
