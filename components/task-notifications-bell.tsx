"use client"

import { useEffect, useRef, useState } from "react"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Bell, BellRing, CheckCheck, MessageSquare, AtSign, ClipboardList } from "lucide-react"

import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  entityType: string
  entityId: string
  fromUserId: string | null
  fromUserName: string | null
  message: string
  readAt: string | null
  createdAt: string
}

interface TaskNotificationsBellProps {
  basePath: string
  buttonClassName?: string
  panelClassName?: string
}

function getTaskNotificationHref(basePath: string, notification: NotificationItem) {
  if (notification.entityType !== "task") return null

  const params = new URLSearchParams({
    task: notification.entityId,
    notification: notification.id,
  })

  // Mention → open directly in the chat tab
  if (notification.type === "mention") {
    params.set("tab", "chat")
  }

  return `${basePath}?${params.toString()}`
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

const AVATAR_PALETTE = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
]

function avatarGradient(name: string | null): string {
  if (!name) return AVATAR_PALETTE[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

export function TaskNotificationsBell({
  basePath,
  buttonClassName,
  panelClassName,
}: TaskNotificationsBellProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<{ notifications: NotificationItem[]; unreadCount: number }>(
    "/api/notifications",
    { refreshInterval: 30_000, dedupingInterval: 15_000 }
  )

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0
  const hasUnread = unreadCount > 0

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  async function markRead(ids?: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    }).catch(() => undefined)

    void mutate()
  }

  async function handleNotificationClick(notification: NotificationItem) {
    const href = getTaskNotificationHref(basePath, notification)
    if (!href) return

    await markRead([notification.id])
    setIsOpen(false)
    router.push(href)
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
          isOpen
            ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          buttonClassName
        )}
        aria-label="Notificaciones"
      >
        {hasUnread ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}

        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl ring-1 ring-black/5 dark:ring-white/5",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150",
            panelClassName
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Notificaciones</span>
              {hasUnread && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                  {unreadCount}
                </span>
              )}
            </div>
            {notifications.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <CheckCheck className="h-3 w-3" />
                Leer todo
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[22rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-foreground">Sin notificaciones</p>
                  <p className="text-xs text-muted-foreground">Las menciones aparecerán aquí</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((notification) => {
                  const href = getTaskNotificationHref(basePath, notification)
                  const isUnread = !notification.readAt
                  const gradient = avatarGradient(notification.fromUserName)

                  return (
                    <div
                      key={notification.id}
                      onClick={href ? () => void handleNotificationClick(notification) : undefined}
                      className={cn(
                        "group flex gap-3 px-4 py-3 transition-colors duration-100",
                        href && "cursor-pointer",
                        isUnread
                          ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Avatar */}
                      <div className="shrink-0 pt-0.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm",
                            gradient
                          )}
                        >
                          {getInitials(notification.fromUserName)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className={cn(
                          "text-[12.5px] leading-snug",
                          isUnread ? "font-medium text-foreground" : "text-foreground/80"
                        )}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2">
                          {notification.type === "mention"
                            ? <AtSign className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            : <ClipboardList className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          }
                          <span className="text-[11px] text-muted-foreground/60">
                            {format(new Date(notification.createdAt), "d MMM · HH:mm", { locale: es })}
                          </span>
                        </div>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <div className="shrink-0 pt-2">
                          <span className="block h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border/60 bg-muted/30 px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground/50 text-center">
                Mostrando las últimas {notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
