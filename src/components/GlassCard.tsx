import { forwardRef } from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCardProps extends HTMLMotionProps<"div"> {
  variant?: "light" | "dark"
  hoverEffect?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "light", hoverEffect = false, initial, animate, transition, whileHover, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={initial}
        animate={animate}
        transition={transition}
        whileHover={whileHover !== undefined ? whileHover : hoverEffect ? { y: -2, transition: { duration: 0.2 } } : undefined}
        className={cn(
          "rounded-[1.75rem] p-6 transition-all duration-300",
          variant === "dark" ? "glass-card-dark" : "glass-card",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
GlassCard.displayName = "GlassCard"
