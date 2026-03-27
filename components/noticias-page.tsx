"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  Paperclip,
  Star,
  X,
  FileText,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
} from "date-fns"
import { es } from "date-fns/locale"
import type { NoteAttachment } from "@/db/schema"

// ── Types ───────────────────────────────────────────────────────
type NoteCategory = "trabajo_ayer" | "emergencia" | "anotacion" | "cumpleanos" | "general"

interface Note {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  category: NoteCategory
  isTeamNote: boolean
  priority: string | null
  targetRoles: string[]
  attachments: NoteAttachment[]
  projectId: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ───────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  NoteCategory,
  { label: string; dot: string; badge: string; icon: string }
> = {
  trabajo_ayer: {
    label: "Trabajo Ayer",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    icon: "📋",
  },
  anotacion: {
    label: "Anotación",
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
    icon: "📝",
  },
  emergencia: {
    label: "Urgente",
    dot: "bg-rose-500",
    badge: "bg-red-600 text-white",
    icon: "🚨",
  },
  cumpleanos: {
    label: "Cumpleaños",
    dot: "bg-amber-500",
    badge: "bg-amber-500 text-white",
    icon: "🎂",
  },
  general: {
    label: "General",
    dot: "bg-slate-400",
    badge: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
    icon: "💬",
  },
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"]

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coordinador", label: "Coordinador" },
  { value: "trabajador", label: "Trabajador" },
  { value: "externo", label: "Externo" },
]

const MAX_FILE_SIZE = 5 * 1024 * 1024

// ── Helpers ─────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-cyan-500", "bg-pink-500",
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── CalendarNoteCard ─────────────────────────────────────────────
interface CalendarNoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

function CalendarNoteCard({ note, onEdit, onDelete }: CalendarNoteCardProps) {
  const cat = CATEGORY_CONFIG[note.category] ?? CATEGORY_CONFIG.general
  const [menuOpen, setMenuOpen] = useState(false)
  const time = format(new Date(note.createdAt), "HH:mm")

  return (
    <div
      className={cn(
        "group relative rounded-xl p-3 transition-all duration-150",
        "bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-border",
        "dark:bg-surface-kanban-card dark:border-0 dark:shadow-none dark:hover:bg-accent"
      )}
    >
      {/* Time + badge */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
          {time}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold rounded-md px-1.5 py-0.5 leading-none",
            cat.badge
          )}
        >
          {cat.icon} {cat.label}
        </span>
        {note.isTeamNote && (
          <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 ml-auto" />
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 mb-2">
        {note.title}
      </p>

      {/* Author + attachments + kebab */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white",
            avatarColor(note.authorName)
          )}
        >
          {getInitials(note.authorName)}
        </div>
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {note.authorName.split(" ")[0]}
        </span>
        {(note.attachments?.length ?? 0) > 0 && (
          <Paperclip className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
        )}

        {/* Kebab */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-foreground hover:bg-accent dark:hover:bg-accent transition-all"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 min-w-[110px] rounded-xl border border-border bg-card shadow-lg dark:border-border dark:bg-popover py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onEdit(note)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:text-muted-foreground dark:hover:bg-accent/50 dark:hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(note)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NoticiasPage ─────────────────────────────────────────────────
export function NoticiasPage() {
  const { user } = useAuth()
  const role = user?.role ?? "trabajador"
  const canCreateAll = role === "admin" || role === "coordinador"

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "general" as NoteCategory,
    isTeamNote: false,
    targetRoles: [] as string[],
    attachments: [] as NoteAttachment[],
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const from = format(weekStart, "yyyy-MM-dd")
      const to = format(addDays(weekStart, 4), "yyyy-MM-dd")
      const res = await fetch(`/api/notes?from=${from}&to=${to}`)
      if (!res.ok) throw new Error()
      const data: Note[] = await res.json()
      setAllNotes(data)
    } catch {
      toast.error("Error al cargar noticias")
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  function notesByDay(day: Date) {
    return allNotes
      .filter((n) => isSameDay(new Date(n.createdAt), day))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
  }

  function openCreate() {
    setEditingNote(null)
    setForm({
      title: "",
      content: "",
      category: "general",
      isTeamNote: false,
      targetRoles: [],
      attachments: [],
    })
    setDialogOpen(true)
  }

  function openEdit(note: Note) {
    setEditingNote(note)
    setForm({
      title: note.title,
      content: note.content,
      category: note.category,
      isTeamNote: note.isTeamNote,
      targetRoles: note.targetRoles ?? [],
      attachments: note.attachments ?? [],
    })
    setDialogOpen(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const tooBig = files.filter((f) => f.size > MAX_FILE_SIZE)
    if (tooBig.length > 0) {
      toast.error("Archivo demasiado grande (máx 5MB)")
      return
    }
    const newAttachments: NoteAttachment[] = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: await fileToBase64(file),
      }))
    )
    setForm((p) => ({ ...p, attachments: [...p.attachments, ...newAttachments] }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("El título es requerido")
      return
    }
    setSaving(true)
    try {
      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success("Noticia actualizada")
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success("Noticia publicada")
      }
      setDialogOpen(false)
      fetchNotes()
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/notes/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success("Eliminada")
      fetchNotes()
    } catch {
      toast.error("Error al eliminar")
    } finally {
      setDeleteTarget(null)
    }
  }

  // Week label: "16 - 20 de marzo 2026"
  const weekLabel = `${format(weekStart, "d")} - ${format(
    addDays(weekStart, 4),
    "d 'de' MMMM yyyy",
    { locale: es }
  )}`

  const isCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const totalWeekNotes = allNotes.length

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">

      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card dark:bg-surface-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Noticias
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {weekLabel} · {totalWeekNotes} publicación
              {totalWeekNotes !== 1 ? "es" : ""}
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-8 px-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva publicación
          </Button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent dark:text-muted-foreground dark:hover:bg-accent transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground dark:text-muted-foreground min-w-[220px] text-center capitalize">
            {weekLabel}
          </span>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent dark:text-muted-foreground dark:hover:bg-accent transition-colors"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }
              className="ml-2 rounded-lg px-3 py-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 overflow-x-auto p-4 dark:bg-surface-kanban">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {totalWeekNotes === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                No hay publicaciones para esta semana todavia. Cuando el equipo cargue novedades, las vas a ver aca.
              </div>
            )}
            <div className="grid grid-cols-5 gap-3 min-w-[680px] h-full">
              {weekDays.map((day, i) => {
                const dayNotes = notesByDay(day)
                const today = isToday(day)

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col rounded-2xl border overflow-hidden",
                      today
                        ? "border-primary/40 dark:border-primary/25"
                        : "border-slate-200/80 dark:border-0",
                      "bg-slate-100/70 dark:bg-surface-kanban-column"
                    )}
                  >
                    {/* Day header */}
                    <div
                      className={cn(
                        "flex items-start justify-between px-4 pt-4 pb-3 flex-shrink-0",
                        today
                          ? "bg-primary/8 dark:bg-primary/10"
                          : "bg-slate-50/80 dark:bg-accent"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={cn(
                              "text-[11px] font-bold uppercase tracking-widest",
                              today
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          >
                            {DAY_LABELS[i]}
                          </span>
                          {today && (
                            <span className="rounded-full bg-primary text-white text-[9px] px-1.5 py-0.5 font-bold leading-none">
                              HOY
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-2xl font-bold leading-none",
                            today
                              ? "text-primary"
                              : "text-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 capitalize mt-0.5">
                          {format(day, "MMMM", { locale: es })}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 mt-0.5">
                        {dayNotes.length > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 dark:bg-accent text-[10px] font-bold text-slate-600 dark:text-muted-foreground px-1">
                            {dayNotes.length}
                          </span>
                        )}
                        <button
                          onClick={openCreate}
                          className={cn(
                            "rounded-lg p-1 transition-colors",
                            today
                              ? "text-primary hover:bg-primary/15"
                              : "text-slate-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-accent"
                          )}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Notes list */}
                    <div className="flex flex-col gap-2 p-2.5 flex-1 overflow-y-auto">
                      {dayNotes.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-[11px] text-slate-400 dark:text-slate-700">
                            Sin publicaciones
                          </p>
                        </div>
                      ) : (
                        dayNotes.map((note) => (
                          <CalendarNoteCard
                            key={note.id}
                            note={note}
                            onEdit={openEdit}
                            onDelete={setDeleteTarget}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Editar noticia" : "Nueva publicación"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Título de la noticia"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Contenido</Label>
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((p) => ({ ...p, content: e.target.value }))
                }
                placeholder="Escribí el contenido..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, category: v as NoteCategory }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(CATEGORY_CONFIG) as [
                      NoteCategory,
                      { label: string; icon: string }
                    ][]
                  )
                    .filter(
                      ([id]) =>
                        canCreateAll ||
                        id === "anotacion" ||
                        id === "trabajo_ayer"
                    )
                    .map(([id, cfg]) => (
                      <SelectItem key={id} value={id}>
                        {cfg.icon} {cfg.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Visible para</Label>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((r) => (
                  <div key={r.value} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`role-${r.value}`}
                      checked={form.targetRoles.includes(r.value)}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          targetRoles: checked
                            ? [...p.targetRoles, r.value]
                            : p.targetRoles.filter((x) => x !== r.value),
                        }))
                      }
                    />
                    <Label
                      htmlFor={`role-${r.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {r.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {canCreateAll && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isTeamNote"
                  checked={form.isTeamNote}
                  onCheckedChange={(c) =>
                    setForm((p) => ({ ...p, isTeamNote: !!c }))
                  }
                />
                <Label
                  htmlFor="isTeamNote"
                  className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                >
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  Noticia destacada (equipo)
                </Label>
              </div>
            )}

            {/* File upload */}
            <div className="space-y-2">
              <Label className="text-xs">Adjuntos</Label>
              <div
                className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Hacé clic para adjuntar · imágenes, PDF, Excel (máx 5MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {form.attachments.length > 0 && (
                <div className="space-y-1.5">
                  {form.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      {att.type.startsWith("image/") ? (
                        <img
                          src={att.data}
                          alt={att.name}
                          className="h-8 w-8 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <FileText className="h-8 w-8 p-1.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(att.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            attachments: p.attachments.filter(
                              (a) => a.id !== att.id
                            ),
                          }))
                        }
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingNote ? "Guardar cambios" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar noticia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que querés eliminar{" "}
              <span className="font-semibold text-foreground">
                &quot;{deleteTarget?.title}&quot;
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
