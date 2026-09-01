import { GlassCard } from "@/components/GlassCard"
import { Skeleton } from "@/components/ui/skeleton"

export function HRTableSkeletonRows({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="border-b border-zinc-150/40">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="py-4 px-4">
              <Skeleton className="h-4 w-full bg-zinc-200/80 rounded-md" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function HRPageSkeleton({ rows = 6, cards = 4, cols = 5 }: { rows?: number; cards?: number; cols?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {cards > 0 && (
        <div className={`grid grid-cols-2 ${cards >= 4 ? "lg:grid-cols-4" : cards === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
          {Array.from({ length: cards }).map((_, index) => (
            <GlassCard key={index} className="p-5 border border-white/65 shadow-xs">
              <Skeleton className="h-3.5 w-28 bg-zinc-200/80 rounded-full" />
              <Skeleton className="h-7 w-24 bg-zinc-200/90 rounded-xl mt-3" />
              <Skeleton className="h-2.5 w-36 bg-zinc-150/60 rounded-full mt-2" />
            </GlassCard>
          ))}
        </div>
      )}

      <GlassCard className="p-0 overflow-hidden border border-white/65 shadow-md">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-200/40 bg-black/[0.01]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-5 w-40 bg-zinc-200/80 rounded-lg" />
              <Skeleton className="h-3 w-56 bg-zinc-150/70 rounded-full mt-2" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton className="h-9 w-44 bg-zinc-200/60 rounded-2xl" />
              <Skeleton className="h-9 w-28 bg-zinc-200/60 rounded-xl" />
              <Skeleton className="h-9 w-32 bg-zinc-900/10 rounded-full" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/[0.02] border-b border-zinc-200/40">
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i} className="py-3 px-4">
                    <Skeleton className="h-3 w-20 bg-zinc-200/70 rounded-full" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={rIdx} className="border-b border-zinc-100/60">
                  {Array.from({ length: cols }).map((_, cIdx) => (
                    <td key={cIdx} className="py-4 px-4">
                      <Skeleton
                        className={`h-4 bg-zinc-200/70 rounded-md ${
                          cIdx === 0 ? "w-3/4" : cIdx === cols - 1 ? "w-16 ml-auto" : "w-full"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
