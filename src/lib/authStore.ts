import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Role = "superadmin" | "sales_manager" | "hr_manager" | "inventory_admin" | "finance_manager" | "hkc_docs_manager"

export interface User {
  id: string
  username: string
  roles: Role[]
  fullname: string
  warehouse_ids: string[]
}

interface AuthState {
  user: User | null
  token: string | null
  sessionExpiresAt: string | null
  login: (user: User, token: string, sessionExpiresAt?: string | null) => void
  refreshToken: (token: string, sessionExpiresAt?: string | null) => void
  setSessionExpiresAt: (expiresAt: string | null) => void
  logout: () => void
  isAuthenticated: () => boolean
}

/**
 * Returns remaining validity of JWT in seconds.
 */
export function getTokenTimeRemaining(token: string | null): number {
  if (!token || typeof token !== "string") return 0
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return 0
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const payload = JSON.parse(jsonPayload)
    if (!payload.exp) return 0
    return Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 1000))
  } catch {
    return 0
  }
}

/**
 * Calculates remaining session time in seconds based on BOTH JWT payload and verified database session expiry.
 * Always takes the stricter (smaller) of the two so that if a DB session was shortened or expires sooner,
 * the frontend respects the database session immediately.
 */
export function getEffectiveTimeRemaining(token: string | null, sessionExpiresAt?: string | null): number {
  const jwtRemaining = getTokenTimeRemaining(token)

  if (!sessionExpiresAt) {
    return jwtRemaining
  }

  const dbTime = new Date(sessionExpiresAt).getTime()
  if (isNaN(dbTime)) {
    return jwtRemaining
  }

  const dbRemaining = Math.max(0, Math.floor((dbTime - Date.now()) / 1000))

  if (jwtRemaining <= 0) return dbRemaining
  return Math.min(jwtRemaining, dbRemaining)
}

/**
 * Validates whether a JWT token string is structurally valid and unexpired.
 * Buffers 10 seconds before exact exp timestamp to avoid race conditions.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token || typeof token !== "string") return true
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return true

    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const payload = JSON.parse(jsonPayload)
    if (!payload.exp) return false

    // Expired if current time is within 10 seconds of expiry
    return Date.now() >= (payload.exp * 1000) - 10000
  } catch {
    return true
  }
}

let isHandlingExpiry = false
let expiryTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Proactively schedules a timer to trigger logout the second the JWT or database session expires.
 */
export function scheduleSessionExpiryTimer(token: string | null, sessionExpiresAt?: string | null) {
  if (expiryTimeout) {
    clearTimeout(expiryTimeout)
    expiryTimeout = null
  }
  if (!token) return

  const remainingSeconds = getEffectiveTimeRemaining(token, sessionExpiresAt)
  if (remainingSeconds <= 0) {
    handleAuthExpiry()
  } else {
    // Schedule auto-logout (capped at 32-bit max integer ~24.8 days)
    const timeoutMs = Math.min(Math.max(remainingSeconds * 1000, 1000), 2147483647)
    expiryTimeout = setTimeout(() => {
      handleAuthExpiry()
    }, timeoutMs)
  }
}

export function scheduleTokenExpiryTimer(token: string | null) {
  scheduleSessionExpiryTimer(token, useAuthStore.getState?.()?.sessionExpiresAt)
}

/**
 * Handles automatic logout when a token expires and immediately redirects to login page.
 */
export function handleAuthExpiry() {
  if (isHandlingExpiry) return
  isHandlingExpiry = true

  if (expiryTimeout) {
    clearTimeout(expiryTimeout)
    expiryTimeout = null
  }

  try {
    useAuthStore.getState().logout()
    localStorage.removeItem("auth-storage")
  } catch {}

  // Redirect to login page with expired flag and return path
  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname
    if (!currentPath.startsWith("/login")) {
      const fullPath = currentPath + window.location.search
      window.location.href = `/login?expired=1&from=${encodeURIComponent(fullPath)}`
    }
  }

  setTimeout(() => {
    isHandlingExpiry = false
  }, 1000)
}

