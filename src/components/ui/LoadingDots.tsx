import { cn } from "@/lib/utils"

export interface LoadingDotsProps {
  className?: string
  color?: string
  size?: "xs" | "sm" | "md" | "lg"
}

export function LoadingDots({
  className,
  color = "bg-green-700 dark:bg-green-400",
  size = "md",
}: LoadingDotsProps) {
  const dotSizes = {
    xs: "size-1",
    sm: "size-1.5",
    md: "size-2",
    lg: "size-2.5",
  }

  const dotSize = dotSizes[size] || dotSizes.md

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center gap-1.5 py-0.5", className)}
    >
      <span className={cn("rounded-full animate-bounce [animation-delay:-0.3s]", dotSize, color)} />
      <span className={cn("rounded-full animate-bounce [animation-delay:-0.15s]", dotSize, color)} />
      <span className={cn("rounded-full animate-bounce", dotSize, color)} />
      <span className="sr-only">Loading...</span>
    </span>
  )
}
