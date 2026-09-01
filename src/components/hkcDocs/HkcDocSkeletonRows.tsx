import { Skeleton } from "@/components/ui/skeleton"

export function HkcDocSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-zinc-150/40">
          <td className="px-3 py-4"><Skeleton className="h-4 w-28 bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-4 w-56 bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-5 w-16 rounded-md bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
          <td className="px-3 py-4 text-center"><Skeleton className="h-7 w-24 rounded-full mx-auto bg-zinc-200/80" /></td>
        </tr>
      ))}
    </>
  )
}
