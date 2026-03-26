"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  StickyNote,
  AlertTriangle,
  ClipboardList,
  Cake,
  Users,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type NoteCategory = "trabajo_ayer" | "emergencia" | "anotacion" | "cumpleanos" | "general"

interface Note {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  category: NoteCategory
  isTeamNote: boolean
  projectId: string | null
  createdAt: string
  updatedAt: string
}

const CATEGORIES: { value: NoteCategory | "all"; label: string; icon: React.ElementType; color: string }[] = [
  { value: "all", label: "Todas", icon: StickyNote, color: "text-muted-foreground" },
  { value: "trabajo_ayer", label: "Trabajo ayer", icon: ClipboardList, color: "text-blue-600 dark:text-blue-400" },
  { value: "emergencia", label: "Emergencias", icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
  { value: "anotacion", label: "Anotaciones", icon: FileText, color: "text-violet-600 dark:text-violet-400" },
  { value: "cumpleanos", label: "Cumpleaños", icon: Cake, color: "text-pink-600 dark:text-pink-400" },
  { value: "general", label: "General", icon: StickyNote, color: "text-emerald-600 dark:text-emerald-400" },
]

const CATEGORY_STYLES: Record<NoteCategory, { border: string; bg: string; badge: string }> = {
  trabajo_ayer: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  emergencia: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50/50 dark:bg-red-950/20",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  anotacion: {
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  cumpleanos: {
    border: "border-pink-200 dark:border-pink-800",
    bg: "bg-pink-50/50 dark:bg-pink-950/20",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  },
  general: {
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
}

const EMPTY_FORM = { title: "", content: "", category: "general" as NoteCategory, isTeamNote: false }

export function NotasPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<NoteCategory | "all">("all")

  const [showCreate, setShowCreate] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const isAdminOrCoord = ["admin", "coordinador"].includes(user?.role ?? "")

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotes(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Error al cargar notas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingNote(null)
    setShowCreate(true)
  }

  function openEdit(note: Note) {
    setForm({
      title: note.title,
      content: note.content,
      category: note.category,
      isTeamNote: note.isTeamNote,
    })
    setEditingNote(note)
    setShowCreate(true)
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("El título es requerido"); return }
    setSaving(true)
    try {
      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const updated = await res.json()
        setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? { ...n, ...updated } : n)))
        toast.success("Nota actualizada")
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const created = await res.json()
        setNotes((prev) => [created, ...prev])
        toast.success("Nota creada")
      }
      setShowCreate(false)
    } catch {
      toast.error("Error al guardar nota")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/notes/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      toast.success("Nota eliminada")
    } catch {
      toast.error("Error al eliminar")
    } finally {
      setDeleteTarget(null)
    }
  }

  const visibleNotes = activeTab === "all" ? notes : notes.filter((n) => n.category === activeTab)
  const counts = notes.reduce((acc, n) => {
    acc[n.category] = (acc[n.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Notas personales y del equipo
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva nota
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = cat.value === "all" ? notes.length : (counts[cat.value] ?? 0)
          const isActive = activeTab === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => setActiveTab(cat.value as NoteCategory | "all")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <cat.icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : cat.color)} />
              {cat.label}
              {count > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notes grid */}
      {visibleNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No hay notas en esta categoría.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Crear primera nota
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleNotes.map((note) => {
            const style = CATEGORY_STYLES[note.category]
            const catInfo = CATEGORIES.find((c) => c.value === note.category)
            const isOwn = note.authorId === user?.id
            const canEdit = isOwn
            const canDelete = isOwn || user?.role === "admin"

            return (
              <Card
                key={note.id}
                className={cn(
                  "group relative flex flex-col gap-0 transition-shadow hover:shadow-md",
                  style.border,
                  style.bg
                )}
              >
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium shrink-0", style.badge)}>
                        {catInfo?.label ?? note.category}
                      </span>
                      {note.isTeamNote && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          Equipo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => openEdit(note)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(note)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                    {note.title}
                  </h3>
                  {note.content && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1">
                      {note.content}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 mt-auto border-t border-current/10">
                    <span className="text-[10px] text-muted-foreground">
                      {note.authorName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.updatedAt).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Editar nota" : "Nueva nota"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ej: Lo que hicimos ayer en proyecto X"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v as NoteCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className={cn("h-4 w-4", cat.color)} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Escribí los detalles de la nota..."
                rows={5}
              />
            </div>

            {isAdminOrCoord && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  id="team-note"
                  checked={form.isTeamNote}
                  onChange={(e) => setForm((p) => ({ ...p, isTeamNote: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="team-note" className="cursor-pointer flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Nota de equipo (visible para todos)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingNote ? "Guardar cambios" : "Crear nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar &quot;{deleteTarget?.title}&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
