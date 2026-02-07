"use client"

import { useState } from "react"
import { mockClients } from "@/lib/mock-data"
import type { Client } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { clientSchema, formatZodErrors } from "@/lib/schemas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DeleteConfirmation } from "@/components/delete-confirmation"
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react"
import { toast } from "sonner"

export default function ClientesPage() {
  const crud = useCrud<Client>(mockClients, {
    searchFields: ["name", "rut", "email"],
  })
  const [form, setForm] = useState({ name: "", rut: "", contact: "", email: "", address: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function openNew() {
    setForm({ name: "", rut: "", contact: "", email: "", address: "" })
    setErrors({})
    crud.openCreate()
  }

  function openEdit(client: Client) {
    setForm({
      name: client.name,
      rut: client.rut,
      contact: client.contact,
      email: client.email,
      address: client.address,
    })
    setErrors({})
    crud.openEdit(client)
  }

  function handleSave() {
    const result = clientSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    if (crud.editing) {
      crud.update(crud.editing.id, form)
      toast.success("Cliente actualizado")
    } else {
      const newClient: Client = { id: `c${Date.now()}`, ...form }
      crud.add(newClient)
      toast.success("Cliente creado")
    }
    crud.closeDialog()
  }

  function handleDelete() {
    if (crud.deleteConfirmId) {
      crud.remove(crud.deleteConfirmId)
      toast.success("Cliente eliminado")
    }
  }

  const clientToDelete = crud.items.find((c) => c.id === crud.deleteConfirmId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">{crud.items.length} clientes registrados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, RUT o email..."
          value={crud.search}
          onChange={(e) => crud.setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop: Grid of Cards | Mobile: Full width cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {crud.filteredItems.map((client) => (
          <Card key={client.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{client.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{client.rut}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(client)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => crud.confirmDelete(client.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contacto</span>
                <span className="font-medium text-foreground">{client.contact}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground text-xs">{client.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dirección</span>
                <span className="font-medium text-foreground text-xs text-right max-w-[180px] truncate">
                  {client.address}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={crud.dialogOpen} onOpenChange={crud.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{crud.editing ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre de empresa *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>RUT *</Label>
                <Input
                  value={form.rut}
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  placeholder="76.123.456-7"
                  className={errors.rut ? "border-destructive" : ""}
                />
                {errors.rut && <p className="text-xs text-destructive">{errors.rut}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Contacto *</Label>
                <Input
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className={errors.contact ? "border-destructive" : ""}
                />
                {errors.contact && <p className="text-xs text-destructive">{errors.contact}</p>}
              </div>
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
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={crud.closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {crud.editing ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmation
        open={!!crud.deleteConfirmId}
        onOpenChange={(open) => !open && crud.cancelDelete()}
        onConfirm={handleDelete}
        title="¿Eliminar cliente?"
        description="Se eliminarán también los proyectos asociados a este cliente."
        itemName={clientToDelete?.name}
      />
    </div>
  )
}
