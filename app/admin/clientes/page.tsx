"use client"

import { useState, useCallback } from "react"
import { clientsApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import type { Client } from "@/lib/types"
import { useCrud } from "@/hooks/use-crud"
import { clientSchema, formatZodErrors } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeleteConfirmation } from "@/components/delete-confirmation"
import { TaskShellHeader } from "@/components/task-shell"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Plus, Pencil, Trash2, Search, Mail, MapPin, User, Building2, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Color palette for client cards (assigned by name hash) ───────────────────
const CLIENT_PALETTES = [
  { gradient: "from-blue-500 to-indigo-500",    avatar: "from-blue-500 to-indigo-600" },
  { gradient: "from-violet-500 to-purple-500",  avatar: "from-violet-500 to-purple-600" },
  { gradient: "from-emerald-500 to-teal-500",   avatar: "from-emerald-500 to-teal-600" },
  { gradient: "from-rose-500 to-pink-500",      avatar: "from-rose-500 to-pink-600" },
  { gradient: "from-amber-500 to-orange-400",   avatar: "from-amber-500 to-orange-500" },
  { gradient: "from-cyan-500 to-sky-500",       avatar: "from-cyan-500 to-sky-600" },
  { gradient: "from-fuchsia-500 to-violet-500", avatar: "from-fuchsia-500 to-violet-600" },
  { gradient: "from-lime-500 to-emerald-500",   avatar: "from-lime-500 to-emerald-600" },
]

function getClientPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xfffff
  return CLIENT_PALETTES[hash % CLIENT_PALETTES.length]
}

function getClientInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

// ── ClientCard ────────────────────────────────────────────────────────────────
function ClientCard({
  client,
  isEditing,
  onEdit,
  onDelete,
}: {
  client: Client
  isEditing: boolean
  onEdit: (c: Client) => void
  onDelete: (id: string) => void
}) {
  const palette = getClientPalette(client.name)
  const initials = getClientInitials(client.name)

  return (
    <div className={cn(
      "group relative flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden",
      "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      isEditing && "ring-2 ring-primary/30 border-primary/30"
    )}>
      {/* Gradient accent strip */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", palette.gradient)} />

      <div className="flex flex-1 flex-col p-5 gap-4">
        {/* Header: avatar + name + rut */}
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
            palette.avatar
          )}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{client.name}</p>
            <p className="text-xs text-muted-foreground font-mono leading-tight mt-0.5">{client.rut}</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-foreground font-medium truncate">{client.contact}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{client.email}</span>
          </div>
          {client.address ? (
            <div className="flex items-start gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground leading-tight">{client.address}</span>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-1.5 border-t border-border/50 pt-3 mt-auto">
          <button
            onClick={() => onEdit(client)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={`Editar ${client.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(client.id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label={`Eliminar ${client.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClientesPage() {
  const fetchClients = useCallback(() => clientsApi.getAll(), [])
  const { data: apiClients, loading } = useApiData(fetchClients, [] as Client[])
  const crud = useCrud<Client>(apiClients, {
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

  async function handleSave() {
    const result = clientSchema.safeParse(form)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      toast.error("Corrige los errores del formulario")
      return
    }

    try {
      if (crud.editing) {
        await clientsApi.update(crud.editing.id, form)
        crud.update(crud.editing.id, form)
        toast.success("Cliente actualizado")
      } else {
        const newClient = await clientsApi.create(form as Omit<Client, "id">)
        crud.add(newClient)
        toast.success("Cliente creado")
      }
      crud.closeDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar cliente")
    }
  }

  async function handleDelete() {
    if (crud.deleteConfirmId) {
      try {
        await clientsApi.delete(crud.deleteConfirmId)
        crud.remove(crud.deleteConfirmId)
        toast.success("Cliente eliminado")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al eliminar cliente")
      }
    }
  }

  const clientToDelete = crud.items.find((c) => c.id === crud.deleteConfirmId)

  // Live preview — derived from form.name
  const previewPalette = getClientPalette(form.name || "?")
  const previewInitials = getClientInitials(form.name || "")

  return (
    <div className="flex flex-col gap-6 page-enter">
      {/* Page header */}
      <TaskShellHeader
        eyebrow="Gestión"
        title="Clientes"
        description={`${crud.items.length} cliente${crud.items.length === 1 ? "" : "s"} registrado${crud.items.length === 1 ? "" : "s"} en el sistema.`}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        }
      />

      {/* Sheet — controlled at page level */}
      <Sheet open={crud.dialogOpen} onOpenChange={(open) => { if (!open) crud.closeDialog() }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md overflow-hidden">

          {/* Live gradient strip */}
          <div className={cn("h-1.5 w-full shrink-0 bg-gradient-to-r transition-all duration-500", previewPalette.gradient)} />

          {/* Header with live avatar preview */}
          <SheetHeader className="px-6 pt-5 pb-4 border-b border-border/60">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-md transition-all duration-300",
                previewPalette.avatar
              )}>
                {previewInitials || <Building2 className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base">
                  {crud.editing ? "Editar cliente" : "Nuevo cliente"}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {crud.editing
                    ? `Modificando datos de ${crud.editing.name}.`
                    : "Completá los datos del nuevo cliente."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto">

            {/* Sección: Empresa */}
            <div className="px-6 pt-5 pb-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                Empresa
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-name" className="text-sm">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="client-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={cn("pl-10 h-11", errors.name && "border-destructive")}
                      placeholder="Ej: Constructora Los Álamos"
                    />
                  </div>
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-rut" className="text-sm">
                    RUT <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="client-rut"
                      value={form.rut}
                      onChange={(e) => setForm({ ...form, rut: e.target.value })}
                      placeholder="76.123.456-7"
                      className={cn("pl-10 h-11 font-mono", errors.rut && "border-destructive")}
                    />
                  </div>
                  {errors.rut && <p className="text-xs text-destructive">{errors.rut}</p>}
                </div>
              </div>
            </div>

            <div className="mx-6 h-px bg-border/40" />

            {/* Sección: Contacto */}
            <div className="px-6 pt-4 pb-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                Contacto
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-contact" className="text-sm">
                    Persona de contacto <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="client-contact"
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                      className={cn("pl-10 h-11", errors.contact && "border-destructive")}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  {errors.contact && <p className="text-xs text-destructive">{errors.contact}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-email" className="text-sm">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="client-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={cn("pl-10 h-11", errors.email && "border-destructive")}
                      placeholder="contacto@empresa.cl"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-address" className="text-sm">Dirección</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="client-address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="pl-10 h-11"
                      placeholder="Dirección de la empresa"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="border-t border-border/60 bg-muted/20 px-6 py-4 gap-2">
            <Button variant="outline" onClick={crud.closeDialog} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1 sm:flex-none sm:min-w-[140px]">
              {crud.editing ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, RUT o email..."
          value={crud.search}
          onChange={(e) => crud.setSearch(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      {/* Client cards grid */}
      {crud.filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {crud.search ? "Sin resultados" : "Sin clientes registrados"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {crud.search ? "Ajustá el filtro de búsqueda." : "Creá el primer cliente."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {crud.filteredItems.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              isEditing={crud.editing?.id === client.id}
              onEdit={openEdit}
              onDelete={crud.confirmDelete}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
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
