"use client"

import { useState, useCallback } from "react"
import { usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { User, UserRole, DaySchedule } from "@/lib/types"
import { DAY_LABELS } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { userSchema, formatZodErrors } from "@/lib/schemas"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Search, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function UsuariosPage() {
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

  const [form, setForm] = useState({ name: "", email: "", emailPersonal: "", role: "trabajador" as UserRole, position: "", active: true, scheduleType: "fijo" as "fijo" | "libre" })
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function updateDay(dayOfWeek: number, patch: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    )
  }

  function openNew() {
    setForm({ name: "", email: "", emailPersonal: "", role: "trabajador", position: "", active: true, scheduleType: "fijo" })
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
    })
    setSchedule(user.weeklySchedule.length > 0 ? user.weeklySchedule : DEFAULT_SCHEDULE)
    setErrors({})
    crud.openEdit(user)
  }

  async function handleSave() {
    const result = userSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    const payload = { ...form, weeklySchedule: schedule }

    try {
      if (crud.editing) {
        const updated = await usersApi.update(crud.editing.id, payload)
        crud.update(crud.editing.id, updated)
        toast.success("Usuario actualizado")
      } else {
        const newUser = await usersApi.create(payload as Omit<User, "id">)
        crud.add(newUser)
        toast.success("Usuario creado")
      }
      crud.closeDialog()
    } catch {
      toast.error("Error al guardar usuario")
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

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {crud.items.filter((u) => u.active).length} activos de {crud.items.length} usuarios
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o cargo..."
          value={crud.search}
          onChange={(e) => crud.setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden animate-fade-in-up">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crud.filteredItems.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {user.name.charAt(0)}
                    </div>
                    <span className="font-medium text-foreground">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell className="text-foreground">{user.position}</TableCell>
                <TableCell>
                  <span className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    user.role === "admin" ? "bg-primary/10 text-primary" :
                      user.role === "coordinador" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                        user.role === "externo" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                  )}>
                    {user.role === "admin" ? "Admin" : user.role === "coordinador" ? "Coordinador" : user.role === "externo" ? "Externo" : "Trabajador"}
                  </span>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={user.active}
                    onCheckedChange={() => toggleActive(user.id)}
                    aria-label={user.active ? "Desactivar" : "Activar"}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => openEdit(user)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Total Usuarios</TableCell>
              <TableCell className="text-right font-semibold">
                {crud.filteredItems.filter((u) => u.active).length} activos
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {crud.filteredItems.map((user) => (
          <div key={user.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.position}</p>
                </div>
              </div>
              <button
                onClick={() => openEdit(user)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground text-xs">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Rol</span>
                <span className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                  user.role === "admin" ? "bg-primary/10 text-primary" :
                    user.role === "coordinador" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                      user.role === "externo" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                        "bg-muted text-muted-foreground"
                )}>
                  {user.role === "admin" ? "Admin" : user.role === "coordinador" ? "Coordinador" : user.role === "externo" ? "Externo" : "Trabajador"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Activo</span>
                <Switch
                  checked={user.active}
                  onCheckedChange={() => toggleActive(user.id)}
                  aria-label={user.active ? "Desactivar" : "Activar"}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Horario</span>
                <span className="text-xs text-foreground font-mono">
                  {user.scheduleType === "libre" ? "Libre (24h)" : (() => {
                    const workDays = user.weeklySchedule?.filter((d) => d.isWorkingDay) ?? []
                    if (workDays.length === 0) return "Sin horario"
                    const first = workDays[0]
                    return `${workDays.length}d · ${first.startTime}-${first.endTime}`
                  })()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={crud.dialogOpen} onOpenChange={crud.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{crud.editing ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre completo *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email personal</Label>
              <Input
                type="email"
                value={form.emailPersonal}
                onChange={(e) => setForm({ ...form, emailPersonal: e.target.value })}
                placeholder="correo.personal@gmail.com"
                className={errors.emailPersonal ? "border-destructive" : ""}
              />
              {errors.emailPersonal && <p className="text-xs text-destructive">{errors.emailPersonal}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Cargo *</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className={errors.position ? "border-destructive" : ""}
                />
                {errors.position && <p className="text-xs text-destructive">{errors.position}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Rol *</Label>
                <Select value={form.role} onValueChange={(v: UserRole) => setForm({ ...form, role: v })}>
                  <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="coordinador">Coordinador</SelectItem>
                    <SelectItem value="trabajador">Trabajador</SelectItem>
                    <SelectItem value="externo">Externo (Cliente)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">Usuario activo</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>

            {/* Schedule section */}
            <div className="rounded-lg border border-border p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Horario Laboral</Label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo de horario</span>
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
                        isWeekend && day.isWorkingDay && "bg-amber-500/10 border border-amber-500/20 rounded"
                      )}>
                        <Switch
                          checked={day.isWorkingDay}
                          onCheckedChange={(v) => updateDay(day.dayOfWeek, { isWorkingDay: v, reason: v && isWeekend ? day.reason : "" })}
                          className="scale-75"
                        />
                        <span className={cn(
                          "text-xs font-medium w-12",
                          isWeekend && "text-amber-600 dark:text-amber-400"
                        )}>
                          {DAY_LABELS[day.dayOfWeek].slice(0, 3)}
                        </span>
                        {day.isWorkingDay ? (
                          <>
                            <Input
                              type="time"
                              value={day.startTime}
                              onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                              className="h-7 text-xs font-mono w-24"
                            />
                            <span className="text-muted-foreground text-xs">→</span>
                            <Input
                              type="time"
                              value={day.endTime}
                              onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                              className="h-7 text-xs font-mono w-24"
                            />
                            {isWeekend && (
                              <Input
                                placeholder="Motivo..."
                                value={day.reason}
                                onChange={(e) => updateDay(day.dayOfWeek, { reason: e.target.value })}
                                className="h-7 text-xs flex-1"
                              />
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
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  El trabajador puede registrar jornada en cualquier horario (contrato por obra).
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={crud.closeDialog}>Cancelar</Button>
            <Button onClick={handleSave}>{crud.editing ? "Guardar Cambios" : "Crear Usuario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
