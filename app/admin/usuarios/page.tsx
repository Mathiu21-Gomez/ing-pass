"use client"

import { useState } from "react"
import { mockUsers } from "@/lib/mock-data"
import type { User, UserRole } from "@/lib/types"
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
  const crud = useCrud<User>(mockUsers, {
    searchFields: ["name", "email", "position"],
  })
  const [form, setForm] = useState({ name: "", email: "", role: "trabajador" as UserRole, position: "", active: true, scheduleType: "fijo" as "fijo" | "libre", scheduleStart: "08:00", scheduleEnd: "17:00" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function openNew() {
    setForm({ name: "", email: "", role: "trabajador", position: "", active: true, scheduleType: "fijo", scheduleStart: "08:00", scheduleEnd: "17:00" })
    setErrors({})
    crud.openCreate()
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position,
      active: user.active,
      scheduleType: user.scheduleType,
      scheduleStart: user.scheduleStart,
      scheduleEnd: user.scheduleEnd,
    })
    setErrors({})
    crud.openEdit(user)
  }

  function handleSave() {
    const result = userSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    if (crud.editing) {
      crud.update(crud.editing.id, form)
      toast.success("Usuario actualizado")
    } else {
      const newUser: User = { id: `u${Date.now()}`, ...form }
      crud.add(newUser)
      toast.success("Usuario creado")
    }
    crud.closeDialog()
  }

  function toggleActive(id: string) {
    const user = crud.items.find((u) => u.id === id)
    if (user) {
      crud.update(id, { active: !user.active })
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
                    user.role === "admin"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {user.role === "admin" ? "Administrador" : "Trabajador"}
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
                  user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {user.role === "admin" ? "Admin" : "Trabajador"}
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
                  {user.scheduleType === "libre" ? "Libre (24h)" : `${user.scheduleStart} - ${user.scheduleEnd}`}
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
                    <SelectItem value="trabajador">Trabajador</SelectItem>
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
                  if (v === "libre") {
                    setForm({ ...form, scheduleType: v, scheduleStart: "00:00", scheduleEnd: "23:59" })
                  } else {
                    setForm({ ...form, scheduleType: v, scheduleStart: "08:00", scheduleEnd: "17:00" })
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Entrada</Label>
                    <Input
                      type="time"
                      value={form.scheduleStart}
                      onChange={(e) => setForm({ ...form, scheduleStart: e.target.value })}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Salida</Label>
                    <Input
                      type="time"
                      value={form.scheduleEnd}
                      onChange={(e) => setForm({ ...form, scheduleEnd: e.target.value })}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
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
