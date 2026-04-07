"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import { ImageUpload, type ImageUploadItem } from "@/components/image-upload"
import { Textarea } from "@/components/ui/textarea"
import { extractTaskChatClipboardFiles } from "@/lib/task-chat-clipboard"
import { useAuth } from "@/lib/contexts/auth-context"
import type { CommentAttachment } from "@/lib/types"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileText,
  Loader2,
  MessageSquare,
  Minimize,
  Paperclip,
  Send,
  X,
} from "lucide-react"
import { toast } from "sonner"

interface LegacyMessage {
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

interface TaskChatApiMessage {
  id: string
  text: string | null
  createdAt: string
  author: {
    id: string | null
    name: string | null
    role: string | null
  }
  attachments: {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
  }[]
}

interface TaskChatListResponse {
  participant: {
    lastReadMessageId: string | null
  }
  messages: TaskChatApiMessage[]
  nextCursor: string | null
  unreadCount: number
}

interface ChatAttachment extends ImageUploadItem {
  attachmentId?: string
}

interface ChatMessage {
  id: string
  fromUserId: string | null
  fromUserName: string
  fromUserRole: string
  content: string
  attachments: ChatAttachment[]
  createdAt: string
  isPreStart: boolean
}

interface LightboxState {
  attachments: ChatAttachment[]
  index: number
}

interface ChatPanelProps {
  sessionId?: string
  projectId?: string
  taskId?: string
  isClientMessage?: boolean
  allowImages?: boolean
  title?: string
  placeholder?: string
  className?: string
  mentionableUsers?: { id: string; name: string }[]
  useTaskChat?: boolean
}

const CHAT_REFRESH_INTERVAL_MS = 5_000

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-pink-500",
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

function attachmentSrc(att: ChatAttachment) {
  if (att.data) return `data:${att.type};base64,${att.data}`
  return att.url ?? ""
}

async function downloadAttachment(att: ChatAttachment) {
  try {
    if (att.url && !att.data) {
      // Task chat attachment — fetch as blob to force download
      const res = await fetch(att.url)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = att.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
      return
    }

    const src = att.data ? `data:${att.type};base64,${att.data}` : (att.url ?? "")
    if (!src) return
    const link = document.createElement("a")
    link.href = src
    link.download = att.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch {
    toast.error("No se pudo descargar el archivo")
  }
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(existing.map((message) => [message.id, message]))

  incoming.forEach((message) => {
    const current = merged.get(message.id)
    merged.set(message.id, current ? { ...current, ...message } : message)
  })

  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

function toLegacyAttachment(att: ChatAttachment): CommentAttachment {
  return {
    id: att.id,
    name: att.name,
    type: att.type,
    size: att.size,
    data: att.data ?? "",
  }
}

function mapLegacyMessage(message: LegacyMessage): ChatMessage {
  return {
    id: message.id,
    fromUserId: message.fromUserId,
    fromUserName: message.fromUserName,
    fromUserRole: message.fromUserRole,
    content: message.content,
    attachments: (message.attachments ?? []).map((attachment) => ({
      data: attachment.data,
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
    })),
    createdAt: message.createdAt,
    isPreStart: message.isPreStart,
  }
}

function mapTaskChatMessage(taskId: string, message: TaskChatApiMessage): ChatMessage {
  return {
    id: message.id,
    fromUserId: message.author.id,
    fromUserName: message.author.name ?? "Sistema",
    fromUserRole: message.author.role ?? "system",
    content: message.text ?? "",
    attachments: message.attachments.map((attachment) => ({
      attachmentId: attachment.id,
      id: attachment.id,
      name: attachment.fileName,
      size: attachment.sizeBytes,
      type: attachment.mimeType,
      url: `/api/tasks/${taskId}/chat/attachments/${attachment.id}`,
    })),
    createdAt: message.createdAt,
    isPreStart: false,
  }
}

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
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && state.index > 0) onChange(state.index - 1)
      if (e.key === "ArrowRight" && state.index < state.attachments.length - 1) onChange(state.index + 1)
      if ((e.key === "+" || e.key === "=") && !zoomed) setZoomed(true)
      if (e.key === "-" && zoomed) setZoomed(false)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, onClose, onChange, zoomed])

  useEffect(() => {
    setZoomed(false)
  }, [state.index])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[65%]">
          <p className="truncate text-sm text-white/85">{att.name}</p>
          <p className="text-[11px] text-white/55">Esc para cerrar{zoomed ? " - vista ampliada" : " - clic en la imagen para ampliar"}</p>
        </div>
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
            onClick={() => setZoomed((value) => !value)}
            title={zoomed ? "Ajustar a pantalla" : "Ampliar imagen"}
          >
            {zoomed ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
            onClick={() => { void downloadAttachment(att) }}
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

      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center px-4 py-20 sm:px-10 lg:px-16",
          zoomed && "overflow-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoomed((value) => !value)}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl",
            zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
          )}
        >
          <Image
            src={attachmentSrc(att)}
            alt={att.name}
            width={1800}
            height={1200}
            unoptimized
            sizes="100vw"
            className={cn(
              "h-auto w-auto transition-transform duration-200",
              zoomed
                ? "max-h-none max-w-none object-contain"
                : "max-h-[calc(100vh-10rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-w-[calc(100vw-5rem)]"
            )}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/20 to-transparent px-4 py-3 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <span className="text-xs text-white/80">{zoomed ? "Clic para ajustar" : "Clic para ampliar"}</span>
            <span className="text-[11px] text-white/60">{Math.round(att.size / 1024)} KB</span>
          </div>
        </button>
      </div>

      {hasMultiple && (
        <>
          <button
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors",
              state.index === 0 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation()
              onChange(state.index - 1)
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors",
              state.index === state.attachments.length - 1 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation()
              onChange(state.index + 1)
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {hasMultiple && (
        <div
          className="absolute bottom-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          {state.attachments.map((attachment, index) => (
              <button
                key={attachment.id}
                onClick={() => onChange(index)}
              className={cn(
                "relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                index === state.index ? "border-white" : "border-transparent opacity-60 hover:opacity-90"
              )}
              >
                <Image
                  src={attachmentSrc(attachment)}
                  alt={attachment.name}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
      )}
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(content, document.body)
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
  mentionableUsers,
  useTaskChat = false,
}: ChatPanelProps) {
  const { user } = useAuth()
  const taskChatEnabled = useTaskChat && Boolean(taskId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [text, setText] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionStart, setMentionStart] = useState(-1)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingAttachmentsRef = useRef<ChatAttachment[]>([])
  const shouldScrollOnNextMessageRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const filteredUsers = useMemo(
    () => (mentionableUsers ?? []).filter((item) => item.name.toLowerCase().includes(mentionQuery.toLowerCase())),
    [mentionQuery, mentionableUsers]
  )

  const cleanupPendingAttachment = useCallback(async (attachment: ChatAttachment) => {
    if (attachment.url?.startsWith("blob:")) {
      URL.revokeObjectURL(attachment.url)
    }

    if (!taskChatEnabled || !taskId || !attachment.attachmentId || attachment.isUploading) {
      return
    }

    await fetch(`/api/tasks/${taskId}/chat/attachments/${attachment.attachmentId}`, {
      method: "DELETE",
    }).catch(() => undefined)
  }, [taskChatEnabled, taskId])

  const discardPendingAttachments = useCallback(async () => {
    const attachments = [...pendingAttachments]
    setPendingAttachments([])

    await Promise.all(attachments.map((attachment) => cleanupPendingAttachment(attachment)))
  }, [cleanupPendingAttachment, pendingAttachments])

  const markTaskChatAsRead = useCallback(async (messageId: string, lastReadMessageId: string | null) => {
    if (!taskChatEnabled || !taskId || !messageId || lastReadMessageId === messageId) return

    try {
      const response = await fetch(`/api/tasks/${taskId}/chat/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastReadMessageId: messageId }),
      })

      if (response.ok) {
        const result = await response.json()
        setUnreadCount(result.unreadCount ?? 0)
      }
    } catch {
      // non-critical
    }
  }, [taskChatEnabled, taskId])

  const fetchMessages = useCallback(async (options?: { cursor?: string; silent?: boolean }) => {
    const cursor = options?.cursor

    try {
      if (!options?.silent) {
        if (cursor) setLoadingMore(true)
        else setLoading(true)
      }

      if (taskChatEnabled && taskId) {
        const params = new URLSearchParams({ limit: "50" })
        if (cursor) params.set("cursor", cursor)

        const response = await fetch(`/api/tasks/${taskId}/chat?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) throw new Error()

        const data: TaskChatListResponse = await response.json()
        const mappedMessages = data.messages.map((message) => mapTaskChatMessage(taskId, message))

        setMessages((prev) => (cursor ? mergeMessages(mappedMessages, prev) : mergeMessages(prev, mappedMessages)))
        setNextCursor(data.nextCursor)
        setUnreadCount(data.unreadCount ?? 0)

        const latestMessage = mappedMessages[mappedMessages.length - 1]
        if (!cursor && latestMessage) {
          void markTaskChatAsRead(latestMessage.id, data.participant.lastReadMessageId)
        }

        return
      }

      const params = new URLSearchParams()
      if (taskId) params.set("taskId", taskId)
      else if (sessionId) params.set("sessionId", sessionId)
      else if (projectId) params.set("projectId", projectId)

      const response = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) throw new Error()

      const data: LegacyMessage[] = await response.json()
      setMessages(data.map(mapLegacyMessage))
      setNextCursor(null)
      setUnreadCount(0)
    } catch {
      // non-critical
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [markTaskChatAsRead, projectId, sessionId, taskChatEnabled, taskId])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

  useEffect(() => {
    const currentPending = [...pendingAttachmentsRef.current]
    pendingAttachmentsRef.current = []
    setPendingAttachments([])
    currentPending.forEach((attachment) => {
      void cleanupPendingAttachment(attachment)
    })

    setMessages([])
    setNextCursor(null)
    setUnreadCount(0)
    setText("")
    setShowImageUpload(false)
    setLoading(true)
    void fetchMessages()
  }, [cleanupPendingAttachment, fetchMessages, projectId, sessionId, taskChatEnabled, taskId])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchMessages({ silent: true })
    }, CHAT_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (!shouldScrollOnNextMessageRef.current) return
    shouldScrollOnNextMessageRef.current = false
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  useEffect(() => () => {
    pendingAttachmentsRef.current.forEach((attachment) => {
      if (attachment.url?.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.url)
      }
    })
  }, [])

  async function handleTaskChatFilesSelected(
    files: File[],
    options?: { source?: "clipboard" | "manual" }
  ) {
    if (!taskId) return

    const source = options?.source ?? "manual"

    for (const file of files) {
      const tempId = `pending-${crypto.randomUUID()}`
      const previewUrl = URL.createObjectURL(file)

      setPendingAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          isUploading: true,
          name: file.name,
          size: file.size,
          type: file.type,
          url: previewUrl,
        },
      ])

      try {
        const formData = new FormData()
        formData.set("file", file)
        formData.set("source", source)

        const response = await fetch(`/api/tasks/${taskId}/chat/attachments`, {
          method: "POST",
          body: formData,
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.attachmentId) {
          throw new Error(payload?.error ?? "upload_failed")
        }

        setPendingAttachments((prev) => prev.map((attachment) => (
          attachment.id === tempId
            ? {
                ...attachment,
                attachmentId: payload.attachmentId,
                id: payload.attachmentId,
                isUploading: false,
                name: payload.fileName,
                size: payload.sizeBytes,
                type: payload.mimeType,
              }
            : attachment
        )))
      } catch {
        URL.revokeObjectURL(previewUrl)
        setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== tempId))
        toast.error(`No se pudo subir ${file.name}`)
      }
    }
  }

  async function handleRemovePendingAttachment(attachmentId: string) {
    const attachment = pendingAttachments.find((item) => item.id === attachmentId)
    if (!attachment || attachment.isUploading) return

    setPendingAttachments((prev) => prev.filter((item) => item.id !== attachmentId))
    await cleanupPendingAttachment(attachment)
  }

  async function handleSend() {
    const hasText = text.trim().length > 0
    const hasImages = pendingAttachments.length > 0
    if ((!hasText && !hasImages) || !user) return

    if (taskChatEnabled && pendingAttachments.some((attachment) => attachment.isUploading)) {
      toast.error("Esperá a que terminen de subir las imágenes")
      return
    }

    setSending(true)

    try {
      if (taskChatEnabled && taskId) {
        const response = await fetch(`/api/tasks/${taskId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attachmentIds: pendingAttachments
              .map((attachment) => attachment.attachmentId)
              .filter((value): value is string => typeof value === "string"),
            clientRequestId: crypto.randomUUID(),
            text: text.trim() || undefined,
          }),
        })

        if (!response.ok) throw new Error()
        const created = await response.json()
        const mappedCreated = mapTaskChatMessage(taskId, created)

        shouldScrollOnNextMessageRef.current = true
        setMessages((prev) => mergeMessages(prev, [mappedCreated]))
        setUnreadCount(created.unreadCount ?? 0)
        setText("")
        pendingAttachments.forEach((attachment) => {
          if (attachment.url?.startsWith("blob:")) {
            URL.revokeObjectURL(attachment.url)
          }
        })
        setPendingAttachments([])
        setShowImageUpload(false)
        textareaRef.current?.focus()
        return
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachments: pendingAttachments.map(toLegacyAttachment),
          content: text.trim() || "(imagen adjunta)",
          isClientMessage,
          projectId: projectId ?? null,
          sessionId: sessionId ?? null,
          taskId: taskId ?? null,
        }),
      })

      if (!response.ok) throw new Error()
      const created: LegacyMessage = await response.json()

      shouldScrollOnNextMessageRef.current = true
      setMessages((prev) => [...prev, mapLegacyMessage(created)])
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

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    const cursor = e.target.selectionStart ?? value.length
    setText(value)

    if (!mentionableUsers || mentionableUsers.length === 0) return

    const textBeforeCursor = value.slice(0, cursor)
    const lastAt = textBeforeCursor.lastIndexOf("@")
    if (lastAt !== -1) {
      const afterAt = textBeforeCursor.slice(lastAt + 1)
      if (!afterAt.includes(" ")) {
        setMentionQuery(afterAt)
        setMentionStart(lastAt)
        setMentionIndex(0)
        setShowMentions(true)
        return
      }
    }

    setShowMentions(false)
  }

  function insertMention(mentionUser: { id: string; name: string }) {
    const before = text.slice(0, mentionStart)
    const after = text.slice(mentionStart + 1 + mentionQuery.length)
    const newText = `${before}@${mentionUser.name} ${after}`
    setText(newText)
    setShowMentions(false)
    setMentionQuery("")

    setTimeout(() => {
      if (!textareaRef.current) return
      const pos = before.length + mentionUser.name.length + 2
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(pos, pos)
    }, 0)
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!taskChatEnabled || !taskId) return
    const files = extractTaskChatClipboardFiles(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    setShowImageUpload(true)
    await handleTaskChatFilesSelected(files, { source: "clipboard" })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((index) => Math.min(index + 1, filteredUsers.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((index) => Math.max(index - 1, 0))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(filteredUsers[mentionIndex])
        return
      }
      if (e.key === "Escape") {
        setShowMentions(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const canSend = (text.trim().length > 0 || pendingAttachments.length > 0) && !sending

  return (
    <>
      {lightbox && (
        <Lightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((prev) => (prev ? { ...prev, index } : null))}
        />
      )}

      <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {messages.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {messages.length} mensajes{taskChatEnabled && unreadCount > 0 ? ` · ${unreadCount} sin leer` : ""}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[520px]">
          {taskChatEnabled && nextCursor && !loading && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void fetchMessages({ cursor: nextCursor })}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cargar anteriores"}
              </Button>
            </div>
          )}

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
                <div key={msg.id} className={cn("flex gap-2.5", isOwn && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      msg.isPreStart ? "bg-amber-500" : avatarColor(msg.fromUserName)
                    )}
                  >
                    {msg.isPreStart ? "📋" : getInitials(msg.fromUserName)}
                  </div>

                  <div className={cn("flex flex-col gap-1 max-w-[75%]", isOwn && "items-end")}>
                    {msg.isPreStart && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 px-1">
                        Nota pre-inicio
                      </span>
                    )}
                    {(msg.content || atts.length > 0) && (
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.isPreStart
                            ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20 rounded-tl-sm"
                            : isOwn
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted text-foreground rounded-tl-sm"
                        )}
                      >
                        {msg.content || (atts.length > 0 ? "(imagen adjunta)" : "")}
                      </div>
                    )}

                    {atts.length > 0 && (
                      <div className={cn("flex flex-wrap gap-1.5 mt-0.5", isOwn && "justify-end")}>
                        {atts.map((att) => {
                          const isImage = att.type.startsWith("image/")
                          if (isImage) {
                            return (
                              <div key={att.id} className="group relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const imageAtts = atts.filter((a) => a.type.startsWith("image/"))
                                    const imageIdx = imageAtts.findIndex((a) => a.id === att.id)
                                    setLightbox({ attachments: imageAtts, index: Math.max(0, imageIdx) })
                                  }}
                                  className="block rounded-xl overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  title="Ver imagen"
                                >
                                  <div className="relative h-28 w-28">
                                    <Image
                                      src={attachmentSrc(att)}
                                      alt={att.name}
                                      fill
                                      unoptimized
                                      sizes="112px"
                                      className="object-cover"
                                    />
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void downloadAttachment(att) }}
                                  className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                  title="Descargar"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            )
                          }
                          // Document attachment
                          return (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => { void downloadAttachment(att) }}
                              className={cn(
                                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/60",
                                isOwn
                                  ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                                  : "border-border bg-muted/40 text-foreground"
                              )}
                              title="Descargar"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="max-w-[140px] truncate">{att.name}</span>
                              <Download className="h-3 w-3 shrink-0 opacity-60" />
                            </button>
                          )
                        })}
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

        {allowImages && showImageUpload && (
          <div className="border-t border-border px-3 pt-2 pb-1">
            {taskChatEnabled ? (
              <ImageUpload
                value={pendingAttachments}
                onFilesSelected={handleTaskChatFilesSelected}
                onRemoveImage={handleRemovePendingAttachment}
                maxImages={5}
              />
            ) : (
              <ImageUpload
                onImagesChange={(images) => setPendingAttachments(images.map((image) => ({
                  data: image.data,
                  id: image.id,
                  name: image.name,
                  size: image.size,
                  type: image.type,
                })))}
                maxImages={3}
              />
            )}
          </div>
        )}

        <div className="border-t border-border p-3 flex gap-2 items-end">
          {taskChatEnabled && (
            <>
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length === 0) return
                  setShowImageUpload(true)
                  await handleTaskChatFilesSelected(files)
                  if (documentInputRef.current) documentInputRef.current.value = ""
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-[38px] w-[38px] flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => documentInputRef.current?.click()}
                title="Adjuntar documento"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
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
                if (showImageUpload) {
                  void discardPendingAttachments()
                }
                setShowImageUpload((value) => !value)
              }}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 relative">
            {showMentions && filteredUsers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-56 rounded-lg border border-border bg-popover shadow-md overflow-hidden z-20">
                {filteredUsers.map((mentionUser, index) => (
                  <button
                    key={mentionUser.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertMention(mentionUser)
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent",
                      index === mentionIndex && "bg-accent"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
                        avatarColor(mentionUser.name)
                      )}
                    >
                      {getInitials(mentionUser.name)}
                    </div>
                    <span className="truncate text-foreground">{mentionUser.name}</span>
                  </button>
                ))}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onPaste={(e) => { void handlePaste(e) }}
              placeholder={placeholder}
              rows={1}
              className="resize-none min-h-[38px] max-h-[100px] text-sm w-full"
            />
          </div>
          <Button size="icon" onClick={() => void handleSend()} disabled={!canSend} className="h-[38px] w-[38px] flex-shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  )
}
