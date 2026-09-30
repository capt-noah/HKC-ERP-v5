import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "light" | "dark"
  hoverEffect?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "light", hoverEffect: _hoverEffect, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[1.75rem] p-6",
          variant === "dark" ? "glass-card-dark" : "glass-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"
