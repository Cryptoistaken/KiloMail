import { Skeleton } from "@/components/ui/skeleton"

export function MessageSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
