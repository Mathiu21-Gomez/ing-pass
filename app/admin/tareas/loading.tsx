import { TableSkeleton } from "@/components/skeletons"
export default function Loading() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <TableSkeleton rows={10} />
    </div>
  )
}
