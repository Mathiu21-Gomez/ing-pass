"use client"

import { useState, useEffect } from "react"
import { Link2, Plus, ExternalLink, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { SharedLink } from "@/lib/types"

interface Props {
  /** "/api/tasks/{id}" o "/api/projects/{id}" */
  apiBase: string
  canAdd?: boolean
  className?: string
}

export function SharedLinksPanel({ apiBase, canAdd = true, className }: Props) {
  const [links, setLinks] = useState<SharedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${apiBase}/links`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }, [apiBase])

  async function handleAdd() {
    const trimmedUrl = url.trim()
    const trimmedLabel = label.trim()
    if (!trimmedLabel || !trimmedUrl) {
      toast.error("Completá el nombre y la URL")
      return
    }
    const hasProtocol = trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
    const finalUrl = hasProtocol ? trimmedUrl : `https://${trimmedUrl}`

    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmedLabel, url: finalUrl }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ?? "URL inválida — revisá el formato")
        return
      }
      const newLink: SharedLink = await res.json()
      setLinks((prev) => [...prev, newLink])
      setLabel("")
      setUrl("")
      setAdding(false)
      toast.success("Enlace agregado")
    } catch {
      toast.error("Error al agregar enlace")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(linkId: string) {
    setDeletingId(linkId)
    try {
      await fetch(`${apiBase}/links/${linkId}`, { method: "DELETE" })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch {
      toast.error("Error al eliminar enlace")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
          <Link2 className="h-3 w-3" />
          Documentos compartidos
        </p>
        {canAdd && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Agregar
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Cargando...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && links.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground/40 italic px-0.5">
          Sin documentos compartidos aún.
        </p>
      )}

      {/* List */}
      {!loading && links.length > 0 && (
        <div className="space-y-1.5 stagger-children">
          {links.map((link) => (
            <div
              key={link.id}
              className="group flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary hover:underline underline-offset-2 truncate"
                title={link.url}
              >
                {link.label}
              </a>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                title="Abrir enlace"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => handleDelete(link.id)}
                disabled={deletingId === link.id}
                className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Eliminar enlace"
              >
                {deletingId === link.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 animate-fade-in">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre (ej: Plano estructural)"
            className="h-8 text-xs"
            autoFocus
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (https://drive.google.com/...)"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="flex gap-2 justify-end pt-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setAdding(false); setLabel(""); setUrl("") }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={saving || !label.trim() || !url.trim()}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
