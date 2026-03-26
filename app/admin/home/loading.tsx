import { KPICardSkeleton, TimerCardSkeleton } from "@/components/skeletons"
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <TimerCardSkeleton />
          <KPICardSkeleton />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <KPICardSkeleton />
          <KPICardSkeleton />
        </div>
      </div>
    </div>
  )
}
