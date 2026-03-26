"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatPanel } from "@/components/chat-panel"
import { MessageSquare, Users, Building2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Message {
  id: string
  fromUserId: string
  fromUserName: string
  fromUserRole: string
  content: string
  sessionId: string | null
  projectId: string | null
  projectName: string | null
  taskName: string | null
  isClientMessage: boolean
  isPreStart: boolean
  readAt: string | null
  createdAt: string
}

interface ConversationGroup {
  key: string
  label: string
  sublabel: string
  projectName: string | null
  taskName: string | null
  messages: Message[]
  lastMessage: Message
  unread: number
}

const INBOX_REFRESH_INTERVAL_MS = 5_000

export default function CoordinadorBandejaPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data: Message[] = await res.json()
      setMessages(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, INBOX_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const workerChats = messages
    .filter((m) => !m.isClientMessage && m.sessionId)
    .reduce<Record<string, Message[]>>((acc, msg) => {
      const key = msg.sessionId!
      if (!acc[key]) acc[key] = []
      acc[key].push(msg)
      return acc
    }, {})

  const clientChats = messages
    .filter((m) => m.isClientMessage && m.projectId)
    .reduce<Record<string, Message[]>>((acc, msg) => {
      const key = msg.projectId!
      if (!acc[key]) acc[key] = []
      acc[key].push(msg)
      return acc
    }, {})

  function buildGroups(grouped: Record<string, Message[]>): ConversationGroup[] {
    return Object.entries(grouped).map(([key, msgs]) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const last = sorted[sorted.length - 1]
      const contextMsg = sorted.find((m) => m.projectName) ?? sorted[0]
      return {
        key,
        label: last.fromUserName,
        sublabel: format(new Date(last.createdAt), "d MMM · HH:mm", { locale: es }),
        projectName: contextMsg.projectName ?? null,
        taskName: contextMsg.taskName ?? null,
        messages: sorted,
        lastMessage: last,
        unread: msgs.filter((m) => !m.readAt && m.fromUserId !== user?.id).length,
      }
    }).sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime())
  }

  const workerGroups = buildGroups(workerChats)
  const clientGroups = buildGroups(clientChats)
  const selectedGroup = [...workerGroups, ...clientGroups].find((group) => group.key === selectedGroupKey) ?? null

  async function handleSelectGroup(g: ConversationGroup) {
    setSelectedGroupKey(g.key)
    // Optimistic update
    const now = new Date().toISOString()
    setMessages(prev =>
      prev.map(m => {
        if (m.readAt || m.fromUserId === user?.id) return m
        const matches = g.lastMessage.sessionId
          ? m.sessionId === g.lastMessage.sessionId
          : m.projectId === g.lastMessage.projectId
        return matches ? { ...m, readAt: now } : m
      })
    )
    // Persist
    const key = g.lastMessage.sessionId
      ? { sessionId: g.lastMessage.sessionId }
      : { projectId: g.lastMessage.projectId }
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(key),
    }).catch(() => { /* silent */ })
  }

  function ConversationList({ groups }: { groups: ConversationGroup[] }) {
    if (groups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin conversaciones aún</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => handleSelectGroup(g)}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
              selectedGroupKey === g.key
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/50"
            )}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {g.label.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{g.label}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{g.sublabel}</span>
              </div>
              {g.projectName && (
                <p className="text-[11px] text-primary/70 font-medium truncate mt-0.5">
                  {g.projectName}{g.taskName ? ` · ${g.taskName}` : ""}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {g.lastMessage.isPreStart && <span className="text-amber-500 font-medium">📋 Pre-inicio · </span>}
                {g.lastMessage.content}
              </p>
            </div>
            {g.unread > 0 && (
              <Badge className="flex-shrink-0 h-5 min-w-[1.25rem] px-1 text-[10px] bg-primary">
                {g.unread}
              </Badge>
            )}
          </button>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Bandeja</h1>
        <p className="text-sm text-muted-foreground">
          Mensajes de trabajadores durante jornada y consultas de clientes externos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 min-h-[500px]">
        <Card className="overflow-hidden">
          <Tabs defaultValue="workers">
            <CardHeader className="pb-0 pt-4 px-4">
              <TabsList className="w-full">
                <TabsTrigger value="workers" className="flex-1 gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Equipo
                  {workerGroups.length > 0 && (
                    <span className="text-[10px] font-bold">{workerGroups.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="clients" className="flex-1 gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Clientes
                  {clientGroups.length > 0 && (
                    <span className="text-[10px] font-bold">{clientGroups.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="px-2 py-2">
              <TabsContent value="workers" className="mt-0">
                <ConversationList groups={workerGroups} />
              </TabsContent>
              <TabsContent value="clients" className="mt-0">
                <ConversationList groups={clientGroups} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="flex flex-col">
          {selectedGroup ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5 px-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{selectedGroup.label}</p>
                  <span className="text-xs text-muted-foreground">· {selectedGroup.messages.length} mensajes</span>
                </div>
                {selectedGroup.projectName && (
                  <p className="text-xs text-muted-foreground">
                    {selectedGroup.projectName}{selectedGroup.taskName ? ` · ${selectedGroup.taskName}` : ""}
                  </p>
                )}
              </div>
              <ChatPanel
                sessionId={selectedGroup.lastMessage.sessionId ?? undefined}
                projectId={selectedGroup.lastMessage.projectId ?? undefined}
                isClientMessage={selectedGroup.lastMessage.isClientMessage}
                title="Conversación"
                className="h-full"
              />
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20" />
                <CardTitle className="text-base text-muted-foreground font-normal">
                  Seleccioná una conversación para ver los mensajes
                </CardTitle>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
