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
  login: (user: User, token: string) => void
  logout: () => void
  isAuthenticated: () => boolean
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
 * Proactively schedules a timer to trigger logout the second the JWT expires.
 */
export function scheduleTokenExpiryTimer(token: string | null) {
  if (expiryTimeout) {
    clearTimeout(expiryTimeout)
    expiryTimeout = null
  }
  if (!token) return

  try {
    const parts = token.split(".")
    if (parts.length !== 3) return
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const payload = JSON.parse(jsonPayload)
    if (!payload.exp) return

    const timeUntilExpiry = (payload.exp * 1000) - Date.now()
    if (timeUntilExpiry <= 0) {
      handleAuthExpiry()
    } else {
      // Schedule auto-logout (capped at 32-bit max integer ~24.8 days)
      const timeoutMs = Math.min(Math.max(timeUntilExpiry, 1000), 2147483647)
      expiryTimeout = setTimeout(() => {
        handleAuthExpiry()
      }, timeoutMs)
    }
  } catch {}
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

function getInitialAuthState(): { user: User | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null }
  try {
    const raw = localStorage.getItem("auth-storage")
    if (raw) {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      if (token && typeof token === "string" && !isTokenExpired(token)) {
        return {
          user: parsed.state.user || null,
          token: token,
        }
      }
    }
  } catch {}
  return { user: null, token: null }
}

const initialAuth = getInitialAuthState()
if (initialAuth.token) {
  scheduleTokenExpiryTimer(initialAuth.token)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: initialAuth.user,
      token: initialAuth.token,
      login: (user: User, token: string) => {
        set({ user, token })
        scheduleTokenExpiryTimer(token)
      },
      logout: () => {
        if (expiryTimeout) {
          clearTimeout(expiryTimeout)
          expiryTimeout = null
        }
        set({ user: null, token: null })
      },
      isAuthenticated: () => {
        const token = get().token
        if (!token || isTokenExpired(token)) {
          if (token) {
            get().logout()
          }
          return false
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
            scheduleTokenExpiryTimer(state.token)
          }
        }
      },
    }
  )
)

