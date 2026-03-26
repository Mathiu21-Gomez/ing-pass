"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Lock,
} from "lucide-react"
import {
  MODULES,
  ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  type Module,
  type Action,
} from "@/lib/permissions"

interface RoleData {
  id: string
  name: string
  description: string
  isSystem: boolean
  createdAt: string
  permissions: string[]
}

const ALL_MODULES = Object.values(MODULES) as Module[]
const ALL_ACTIONS = Object.values(ACTIONS) as Action[]

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleData[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleData | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingRole, setDeletingRole] = useState<RoleData | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/roles")
      if (!res.ok) throw new Error("Error al cargar roles")
      const data = await res.json()
      setRoles(data)
    } catch {
      toast.error("Error al cargar roles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  function openCreate() {
    setEditingRole(null)
    setFormName("")
    setFormDescription("")
    setFormPermissions(new Set())
    setDialogOpen(true)
  }

  function openEdit(role: RoleData) {
    setEditingRole(role)
    setFormName(role.name)
    setFormDescription(role.description)
    setFormPermissions(new Set(role.permissions))
    setDialogOpen(true)
  }

  function togglePermission(key: string) {
    setFormPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleModule(module: Module) {
    const modulePerms = ALL_ACTIONS.map((a) => `${module}:${a}`)
    const allChecked = modulePerms.every((p) => formPermissions.has(p))
    setFormPermissions((prev) => {
      const next = new Set(prev)
      modulePerms.forEach((p) => (allChecked ? next.delete(p) : next.add(p)))
      return next
    })
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("El nombre del rol es requerido")
      return
    }
    setSaving(true)
    try {
      let roleId: string

      if (editingRole) {
        const res = await fetch(`/api/roles/${editingRole.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, description: formDescription }),
        })
        if (!res.ok) throw new Error()
        roleId = editingRole.id
      } else {
        const res = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, description: formDescription }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        roleId = data.id
      }

      // Update permissions
      await fetch(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(formPermissions) }),
      })

      toast.success(editingRole ? "Rol actualizado" : "Rol creado")
      setDialogOpen(false)
      fetchRoles()
    } catch {
      toast.error("Error al guardar rol")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingRole) return
    try {
      const res = await fetch(`/api/roles/${deletingRole.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Error al eliminar rol")
        return
      }
      toast.success("Rol eliminado")
      setDeleteDialogOpen(false)
      fetchRoles()
    } catch {
      toast.error("Error al eliminar rol")
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await fetch("/api/roles/seed", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Sistema inicializado correctamente")
      data.report?.forEach((line: string) => console.log(line))
      fetchRoles()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Roles y Permisos</h1>
            <p className="text-sm text-muted-foreground">
              Gestioná los roles del sistema y sus permisos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            <RefreshCw className={`h-4 w-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
            Inicializar roles por defecto
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo rol
          </Button>
        </div>
      </div>

      {/* Roles list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4">
          {roles.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No hay roles. Hacé clic en "Inicializar roles por defecto" para empezar.
            </div>
          )}
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{role.name}</span>
                  {role.isSystem && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Sistema
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {role.permissions.length} permisos
                  </Badge>
                </div>
                {role.description && (
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 8).map((perm) => {
                    const [mod, act] = perm.split(":")
                    return (
                      <span
                        key={perm}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium"
                      >
                        {MODULE_LABELS[mod as Module] ?? mod} — {ACTION_LABELS[act as Action] ?? act}
                      </span>
                    )
                  })}
                  {role.permissions.length > 8 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{role.permissions.length - 8} más
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => { setDeletingRole(role); setDeleteDialogOpen(true) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nombre del rol</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ej: supervisor"
                disabled={editingRole?.isSystem}
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="¿Qué puede hacer este rol?"
                rows={2}
              />
            </div>

            {/* Permission matrix */}
            <div className="space-y-2">
              <Label>Permisos</Label>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-medium w-40">Módulo</th>
                      {ALL_ACTIONS.map((action) => (
                        <th key={action} className="text-center px-2 py-2 font-medium">
                          {ACTION_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((module) => {
                      const modulePerms = ALL_ACTIONS.map((a) => `${module}:${a}`)
                      const allChecked = modulePerms.every((p) => formPermissions.has(p))
                      const someChecked = modulePerms.some((p) => formPermissions.has(p))
                      return (
                        <tr key={module} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={allChecked}
                                data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                                onCheckedChange={() => toggleModule(module)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="font-medium">{MODULE_LABELS[module]}</span>
                            </div>
                          </td>
                          {ALL_ACTIONS.map((action) => {
                            const key = `${module}:${action}`
                            return (
                              <td key={action} className="text-center px-2 py-2">
                                <Checkbox
                                  checked={formPermissions.has(key)}
                                  onCheckedChange={() => togglePermission(key)}
                                  className="h-3.5 w-3.5"
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formPermissions.size} permiso(s) seleccionado(s)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingRole ? "Guardar cambios" : "Crear rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar el rol <strong>{deletingRole?.name}</strong>. Esta acción
              eliminará el rol de todos los usuarios que lo tengan asignado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
