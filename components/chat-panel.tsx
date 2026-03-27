"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/image-upload"
import {
  Send, MessageSquare, Loader2, Camera,
  X, Download, ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import type { CommentAttachment } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string
  fromUserId: string
  fromUserName: string
  fromUserRole: string
  content: string
  sessionId: string | null
  projectId: string | null
  taskId: string | null
  isClientMessage: boolean
  isPreStart: boolean
  attachments: CommentAttachment[]
  createdAt: string
}

interface LightboxState {
  attachments: CommentAttachment[]
  index: number
}

const CHAT_REFRESH_INTERVAL_MS = 5_000

// ── Helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-cyan-500", "bg-pink-500",
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

function downloadAttachment(att: CommentAttachment) {
  const link = document.createElement("a")
  link.href = `data:${att.type};base64,${att.data}`
  link.download = att.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ── Lightbox ───────────────────────────────────────────────────────────────

function Lightbox({
  state,
  onClose,
  onChange,
}: {
  state: LightboxState
  onClose: () => void
  onChange: (index: number) => void
}) {
  const att = state.attachments[state.index]
  const hasMultiple = state.attachments.length > 1

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && state.index > 0) onChange(state.index - 1)
      if (e.key === "ArrowRight" && state.index < state.attachments.length - 1) onChange(state.index + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, onClose, onChange])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white/80 truncate max-w-[60%]">{att.name}</p>
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <span className="text-xs text-white/60">
              {state.index + 1} / {state.attachments.length}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
            onClick={() => downloadAttachment(att)}
            title="Descargar"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
            onClick={onClose}
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image */}
      <div
        className="relative flex items-center justify-center w-full h-full px-16 py-16"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={`data:${att.type};base64,${att.data}`}
          alt={att.name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          style={{ maxHeight: "calc(100vh - 8rem)" }}
        />
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors",
              state.index === 0 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => { e.stopPropagation(); onChange(state.index - 1) }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors",
              state.index === state.attachments.length - 1 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => { e.stopPropagation(); onChange(state.index + 1) }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip (multi-image) */}
      {hasMultiple && (
        <div
          className="absolute bottom-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          {state.attachments.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onChange(i)}
              className={cn(
                "relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                i === state.index ? "border-white" : "border-transparent opacity-60 hover:opacity-90"
              )}
            >
              <img
                src={`data:${a.type};base64,${a.data}`}
                alt={a.name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ChatPanel ──────────────────────────────────────────────────────────────

interface ChatPanelProps {
  sessionId?: string
  projectId?: string
  taskId?: string
  isClientMessage?: boolean
  allowImages?: boolean
  title?: string
  placeholder?: string
  className?: string
}

export function ChatPanel({
  sessionId,
  projectId,
  taskId,
  isClientMessage = false,
  allowImages = true,
  title = "Mensajes",
  placeholder = "Escribí un mensaje...",
  className,
}: ChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<CommentAttachment[]>([])
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldScrollOnNextMessageRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch ──

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (taskId) params.set("taskId", taskId)
      else if (sessionId) params.set("sessionId", sessionId)
      else if (projectId) params.set("projectId", projectId)

      const res = await fetch(`/api/messages?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data: Message[] = await res.json()
      setMessages(data)
    } catch {
      // silent — non-critical
    } finally {
      setLoading(false)
    }
  }, [taskId, sessionId, projectId])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, CHAT_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (!shouldScrollOnNextMessageRef.current) return
    shouldScrollOnNextMessageRef.current = false
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  // ── Send ──

  async function handleSend() {
    const hasText = text.trim().length > 0
    const hasImages = pendingAttachments.length > 0
    if ((!hasText && !hasImages) || !user) return

    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim() || "(imagen adjunta)",
          sessionId: sessionId ?? null,
          projectId: projectId ?? null,
          taskId: taskId ?? null,
          isClientMessage,
          attachments: pendingAttachments,
        }),
      })
      if (!res.ok) throw new Error()
      const created: Message = await res.json()
      shouldScrollOnNextMessageRef.current = true
      setMessages((prev) => [...prev, created])
      setText("")
      setPendingAttachments([])
      setShowImageUpload(false)
      textareaRef.current?.focus()
    } catch {
      toast.error("Error al enviar mensaje")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (text.trim().length > 0 || pendingAttachments.length > 0) && !sending

  // ── Render ──

  return (
    <>
      {lightbox && (
        <Lightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((prev) => prev ? { ...prev, index } : null)}
        />
      )}

      <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {messages.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{messages.length} mensajes</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Sin mensajes aún. ¡Escribí el primero!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.fromUserId === user?.id
              const atts = msg.attachments ?? []
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", isOwn && "flex-row-reverse")}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      msg.isPreStart ? "bg-amber-500" : avatarColor(msg.fromUserName)
                    )}
                  >
                    {msg.isPreStart ? "📋" : getInitials(msg.fromUserName)}
                  </div>

                  {/* Bubble */}
                  <div className={cn("flex flex-col gap-1 max-w-[75%]", isOwn && "items-end")}>
                    {msg.isPreStart && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 px-1">
                        Nota pre-inicio
                      </span>
                    )}
                    <div className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.isPreStart
                        ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20 rounded-tl-sm"
                        : isOwn
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                    )}>
                      {msg.content}
                    </div>

                    {/* Attached images */}
                    {atts.length > 0 && (
                      <div className={cn("flex flex-wrap gap-1.5 mt-0.5", isOwn && "justify-end")}>
                        {atts.map((att, attIdx) => (
                          <div key={att.id} className="group relative">
                            <button
                              type="button"
                              onClick={() => setLightbox({ attachments: atts, index: attIdx })}
                              className="block rounded-xl overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/50"
                              title="Ver imagen"
                            >
                              <img
                                src={`data:${att.type};base64,${att.data}`}
                                alt={att.name}
                                className="w-28 h-28 object-cover"
                              />
                            </button>
                            {/* Download overlay on hover */}
                            <button
                              type="button"
                              onClick={() => downloadAttachment(att)}
                              className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                              title="Descargar"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 px-1">
                      {!isOwn && !msg.isPreStart && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {msg.fromUserName.split(" ")[0]}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">
                        {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Image upload area — shown when toggled */}
        {allowImages && showImageUpload && (
          <div className="border-t border-border px-3 pt-2 pb-1">
            <ImageUpload
              onImagesChange={setPendingAttachments}
              maxImages={3}
            />
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2 items-end">
          {allowImages && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-[38px] w-[38px] flex-shrink-0 text-muted-foreground hover:text-foreground",
                showImageUpload && "text-primary bg-primary/10"
              )}
              onClick={() => {
                setShowImageUpload((v) => !v)
                if (showImageUpload) setPendingAttachments([])
              }}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none min-h-[38px] max-h-[100px] text-sm"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className="h-[38px] w-[38px] flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
