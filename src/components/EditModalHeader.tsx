import { useState, useRef, useEffect } from "react"
import { MoreVertical, Trash2, X } from "lucide-react"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"

export interface EditModalHeaderProps {
  title: string
  subtitle?: string
  onClose: () => void
  onRequestDelete?: () => void
  deleteLabel?: string
}

export function EditModalHeader({
  title,
  subtitle,
  onClose,
  onRequestDelete,
  deleteLabel = "Delete this record",
}: EditModalHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <>
      <BodyScrollLock />
      <div className="flex items-start justify-between mb-4 pb-2 border-b border-zinc-100">
      <div>
        <h2 className="text-xl font-black text-zinc-950 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs font-semibold text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* 3-Dot Options Dropdown Menu */}
        {onRequestDelete && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                isMenuOpen
                  ? "bg-zinc-100 border-zinc-300 text-zinc-950"
                  : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
              title="More Actions"
            >
              <MoreVertical className="size-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-zinc-200/90 py-1.5 z-50 text-xs font-bold animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onRequestDelete()
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-extrabold"
                >
                  <Trash2 className="size-3.5 text-rose-600" />
                  {deleteLabel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Close (X) Button */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors active:scale-95"
          title="Close modal"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
    </>
  )
}
