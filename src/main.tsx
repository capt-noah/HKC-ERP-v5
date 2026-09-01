import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { FeedbackProvider } from "@/context/FeedbackContext.tsx"
import { useAuthStore, isTokenExpired, handleAuthExpiry } from "@/lib/authStore"
import { requestMonitor, evaluateRoleScoping } from "@/lib/requestMonitor"

// Intercept all fetch requests globally to inject the JWT auth header & handle 401/expired tokens
const originalFetch = window.fetch
window.fetch = async (input, init) => {
  const startTime = performance.now()
  const url = typeof input === "string" 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url

  const isApiRequest = url.includes("/api/")
  const isAuthLogin = url.includes("/api/auth/login")
  const method = init?.method || "GET"

  // Extract clean resource identifier (e.g. "inventory_products" from "/api/inventory_products?query=...")
  let resourceName = "api"
  if (isApiRequest) {
    const apiPart = url.split("/api/")[1] || ""
    resourceName = apiPart.split("?")[0].split("/")[0] || "api"
  }

  if (isApiRequest) {
    init = init || {}
    init.cache = "no-store"

    if (!isAuthLogin) {
      const token = useAuthStore.getState().token
      if (token) {
        // Proactively check if token is expired before dispatching request
        if (isTokenExpired(token)) {
          handleAuthExpiry()
          return new Response(JSON.stringify({ error: "Token expired", code: "TOKEN_EXPIRED" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (!init.headers) {
          init.headers = {}
        }
        if (init.headers instanceof Headers) {
          init.headers.set("Authorization", `Bearer ${token}`)
        } else if (Array.isArray(init.headers)) {
          init.headers.push(["Authorization", `Bearer ${token}`])
        } else {
          init.headers = {
            ...init.headers,
            Authorization: `Bearer ${token}`,
          }
        }
      }
    }
  }

  const response = await originalFetch(input, init)
  const durationMs = performance.now() - startTime

  // Record telemetry for all API calls
  if (isApiRequest) {
    const user = useAuthStore.getState().user
    const userRoles = user?.roles || []
    const roleStatus = evaluateRoleScoping(resourceName, userRoles)

    requestMonitor.recordRequest({
      url,
      resourceName,
      method,
      status: response.status,
      durationMs,
      timestamp: new Date().toISOString(),
      roleStatus,
      userRoles,
      initiatedBy: window.location.pathname,
    })
  }

  // React to 401 Unauthorized or Token Expiry responses by verifying token status before logging out
  if (isApiRequest && !isAuthLogin && (response.status === 401 || response.status === 403)) {
    try {
      const cloned = response.clone()
      const body = await cloned.json()
      const isTokenIssue =
        body?.code === "TOKEN_EXPIRED" ||
        (body?.error && /token|expired|invalid.*token|token missing/i.test(String(body.error)))

      if (isTokenIssue) {
        handleAuthExpiry()
      }
    } catch {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token")
      if (!token) {
        handleAuthExpiry()
      }
    }
  }

  return response
}

// Disable browser automatic scroll jumping on reload
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual"
  window.scrollTo(0, 0)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="light">
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
