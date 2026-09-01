import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { useAuthStore } from "@/lib/authStore"
import {
  ArrowLeft,
  LayoutDashboard,
  LogIn,
  Package,
  BadgeDollarSign,
  Users,
  ShoppingCart,
} from "lucide-react"

export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()

  const isAuth = isAuthenticated()
  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const primaryRole = userRoles[0]

  // Calculate default dashboard route based on user's primary role
  let homeRoute = "/sales"
  let roleLabel = "Dashboard"

  if (isAuth) {
    switch (primaryRole) {
      case "superadmin":
        homeRoute = "/admin"
        roleLabel = "Admin Control Center"
        break
      case "sales_manager":
        homeRoute = "/sales"
        roleLabel = "Sales Dashboard"
        break
      case "inventory_admin":
        homeRoute = "/inventory"
        roleLabel = "Inventory Register"
        break
      case "finance_manager":
        homeRoute = "/finance"
        roleLabel = "Finance Overview"
        break
      case "hr_manager":
        homeRoute = "/hr"
        roleLabel = "HR Management"
        break
      case "hkc_docs_manager":
        homeRoute = "/sales/hkc-docs"
        roleLabel = "HKC Export Docs"
        break
    }
  }

  return (
    <div className="min-h-screen page-gradient flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Decorative ambient blur background glow */}
      <div className="absolute top-1/4 left-1/3 size-96 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 size-96 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 size-72 rounded-full bg-zinc-200/40 blur-3xl pointer-events-none" />

      {/* Massive 404 Watermark Typography BEHIND Foreground Content */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-[220px] sm:text-[320px] md:text-[440px] font-black tracking-tighter leading-none select-none text-emerald-950/[0.04] dark:text-emerald-400/[0.05] font-mono pointer-events-none"
        >
          404
        </motion.div>
      </div>

      {/* Foreground Sheer Ultra-Transparent Container */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="p-8 sm:p-10 rounded-3xl bg-white/[0.07] backdrop-blur-[1px] flex flex-col items-center text-center">
          {/* Big HKC Logo (no background box wrapper) */}
          <div className="mb-6">
            <img
              src="/hkc_logo.png"
              alt="HKC Trading Logo"
              className="h-28 sm:h-36 md:h-40 w-auto object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mb-2">
            Page Lost in Transit
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-sm mb-2 leading-relaxed">
            The path <code className="px-2 py-0.5 rounded-md bg-white/80 border border-zinc-200/80 text-zinc-800 font-mono text-xs font-bold shadow-xs">{location.pathname}</code> does not exist or has been relocated.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mt-6">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:flex-1 h-11 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200/90 text-xs font-bold text-zinc-800 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Go Back</span>
            </button>

            {isAuth ? (
              <button
                onClick={() => navigate(homeRoute)}
                className="w-full sm:flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <LayoutDashboard className="size-4" />
                <span>{roleLabel}</span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="w-full sm:flex-1 h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <LogIn className="size-4" />
                <span>Login</span>
              </button>
            )}
          </div>

          {/* Permitted Modules Quick Navigation */}
          {isAuth && (
            <div className="w-full border-t border-zinc-200/50 pt-5 mt-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-2.5">
                Quick Navigation
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(primaryRole === "superadmin" || primaryRole === "sales_manager") && (
                  <button
                    onClick={() => navigate("/sales")}
                    className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-zinc-200/60 hover:border-emerald-300 flex flex-col items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
                  >
                    <ShoppingCart className="size-4 text-zinc-500 group-hover:text-emerald-700 transition-colors" />
                    <span className="font-bold text-[11px] text-zinc-700 group-hover:text-emerald-800">Sales</span>
                  </button>
                )}
                {(primaryRole === "superadmin" || primaryRole === "inventory_admin") && (
                  <button
                    onClick={() => navigate("/inventory")}
                    className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-zinc-200/60 hover:border-emerald-300 flex flex-col items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
                  >
                    <Package className="size-4 text-zinc-500 group-hover:text-emerald-700 transition-colors" />
                    <span className="font-bold text-[11px] text-zinc-700 group-hover:text-emerald-800">Inventory</span>
                  </button>
                )}
                {(primaryRole === "superadmin" || primaryRole === "finance_manager") && (
                  <button
                    onClick={() => navigate("/finance")}
                    className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-zinc-200/60 hover:border-emerald-300 flex flex-col items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
                  >
                    <BadgeDollarSign className="size-4 text-zinc-500 group-hover:text-emerald-700 transition-colors" />
                    <span className="font-bold text-[11px] text-zinc-700 group-hover:text-emerald-800">Finance</span>
                  </button>
                )}
                {(primaryRole === "superadmin" || primaryRole === "hr_manager") && (
                  <button
                    onClick={() => navigate("/hr")}
                    className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-zinc-200/60 hover:border-emerald-300 flex flex-col items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
                  >
                    <Users className="size-4 text-zinc-500 group-hover:text-emerald-700 transition-colors" />
                    <span className="font-bold text-[11px] text-zinc-700 group-hover:text-emerald-800">HR</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
