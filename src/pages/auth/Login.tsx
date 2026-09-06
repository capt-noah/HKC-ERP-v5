import { useState, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/lib/authStore"
import { API_BASE } from "@/lib/apiPersistence"
import { useFeedback } from "@/context/FeedbackContext"
import { KeyRound, User, Eye, EyeOff, AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react"
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

  // Recovery State
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showRecoveryKey, setShowRecoveryKey] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [recovering, setRecovering] = useState(false)

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

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      showToast("Username Required", "warning", "Please enter your Superadmin username.")
      return
    }
    if (!recoveryKey.trim()) {
      showToast("Recovery Key Required", "warning", "Please enter the Master Recovery Key.")
      return
    }
    if (newPassword.length < 6) {
      showToast("Password Too Short", "warning", "New password must be at least 6 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords Mismatch", "warning", "New password and confirmation do not match.")
      return
    }

    setRecovering(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/recover-superadmin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          recoveryKey: recoveryKey.trim(),
          newPassword,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Password recovery failed.")
      }

      showToast("Password Reset Successful", "success", "Your Superadmin password has been updated. Please log in.")
      setPassword("")
      setRecoveryKey("")
      setNewPassword("")
      setConfirmPassword("")
      setIsRecovering(false)
    } catch (err: any) {
      showToast("Recovery Failed", "warning", err.message || "Could not reset password with provided key.")
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen page-gradient p-4 relative overflow-hidden">
      {/* Decorative organic blur blobs to enhance the liquid glass aesthetic */}
      <div className="absolute top-1/4 left-1/4 size-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 space-y-7 glass-card border border-white/60 shadow-xl relative z-10">
        <div className="text-center">
          <div className="flex items-center justify-center mb-3">
            <img
              src="/hkc_logo.png"
              alt="HKC Trading Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-black tracking-tight">HKC Trading</h2>
          <p className="mt-1.5 text-xs font-bold text-zinc-500">
            {isRecovering ? "Superadmin Password Recovery" : "Sign in to your dashboard"}
          </p>

          {isSessionExpired && !isRecovering && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold flex items-center gap-2.5 text-left animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="size-4 shrink-0 text-amber-600" />
              <span>Your session has expired. Please sign in again to continue.</span>
            </div>
          )}
        </div>

        {!isRecovering ? (
          /* Standard Login Form */
          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Username</label>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">Password</label>
                  <button
                    type="button"
                    onClick={() => setIsRecovering(true)}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
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
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-650 transition-colors cursor-pointer"
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
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-700 transition-all active:scale-95 shadow-md disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <LoadingDots color="bg-white" size="md" />
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Superadmin Master Key Recovery Form */
          <form className="space-y-4" onSubmit={handleRecoverySubmit}>
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs font-semibold text-emerald-950 flex items-start gap-2.5">
              <ShieldAlert className="size-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Enter your Superadmin username and Master Recovery Key to reset your access credentials.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Superadmin Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-12 pr-4 py-3 text-xs font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Master Recovery Key</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type={showRecoveryKey ? "text" : "password"}
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-12 pr-12 py-3 text-xs font-mono font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors"
                  placeholder="Enter master recovery key"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  {showRecoveryKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase tracking-wider mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-3.5 py-3 text-xs font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-3.5 py-3 text-xs font-semibold text-black outline-none focus:border-green-750 focus:bg-white transition-colors"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={recovering}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent text-xs font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all active:scale-95 shadow-md disabled:opacity-70 cursor-pointer"
              >
                {recovering ? (
                  <LoadingDots color="bg-white" size="md" />
                ) : (
                  "Reset Superadmin Password"
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsRecovering(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" /> Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
