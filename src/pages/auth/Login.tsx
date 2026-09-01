import { useState, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/lib/authStore"
import { API_BASE } from "@/lib/apiPersistence"
import { useFeedback } from "@/context/FeedbackContext"
import { KeyRound, User, Eye, EyeOff, AlertCircle } from "lucide-react"
import { LoadingDots } from "@/components/ui/LoadingDots"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { showToast } = useFeedback()
  const login = useAuthStore((state: any) => state.login)
  const navigate = useNavigate()
  const location = useLocation()

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const isSessionExpired = queryParams.get("expired") === "1" || location.state?.expired === true
  const fromParam = queryParams.get("from")
  const from = location.state?.from?.pathname || fromParam || "/"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Invalid username or password")
      }

      login(data.user, data.token)
      showToast("Login Successful", "success", `Welcome back, ${data.user.name || data.user.username}!`)
      
      const userRoles = data.user.roles || (data.user.role ? [data.user.role] : [])
      const primaryRole = userRoles[0]
      const getRoleHome = (role: string) => {
        switch (role) {
          case "sales_manager":
            return "/sales"
          case "hr_manager":
            return "/hr"
          case "inventory_admin":
            return "/inventory"
          case "finance_manager":
            return "/finance"
          case "hkc_docs_manager":
            return "/sales/hkc-docs"
          case "superadmin":
            return "/admin"
          default:
            return "/sales"
        }
      }

      if (from === "/" || from === "/login" || from === "/profile") {
        navigate(getRoleHome(primaryRole), { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (error: any) {
      showToast("Authentication Failed", "warning", error.message || "Invalid username or password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen page-gradient p-4 relative overflow-hidden">
      {/* Decorative organic blur blobs to enhance the liquid glass aesthetic */}
      <div className="absolute top-1/4 left-1/4 size-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 space-y-8 glass-card border border-white/60 shadow-xl relative z-10">
        <div className="text-center">
          <div className="flex items-center justify-center mb-3">
            <img
              src="/hkc_logo.png"
              alt="HKC Trading Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-black tracking-tight">HKC Trading</h2>
          <p className="mt-2 text-sm font-semibold text-zinc-500">Sign in to your dashboard</p>

          {isSessionExpired && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold flex items-center gap-2.5 text-left animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="size-4 shrink-0 text-amber-600" />
              <span>Your session has expired. Please sign in again to continue.</span>
            </div>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors placeholder-zinc-400"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-12 pr-12 py-3.5 text-sm font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors placeholder-zinc-400"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-650 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-700 transition-all active:scale-95 shadow-md disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingDots color="bg-white" size="md" />
              ) : (
                "Login"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
