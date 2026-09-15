import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, ShieldAlert, LogOut, RefreshCw, AlertTriangle } from "lucide-react"
import { useAuthStore, getEffectiveTimeRemaining, handleAuthExpiry } from "@/lib/authStore"
import { useFeedback } from "@/context/FeedbackContext"
import { API_BASE } from "@/lib/apiPersistence"

export function SessionExpiryWarningModal() {
  const { showToast } = useFeedback()
  const token = useAuthStore((state) => state.token)
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt)
  const isOpen = useAuthStore((state) => state.showExpiryWarning)
  const setShowExpiryWarning = useAuthStore((state) => state.setShowExpiryWarning)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const setSessionExpiresAt = useAuthStore((state) => state.setSessionExpiresAt)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Live countdown timer ONLY runs when warning modal is actively open
  useEffect(() => {
    if (!isOpen || !token || !isAuthenticated) {
      setSecondsRemaining(null)
      return
    }

    const updateCountdown = () => {
      const remaining = getEffectiveTimeRemaining(token, sessionExpiresAt)
      if (remaining <= 0) {
        setShowExpiryWarning(false)
        handleAuthExpiry()
        return
      }
      setSecondsRemaining(remaining)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [isOpen, token, isAuthenticated, sessionExpiresAt, setShowExpiryWarning])

  const handleExtendSession = async () => {
    if (!token || isRefreshing) return
    setIsRefreshing(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok || !data.token) {
        throw new Error(data.error || "Failed to extend session.")
      }

      // Update token & db expiration in Zustand store and localStorage (reschedules 6h timers)
      refreshToken(data.token, data.expiresAt)
      if (data.expiresAt) {
        setSessionExpiresAt(data.expiresAt)
      }
      setShowExpiryWarning(false)
      showToast(
        "Session Extended",
        "success",
        "Your session has been extended for another 6 hours. You may continue working."
      )
    } catch (err: any) {
      showToast(
        "Session Extension Failed",
        "warning",
        err.message || "Please save your work immediately and log in again."
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleManualLogout = () => {
    setShowExpiryWarning(false)
    handleAuthExpiry()
  }

  // Format seconds to mm:ss
  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null || totalSeconds <= 0) return "00:00"
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-500/30 shadow-2xl p-6 select-none"
        >
          {/* Top Amber Status Bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="size-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-inner">
              <Clock className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Session Expiring Soon
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                  <ShieldAlert className="size-3" />
                  6h Policy
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Your session is about to expire due to security compliance.
              </p>
            </div>
          </div>

          {/* Countdown Clock Display */}
          <div className="my-5 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-medium">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <span>Time remaining before auto-logout:</span>
            </div>
            <div className="text-2xl font-black font-mono tracking-wider text-amber-600 dark:text-amber-400 bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs">
              {formatTime(secondsRemaining)}
            </div>
          </div>

          {/* Explanation */}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
            To protect your work, click <strong>Stay Signed In</strong> to extend your session for another 6 hours without interrupting your active page or forms.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={handleExtendSession}
              disabled={isRefreshing}
              className="w-full sm:flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Extending Session..." : "Stay Signed In (Extend 6h)"}</span>
            </button>
            <button
              onClick={handleManualLogout}
              disabled={isRefreshing}
              className="w-full sm:w-auto h-11 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
