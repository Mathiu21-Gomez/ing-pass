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
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanOverlay,
} from "@/components/reui/kanban"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Paperclip,
  Star,
  X,
  FileText,
  Calendar,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import type { NoteAttachment } from "@/db/schema"

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "trabajo_ayer", label: "Trabajo Ayer", icon: "📋",
    badge: "bg-blue-500/20 text-blue-400",
    dot: "bg-blue-400",
    accent: "text-blue-400" },
  { id: "anotacion", label: "Anotación", icon: "📝",
    badge: "bg-violet-500/20 text-violet-400",
    dot: "bg-violet-400",
    accent: "text-violet-400" },
  { id: "emergencia", label: "Emergencia", icon: "🚨",
    badge: "bg-rose-500/20 text-rose-400",
    dot: "bg-rose-400",
    accent: "text-rose-400" },
  { id: "cumpleanos", label: "Cumpleaños", icon: "🎂",
    badge: "bg-amber-500/20 text-amber-400",
    dot: "bg-amber-400",
    accent: "text-amber-400" },
  { id: "general", label: "General", icon: "💬",
    badge: "bg-slate-500/20 text-muted-foreground",
    dot: "bg-slate-400",
    accent: "text-muted-foreground" },
] as const

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coordinador", label: "Coordinador" },
  { value: "trabajador", label: "Trabajador" },
  { value: "externo", label: "Externo" },
]

const MAX_FILE_SIZE = 5 * 1024 * 1024

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
  } catch { return "" }
}

function shortDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "d MMM", { locale: es })
  } catch { return "" }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

// Avatar color based on name
const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-cyan-500", "bg-pink-500",
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Priority badge config per category ────────────────────────────────────

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  emergencia:   { label: "Urgente",     className: "bg-red-600 text-white" },
  trabajo_ayer: { label: "Trabajo",     className: "bg-slate-600 text-slate-100" },
  anotacion:    { label: "Anotación",   className: "bg-slate-600 text-slate-100" },
  cumpleanos:   { label: "Cumpleaños",  className: "bg-amber-600 text-white" },
  general:      { label: "General",     className: "bg-slate-700 text-slate-200" },
}

// ── NoteCard ───────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note
  canDrag: boolean
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

