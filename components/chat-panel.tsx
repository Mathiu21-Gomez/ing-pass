"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/image-upload"
import { Send, MessageSquare, Loader2, Camera } from "lucide-react"
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

// ── ChatPanel ──────────────────────────────────────────────────────────────

interface ChatPanelProps {
  /** For jornada chat: link messages to the active time entry */
  sessionId?: string
  /** For client messages: link to project */
  projectId?: string
  /** For task-level communication */
  taskId?: string
  /** Mark messages as client messages */
  isClientMessage?: boolean
  /** Whether to show image upload button */
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch ──

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (taskId) params.set("taskId", taskId)
      else if (sessionId) params.set("sessionId", sessionId)
      else if (projectId) params.set("projectId", projectId)

      const res = await fetch(`/api/messages?${params}`)
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
    // Only poll for session/project chats — task chats are async discussions
    if (taskId) return
    const interval = setInterval(fetchMessages, 15_000)
    return () => clearInterval(interval)
  }, [fetchMessages, taskId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
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
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {msg.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`data:${att.type};base64,${att.data}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg overflow-hidden border border-border w-24 h-24 hover:opacity-90 transition-opacity"
                          title={att.name}
                        >
                          <img
                            src={`data:${att.type};base64,${att.data}`}
                            alt={att.name}
                            className="w-full h-full object-cover"
                          />
                        </a>
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
  )
}
