import React, { useRef, useState, useEffect, useCallback } from "react"

interface TableScrollWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * TableScrollWrapper renders an always-visible, interactive synchronized top horizontal
 * scrollbar track + thumb directly above column headers for instant desktop reach.
 * It supports mouse drag, track-click jumping, mouse wheel, and synchronized native scrolling.
 */
export function TableScrollWrapper({ children, className = "" }: TableScrollWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const [canScroll, setCanScroll] = useState(false)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [clientWidth, setClientWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)

  const updateMeasurements = useCallback(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const hasScroll = el.scrollWidth > el.clientWidth + 2
    setCanScroll(hasScroll)
    setScrollWidth(el.scrollWidth)
    setClientWidth(el.clientWidth)
    setScrollLeft(el.scrollLeft)
  }, [])

  useEffect(() => {
    updateMeasurements()
    const el = containerRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurements()
    })
    resizeObserver.observe(el)

    const table = el.querySelector("table")
    if (table) resizeObserver.observe(table)

    window.addEventListener("resize", updateMeasurements)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateMeasurements)
    }
  }, [updateMeasurements])

  const handleContainerScroll = () => {
    if (!containerRef.current) return
    setScrollLeft(containerRef.current.scrollLeft)
  }

  // Calculate thumb metrics
  const trackWidth = clientWidth || 1000
  const ratio = scrollWidth > 0 ? clientWidth / scrollWidth : 1
  const thumbWidth = Math.max(56, Math.min(trackWidth, trackWidth * ratio))
  const maxScroll = Math.max(0, scrollWidth - clientWidth)
  const maxThumbOffset = Math.max(1, trackWidth - thumbWidth)
  const thumbLeft = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbOffset : 0

  // Handle Track Click (jump directly to clicked position)
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !containerRef.current || maxScroll <= 0) return
    const rect = trackRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const targetPercentage = (clickX - thumbWidth / 2) / maxThumbOffset
    const newScroll = Math.max(0, Math.min(maxScroll, targetPercentage * maxScroll))
    containerRef.current.scrollTo({ left: newScroll, behavior: "smooth" })
  }

  // Handle Mouse Drag Start on Thumb
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartScrollLeft.current = containerRef.current ? containerRef.current.scrollLeft : 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current || maxThumbOffset <= 0) return
      const deltaX = moveEvent.clientX - dragStartX.current
      const scrollDelta = (deltaX / maxThumbOffset) * maxScroll
      containerRef.current.scrollLeft = Math.max(0, Math.min(maxScroll, dragStartScrollLeft.current + scrollDelta))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div className={`relative w-full overflow-hidden ${isDragging ? "select-none cursor-grabbing" : ""}`}>
      {/* Top Synchronized Horizontal Scrollbar (Always visible on desktop whenever table overflows) */}
      {canScroll && (
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="w-full relative h-[14px] bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 select-none cursor-pointer transition-colors hover:bg-emerald-100/70 dark:hover:bg-emerald-950/30 group"
          title="Click or drag to scroll horizontally across columns"
        >
          {/* Subtle guide track line */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[6px] bg-emerald-200/60 dark:bg-emerald-800/40 rounded-full pointer-events-none" />

          {/* Interactive Draggable Thumb */}
          <div
            onMouseDown={handleThumbMouseDown}
            style={{
              width: `${thumbWidth}px`,
              transform: `translateX(${thumbLeft}px)`,
            }}
            className={`absolute top-1/2 -translate-y-1/2 h-[10px] rounded-full transition-colors ${
              isDragging
                ? "bg-emerald-800 dark:bg-emerald-400 cursor-grabbing shadow-md"
                : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-grab shadow-xs"
            }`}
          >
            {/* Grab grip indicator dots */}
            <div className="w-full h-full flex items-center justify-center gap-1 opacity-80">
              <span className="size-1 rounded-full bg-white dark:bg-zinc-950" />
              <span className="size-1 rounded-full bg-white dark:bg-zinc-950" />
              <span className="size-1 rounded-full bg-white dark:bg-zinc-950" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        className={`overflow-x-auto table-scrollbar-x ${className}`}
        data-table-scroll
      >
        {children}
      </div>
    </div>
  )
}