function NoteCard({ note, canDrag, onEdit, onDelete }: NoteCardProps) {
  const badge = CATEGORY_BADGE[note.category] ?? CATEGORY_BADGE.general
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-surface-kanban-card p-4 shadow-md",
        "transition-all duration-150 hover:bg-accent",
        canDrag && "cursor-grab active:cursor-grabbing select-none"
      )}
    >
      {/* Row 1: title + badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[14px] font-bold text-foreground leading-snug truncate flex-1">
          {note.title}
          {note.isTeamNote && <Star className="inline h-3 w-3 text-amber-400 fill-amber-400 ml-1 mb-0.5" />}
        </p>
        <span className={cn(
          "flex-shrink-0 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold",
          badge.className
        )}>
          {badge.label}
        </span>
      </div>

      {/* Image preview */}
      {note.attachments?.find(a => a.type.startsWith("image/")) && (
        <img
          src={note.attachments.find(a => a.type.startsWith("image/"))!.data}
          alt="preview"
          className="w-full h-20 object-cover rounded-xl mb-3 opacity-75"
        />
      )}

      {/* Row 2: avatar + name + date */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
            avatarColor(note.authorName)
          )}
        >
          {getInitials(note.authorName)}
        </div>
        <span className="text-[12px] text-muted-foreground truncate flex-1">
          {note.authorName.split(" ")[0]}...
        </span>
        <span className="text-[11px] text-muted-foreground flex-shrink-0">
          {shortDate(note.createdAt)}
        </span>

        {/* Kebab */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 min-w-[110px] rounded-xl border border-border bg-popover shadow-2xl py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { setMenuOpen(false); onEdit(note) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(note) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attachments indicator */}
      {(note.attachments?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 mt-2 text-slate-600 text-[10px]">
          <Paperclip className="h-3 w-3" />
          <span>{note.attachments.length} adjunto{note.attachments.length > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  )
}

// ── ComunicacionPage ───────────────────────────────────────────────────────

export function ComunicacionPage() {
  const { user } = useAuth()
  const role = user?.role ?? "trabajador"
  const canDrag = role === "admin" || role === "coordinador"
  const canCreateAll = role === "admin" || role === "coordinador"

  const [columns, setColumns] = useState<Record<string, Note[]>>(
    Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
  )
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")

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

  // ── Fetch ──

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes")
      if (!res.ok) throw new Error()
      const data: Note[] = await res.json()

      const grouped: Record<string, Note[]> = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
      for (const note of data) {
        const col = note.category in grouped ? note.category : "general"
        grouped[col].push(note)
      }
      setColumns(grouped)
    } catch {
      toast.error("Error al cargar comunicaciones")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  // ── DnD ──

  function getItemValue(note: Note) { return note.id }

  async function handleColumnChange(newColumns: Record<string, Note[]>) {
    for (const [colId, items] of Object.entries(newColumns)) {
      for (const note of items) {
        const oldCol = Object.entries(columns).find(([, notes]) =>
          notes.some((n) => n.id === note.id)
        )?.[0]
        if (oldCol && oldCol !== colId) {
          setColumns(newColumns)
          try {
            const res = await fetch(`/api/notes/${note.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category: colId }),
            })
            if (!res.ok) { toast.error("Error al mover"); fetchNotes() }
          } catch { toast.error("Error al mover"); fetchNotes() }
          return
        }
      }
    }
    setColumns(newColumns)
  }

  // ── Dialog ──

  function openCreate(defaultCategory?: NoteCategory) {
    setEditingNote(null)
    setForm({ title: "", content: "", category: defaultCategory ?? "general", isTeamNote: false, targetRoles: [], attachments: [] })
    setDialogOpen(true)
  }

  function openEdit(note: Note) {
    setEditingNote(note)
    setForm({ title: note.title, content: note.content, category: note.category, isTeamNote: note.isTeamNote, targetRoles: note.targetRoles ?? [], attachments: note.attachments ?? [] })
    setDialogOpen(true)
  }

  // ── Files ──

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const tooBig = files.filter((f) => f.size > MAX_FILE_SIZE)
    if (tooBig.length > 0) { toast.error(`Archivo demasiado grande (máx 5MB)`); return }

    const newAttachments: NoteAttachment[] = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(), name: file.name, type: file.type,
        size: file.size, data: await fileToBase64(file),
      }))
    )
    setForm((p) => ({ ...p, attachments: [...p.attachments, ...newAttachments] }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Save / Delete ──

  async function handleSave() {
    if (!form.title.trim()) { toast.error("El título es requerido"); return }
    setSaving(true)
    try {
      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success("Comunicación actualizada")
      } else {
        const res = await fetch("/api/notes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success("Comunicación creada")
      }
      setDialogOpen(false)
      fetchNotes()
    } catch { toast.error("Error al guardar") }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/notes/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Eliminada")
      fetchNotes()
    } catch { toast.error("Error al eliminar") }
    finally { setDeleteTarget(null) }
  }

  // ── Tab counts ──

  const allNotes = Object.values(columns).flat()
  const totalCount = allNotes.length
  const tabCounts: Record<string, number> = { all: totalCount }
  for (const col of COLUMNS) tabCounts[col.id] = columns[col.id]?.length ?? 0

  // Filtered columns for active tab
  const visibleColumns = activeTab === "all"
    ? COLUMNS
    : COLUMNS.filter((c) => c.id === activeTab)

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">

      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-surface-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Comunicación</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tablero del equipo · {totalCount} mensajes</p>
          </div>
          <Button
            onClick={() => openCreate()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-8 px-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva comunicación
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* All tab */}
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
              activeTab === "all"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Todo
            <span className={cn(
              "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
              activeTab === "all" ? "bg-blue-500 text-white" : "bg-accent text-muted-foreground"
            )}>
              {totalCount}
            </span>
          </button>

          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                activeTab === col.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span>{col.icon}</span>
              {col.label}
              <span className={cn(
                "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                activeTab === col.id ? cn(col.badge) : "bg-accent text-muted-foreground"
              )}>
                {tabCounts[col.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 overflow-x-auto p-6 bg-surface-kanban">
        <Kanban value={columns} onValueChange={handleColumnChange} getItemValue={getItemValue}>
          <KanbanBoard className="gap-4 items-start">
            {visibleColumns.map((col) => {
              const notes = columns[col.id] ?? []
              return (
                <KanbanColumn
                  key={col.id}
                  value={col.id}
                  className="min-w-[260px] w-[260px] rounded-3xl border-0 bg-surface-kanban-column"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[15px] font-bold text-foreground">{col.label}</span>
                      <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-lg bg-accent px-2 text-[12px] font-bold text-muted-foreground">
                        {notes.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {(canCreateAll || col.id === "anotacion" || col.id === "trabajo_ayer") && (
                        <button
                          onClick={() => openCreate(col.id as NoteCategory)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  <KanbanColumnContent value={col.id} className="gap-2 px-3 pb-4 pt-0">
                    {notes.map((note) => (
                      <KanbanItem key={note.id} value={note.id} draggable={canDrag}>
                        <NoteCard note={note} canDrag={canDrag} onEdit={openEdit} onDelete={setDeleteTarget} />
                      </KanbanItem>
                    ))}
                    {notes.length === 0 && (
                      <div className="py-6 text-center">
                        <p className="text-xs text-slate-700">Sin comunicaciones</p>
                      </div>
                    )}
                  </KanbanColumnContent>
                </KanbanColumn>
              )
            })}
          </KanbanBoard>
          <KanbanOverlay />
        </Kanban>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-border bg-surface-3 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingNote ? "Editar comunicación" : "Nueva comunicación"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Título de la comunicación"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Contenido</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Escribí el contenido..."
                rows={4}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Columna</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v as NoteCategory }))}
              >
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-border">
                  {COLUMNS.filter((c) => canCreateAll || c.id === "anotacion" || c.id === "trabajo_ayer").map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-foreground hover:bg-accent focus:bg-accent">
                      {c.icon} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Visible para</Label>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((r) => (
                  <div key={r.value} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`role-${r.value}`}
                      checked={form.targetRoles.includes(r.value)}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          targetRoles: checked ? [...p.targetRoles, r.value] : p.targetRoles.filter((x) => x !== r.value),
                        }))
                      }
                    />
                    <Label htmlFor={`role-${r.value}`} className="text-sm text-muted-foreground font-normal cursor-pointer">
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
                  onCheckedChange={(c) => setForm((p) => ({ ...p, isTeamNote: !!c }))}
                />
                <Label htmlFor="isTeamNote" className="text-sm text-muted-foreground font-normal cursor-pointer flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  Comunicación destacada (equipo)
                </Label>
              </div>
            )}

            {/* File upload */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Adjuntos</Label>
              <div
                className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Hacé clic para adjuntar · imágenes, PDF, Excel (máx 5MB)</p>
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
                    <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                      {att.type.startsWith("image/") ? (
                        <img src={att.data} alt={att.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                      ) : (
                        <FileText className="h-8 w-8 p-1.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={() => setForm((p) => ({ ...p, attachments: p.attachments.filter((a) => a.id !== att.id) }))}
                        className="rounded p-0.5 text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0"
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}
              className="border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingNote ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-border bg-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Eliminar comunicación</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro que querés eliminar{" "}
              <span className="font-semibold text-foreground">&quot;{deleteTarget?.title}&quot;</span>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted/50">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
