import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function TaskShellWorkspace({ sidebar, content }: { sidebar: ReactNode; content: ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">{sidebar}{content}</div>
}

export function TaskShellHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm mesh-bg">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">{eyebrow}</p> : null}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  )
}

export function TaskShellStats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">{children}</div>
}

export function TaskShellStatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: "default" | "info" | "danger" | "warning" | "success"
  active?: boolean
  onClick?: () => void
}) {
  const toneClassName = {
    default: "border-border/70",
    info: "border-blue-200/70 dark:border-blue-900/60",
    danger: "border-red-200/70 dark:border-red-900/60",
    warning: "border-amber-200/70 dark:border-amber-900/60",
    success: "border-emerald-200/70 dark:border-emerald-900/60",
  }[tone]

  const iconClassName = {
    default: "text-muted-foreground",
    info: "text-blue-500",
    danger: "text-red-500",
    warning: "text-amber-500",
    success: "text-emerald-500",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "stat-card-accent w-full text-left rounded-2xl border bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        toneClassName,
        active && "ring-2 ring-primary/20"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="rounded-xl border border-border/60 bg-muted/35 p-2">
          <Icon className={cn("h-4 w-4", iconClassName)} />
        </div>
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
    </button>
  )
}

export function TaskShellPanel({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/95 shadow-sm", className)}>
      <CardContent className={cn("p-0", contentClassName)}>
        <div className="flex items-start justify-between gap-3 border-b border-border/50 bg-muted/20 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/90">{title}</h2>
            {description ? <div className="text-xs leading-relaxed text-muted-foreground">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="p-5">{children}</div>
      </CardContent>
    </Card>
  )
}

export function TaskShellBoard({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

export function TaskShellDetailGrid({
  info,
  checklist,
  history,
  conversation,
}: {
  info: ReactNode
  checklist: ReactNode
  history?: ReactNode
  conversation: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0">{info}</div>
        <div className="flex min-w-0 flex-col gap-4">{checklist}{history}</div>
      </div>
      <div className="min-w-0">{conversation}</div>
    </div>
  )
}

export function TaskShellMetaGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

export function TaskShellMetaItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/25 px-4 py-3", className)}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm leading-relaxed text-foreground">{value}</div>
    </div>
  )
}
