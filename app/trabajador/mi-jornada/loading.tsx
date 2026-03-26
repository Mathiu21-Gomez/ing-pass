import { TimerCardSkeleton, KPICardSkeleton } from "@/components/skeletons"
export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4">
        <TimerCardSkeleton />
        <KPICardSkeleton />
      </div>
      <div className="lg:col-span-2 space-y-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    </div>
  )
}
