"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CalendarDays,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskShellHeader, TaskShellPanel } from "@/components/task-shell"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────

interface AppEvent {
  id: string
  title: string
  content: string
  type: "evento" | "comunicado"
  eventDate: string | null
  createdBy: string
  targetRoles: string[]
  pinned: boolean
  createdAt: string
}

type EventForm = {
  title: string
  content: string
  type: string
  eventDate: string
  targetRoles: string[]
  pinned: boolean
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coordinador", label: "Coordinador" },
  { value: "trabajador", label: "Trabajador" },
  { value: "externo", label: "Externo" },
]

const EMPTY_FORM: EventForm = {
  title: "",
  content: "",
  type: "comunicado",
  eventDate: "",
  targetRoles: [],
  pinned: false,
}

// ── Main component ────────────────────────────────────────────────────

interface ComunicadosPageProps {
  canCreate?: boolean
}

export function ComunicadosPage({ canCreate = true }: ComunicadosPageProps) {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null)
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/home")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch {
      toast.error("Error al cargar comunicados")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function openCreate() {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(ev: AppEvent) {
    setEditingEvent(ev)
    setForm({
      title: ev.title,
      content: ev.content ?? "",
      type: ev.type,
      eventDate: ev.eventDate ?? "",
      targetRoles: ev.targetRoles ?? [],
      pinned: ev.pinned,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingEvent(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("El título es requerido")
      return
    }
    setSaving(true)
    try {
      if (editingEvent) {
        const res = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const updated = await res.json()
        setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? updated : e)))
        toast.success("Comunicado actualizado")
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const newEvent = await res.json()
        setEvents((prev) => [newEvent, ...prev])
        toast.success("Comunicado creado")
      }
      closeForm()
    } catch {
      toast.error("Error al guardar el comunicado")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setEvents((prev) => prev.filter((e) => e.id !== id))
      toast.success("Comunicado eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  async function handleTogglePin(ev: AppEvent) {
    try {
      const res = await fetch(`/api/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !ev.pinned }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)))
    } catch {
      toast.error("Error al actualizar")
    }
  }

  function toggleRole(role: string) {
    setForm((prev) => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter((r) => r !== role)
        : [...prev.targetRoles, role],
    }))
  }

  const pinnedEvents = events.filter((e) => e.pinned)
  const unpinnedEvents = events.filter((e) => !e.pinned)
  const sortedEvents = [...pinnedEvents, ...unpinnedEvents]

  return (
    <div className="page-enter space-y-5">
      <TaskShellHeader
        eyebrow="Comunicación"
        title="Comunicados"
        description={`${events.length} comunicado${events.length === 1 ? "" : "s"} publicado${events.length === 1 ? "" : "s"}.`}
        actions={
          canCreate ? (
            <Button
              size="sm"
              className="gap-2 rounded-xl"
              onClick={showForm && !editingEvent ? closeForm : openCreate}
            >
              {showForm && !editingEvent ? (
                <><X className="h-3.5 w-3.5" />Cancelar</>
              ) : (
                <><Plus className="h-3.5 w-3.5" />Nuevo comunicado</>
              )}
            </Button>
          ) : null
        }
      />

      {/* Inline form panel */}
      {showForm && canCreate ? (
        <TaskShellPanel
          title={editingEvent ? "Editar comunicado" : "Nuevo comunicado"}
          description={editingEvent ? `Modificando "${editingEvent.title}".` : "Completá los campos para publicar un nuevo comunicado o evento."}
          actions={
            editingEvent ? (
              <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2 text-xs" onClick={closeForm}>
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título del comunicado o evento"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Contenido</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Descripción o detalle del comunicado..."
                  rows={3}
                  className="rounded-xl text-sm resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9 rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comunicado">Comunicado</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Fecha del evento</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Dirigido a</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      form.targetRoles.includes(opt.value)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Checkbox
                      checked={form.targetRoles.includes(opt.value)}
                      onCheckedChange={() => toggleRole(opt.value)}
                      className="h-3.5 w-3.5"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.pinned}
                  onCheckedChange={(checked) => setForm({ ...form, pinned: Boolean(checked) })}
                />
                Fijar este comunicado (aparece primero)
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={closeForm}>
                Cancelar
              </Button>
              <Button size="sm" className="rounded-xl" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {editingEvent ? "Guardar cambios" : "Publicar"}
              </Button>
            </div>
          </div>
        </TaskShellPanel>
      ) : null}

      {/* Events list */}
      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">Sin comunicados</p>
          <p className="mt-1 text-xs">Todavía no hay comunicados publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((ev) => {
            const isEditing = editingEvent?.id === ev.id && showForm

            return (
              <div
                key={ev.id}
                className={cn(
                  "rounded-2xl border bg-card/95 px-5 py-4 shadow-sm transition-all",
                  ev.pinned ? "border-primary/25 bg-primary/[0.02]" : "border-border/70",
                  isEditing && "ring-2 ring-primary/25 border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {ev.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                      <span className="text-sm font-semibold text-foreground">{ev.title}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full text-[10px]",
                          ev.type === "evento"
                            ? "border-blue-200/70 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            : "border-primary/20 bg-primary/5 text-primary"
                        )}
                      >
                        {ev.type === "evento" ? "Evento" : "Comunicado"}
                      </Badge>
                      {ev.pinned ? (
                        <Badge variant="outline" className="shrink-0 rounded-full text-[10px] border-amber-200/70 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          Fijado
                        </Badge>
                      ) : null}
                    </div>

                    {ev.content ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">{ev.content}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-4 pt-0.5 text-xs text-muted-foreground">
                      {ev.eventDate ? (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(ev.eventDate).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
                        </span>
                      ) : null}
                      {ev.targetRoles && ev.targetRoles.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ev.targetRoles.join(", ")}
                        </span>
                      ) : null}
                      <span className="ml-auto">
                        {new Date(ev.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {canCreate ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleTogglePin(ev)}
                        className={cn(
                          "rounded-lg p-1.5 transition-colors",
                          ev.pinned
                            ? "text-primary hover:bg-primary/10"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        title={ev.pinned ? "Desfijar" : "Fijar"}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(ev)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