function getInitialAuthState(): { user: User | null; token: string | null; sessionExpiresAt: string | null } {
  if (typeof window === "undefined") return { user: null, token: null, sessionExpiresAt: null }
  try {
    const raw = localStorage.getItem("auth-storage")
    if (raw) {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      const sessionExpiresAt = parsed?.state?.sessionExpiresAt || null
      if (token && typeof token === "string" && !isTokenExpired(token)) {
        return {
          user: parsed.state.user || null,
          token: token,
          sessionExpiresAt,
        }
      }
    }
  } catch {}
  return { user: null, token: null, sessionExpiresAt: null }
}

const initialAuth = getInitialAuthState()
if (initialAuth.token) {
  scheduleSessionExpiryTimer(initialAuth.token, initialAuth.sessionExpiresAt)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: initialAuth.user,
      token: initialAuth.token,
      sessionExpiresAt: initialAuth.sessionExpiresAt,
      login: (user: User, token: string, sessionExpiresAt?: string | null) => {
        set({ user, token, sessionExpiresAt: sessionExpiresAt || null })
        scheduleSessionExpiryTimer(token, sessionExpiresAt)
      },
      refreshToken: (token: string, sessionExpiresAt?: string | null) => {
        const effectiveExpires = sessionExpiresAt !== undefined ? sessionExpiresAt : get().sessionExpiresAt
        set({ token, sessionExpiresAt: effectiveExpires })
        scheduleSessionExpiryTimer(token, effectiveExpires)
      },
      setSessionExpiresAt: (expiresAt: string | null) => {
        set({ sessionExpiresAt: expiresAt })
        const token = get().token
        if (token) {
          scheduleSessionExpiryTimer(token, expiresAt)
        }
      },
      logout: () => {
        if (expiryTimeout) {
          clearTimeout(expiryTimeout)
          expiryTimeout = null
        }
        set({ user: null, token: null, sessionExpiresAt: null })
      },
      isAuthenticated: () => {
        const { token, sessionExpiresAt } = get()
        if (!token || isTokenExpired(token)) {
          if (token) {
            get().logout()
          }
          return false
        }
        if (sessionExpiresAt) {
          const dbTime = new Date(sessionExpiresAt).getTime()
          if (!isNaN(dbTime) && Date.now() >= dbTime) {
            get().logout()
            return false
          }
        }
        return true
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          if (isTokenExpired(state.token)) {
            state.logout()
          } else {
            scheduleSessionExpiryTimer(state.token, state.sessionExpiresAt)
          }
        }
      },
    }
  )
)

// Tab Re-focus Heartbeat: Verify session validity only when returning to an idle tab (throttled to 10s, NO interval polling)
if (typeof window !== "undefined") {
  let lastFocusCheck = 0

  const verifyOnTabReturn = async () => {
    const now = Date.now()
    if (now - lastFocusCheck < 10_000) return
    lastFocusCheck = now

    const token = useAuthStore.getState().token
    if (!token || isTokenExpired(token)) return
    try {
      const res = await fetch("/api/auth/session-status", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        handleAuthExpiry()
      } else if (res.ok) {
        const data = await res.json()
        if (data.expiresAt) {
          useAuthStore.getState().setSessionExpiresAt(data.expiresAt)
        }
      }
    } catch {}
  }

  window.addEventListener("focus", verifyOnTabReturn)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      verifyOnTabReturn()
    }
  })

  // Expose global helper on window for instant developer testing
  ;(window as any).__setTestSessionExpiry = async (minutes = 4) => {
    const token = useAuthStore.getState().token
    if (!token) {
      console.warn("Not logged in.")
      return
    }
    const res = await fetch("/api/auth/test-set-expiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ minutes }),
    })
    const data = await res.json()
    if (data.token) {
      useAuthStore.getState().refreshToken(data.token, data.expiresAt)
    } else if (data.expiresAt) {
      useAuthStore.getState().setSessionExpiresAt(data.expiresAt)
    }
    console.log(`[Test Session Expiry] set to ${minutes} minutes:`, data)
    return data
  }
}


