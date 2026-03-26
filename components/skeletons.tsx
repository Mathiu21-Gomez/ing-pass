"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-0", className)}>
      <div className="flex gap-4 px-4 py-3 border-b">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24 ml-auto" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-20 rounded-full ml-auto" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-56 mb-6" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-56 mb-6" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
        <TableSkeleton rows={5} />
      </div>
    </div>
  )
}

export function KanbanSkeleton({ columns = 3, className }: { columns?: number; className?: string }) {
  return (
    <div className={cn("flex gap-4 p-4 overflow-x-auto", className)}>
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="min-w-[260px] w-[260px] rounded-2xl bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          {Array.from({ length: 2 + col }).map((_, card) => (
            <div key={card} className="rounded-xl bg-card p-4 space-y-2 shadow-sm">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2 mt-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function TimerCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm p-5 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 w-32 mx-auto" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  )
}
