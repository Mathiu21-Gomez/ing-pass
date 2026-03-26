"use client"

import React, { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

type KanbanVariant = "column" | "item"

interface KanbanContextValue<T> {
  value: Record<string, T[]>
  onValueChange: (value: Record<string, T[]>) => void
  getItemValue: (item: T) => string
  draggingId: string | null
  draggingVariant: KanbanVariant | null
  setDragging: (id: string | null, variant: KanbanVariant | null) => void
  overColumnId: string | null
  setOverColumnId: (id: string | null) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const KanbanContext = createContext<KanbanContextValue<any> | null>(null)

function useKanban<T>() {
  const ctx = useContext(KanbanContext) as KanbanContextValue<T> | null
  if (!ctx) throw new Error("useKanban must be inside <Kanban>")
  return ctx
}

// ── Kanban (root) ──────────────────────────────────────────────────────────

interface KanbanProps<T> {
  value: Record<string, T[]>
  onValueChange: (value: Record<string, T[]>) => void
  getItemValue: (item: T) => string
  children: React.ReactNode
}

function Kanban<T>({ value, onValueChange, getItemValue, children }: KanbanProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingVariant, setDraggingVariant] = useState<KanbanVariant | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  function setDragging(id: string | null, variant: KanbanVariant | null) {
    setDraggingId(id)
    setDraggingVariant(variant)
  }

  return (
    <KanbanContext.Provider
      value={{ value, onValueChange, getItemValue, draggingId, draggingVariant, setDragging, overColumnId, setOverColumnId }}
    >
      {children}
    </KanbanContext.Provider>
  )
}

// ── KanbanBoard ────────────────────────────────────────────────────────────

function KanbanBoard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-4 items-start", className)}>
      {children}
    </div>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

interface KanbanColumnProps {
  value: string
  children: React.ReactNode
  className?: string
}

function KanbanColumn({ value: colId, children, className }: KanbanColumnProps) {
  const { draggingVariant, value: columns, onValueChange, getItemValue, overColumnId, setOverColumnId } = useKanban()

  const isOver = overColumnId === colId && draggingVariant === "item"

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setOverColumnId(colId)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setOverColumnId(null)

    const itemId = e.dataTransfer.getData("itemId")
    const fromColumn = e.dataTransfer.getData("fromColumn")

    if (!itemId || fromColumn === colId) return

    const updated = { ...columns }
    const fromItems = [...(updated[fromColumn] ?? [])]
    const toItems = [...(updated[colId] ?? [])]

    const itemIndex = fromItems.findIndex((i) => getItemValue(i) === itemId)
    if (itemIndex === -1) return

    const [movedItem] = fromItems.splice(itemIndex, 1)
    toItems.push(movedItem)

    updated[fromColumn] = fromItems
    updated[colId] = toItems
    onValueChange(updated)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOverColumnId(null)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col transition-colors duration-150",
        isOver && "ring-2 ring-white/20",
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {children}
    </div>
  )
}

// ── KanbanColumnHandle ─────────────────────────────────────────────────────

function KanbanColumnHandle({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("cursor-grab active:cursor-grabbing select-none", className)}>
      {children}
    </div>
  )
}

// ── KanbanColumnContent ────────────────────────────────────────────────────

interface KanbanColumnContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

function KanbanColumnContent({ children, className }: KanbanColumnContentProps) {
  return (
    <div className={cn("flex flex-col gap-2 p-3 min-h-[120px]", className)}>
      {children}
    </div>
  )
}

// ── KanbanItem ─────────────────────────────────────────────────────────────

interface KanbanItemProps {
  value: string
  children: React.ReactNode
  className?: string
  draggable?: boolean
}

function KanbanItem({ value: itemId, children, className, draggable: isDraggable = true }: KanbanItemProps) {
  const { setDragging, value: columns, getItemValue } = useKanban()
  const [isDragging, setIsDragging] = useState(false)

  function findColumn() {
    for (const [colId, items] of Object.entries(columns)) {
      if (items.some((i) => getItemValue(i) === itemId)) return colId
    }
    return ""
  }

  function handleDragStart(e: React.DragEvent) {
    const colId = findColumn()
    e.dataTransfer.setData("itemId", itemId)
    e.dataTransfer.setData("fromColumn", colId)
    e.dataTransfer.effectAllowed = "move"
    setDragging(itemId, "item")
    setIsDragging(true)
  }

  function handleDragEnd() {
    setDragging(null, null)
    setIsDragging(false)
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
      className={cn(
        "transition-opacity duration-150",
        isDragging && "opacity-30",
        isDraggable && "cursor-grab active:cursor-grabbing",
        className
      )}
    >
      {children}
    </div>
  )
}

// ── KanbanItemHandle ───────────────────────────────────────────────────────

function KanbanItemHandle({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("cursor-grab active:cursor-grabbing select-none", className)}>
      {children}
    </div>
  )
}

// ── KanbanOverlay ── (no-op: HTML5 DnD has native ghost image)

interface KanbanOverlayProps {
  children?: ((args: { value: string; variant: KanbanVariant }) => React.ReactNode) | React.ReactNode
}

function KanbanOverlay(_props: KanbanOverlayProps) {
  return null
}

// ── Exports ────────────────────────────────────────────────────────────────

export {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
}
