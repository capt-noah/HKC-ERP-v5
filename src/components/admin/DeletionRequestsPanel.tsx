import { useState, useEffect, useMemo } from "react"
import {
  ShieldAlert,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  ShoppingCart,
  Receipt,
  Search,
  RefreshCw,
  FileText,
  Check,
  X,
  Filter,
} from "lucide-react"
import { useDeletionStore, type DeletionRequest } from "@/lib/deletionStore"
import { useFeedback } from "@/context/FeedbackContext"
import { GlassCard } from "@/components/GlassCard"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { cn } from "@/lib/utils"

export function DeletionRequestsPanel() {
  const { requests, isLoading, fetchRequests, approve, reject } = useDeletionStore()
  const { showToast } = useFeedback()

  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [resourceFilter, setResourceFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Action states
  const [actionTarget, setActionTarget] = useState<DeletionRequest | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && r.status.toUpperCase() !== statusFilter) {
        return false
      }

      // 2. Resource Filter
      if (resourceFilter !== "ALL" && r.resource_type.toLowerCase() !== resourceFilter.toLowerCase()) {
        return false
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = (r.record_name || "").toLowerCase().includes(q)
        const matchesId = (r.record_id || "").toLowerCase().includes(q)
        const matchesRequester = (r.requested_by_name || "").toLowerCase().includes(q)
        const matchesReason = (r.reason || "").toLowerCase().includes(q)
        return matchesName || matchesId || matchesRequester || matchesReason
      }

      return true
    })
  }, [requests, statusFilter, resourceFilter, searchQuery])

  const counts = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === "Pending").length
    const executed = requests.filter((r) => r.status === "Executed").length
    const rejected = requests.filter((r) => r.status === "Rejected").length
    return { total, pending, executed, rejected }
  }, [requests])

  const handleConfirmAction = async () => {
    if (!actionTarget || !actionType) return

    setIsProcessing(true)
    try {
      if (actionType === "approve") {
        const res = await approve(actionTarget.id)
        showToast(
          "Record Permanently Deleted",
          "success",
          res.message || `Record '${actionTarget.record_name}' deleted successfully.`
        )
      } else {
        const res = await reject(actionTarget.id, rejectReason.trim() || undefined)
        showToast(
          "Deletion Request Rejected",
          "info",
          res.message || `Request for '${actionTarget.record_name}' was rejected.`
        )
      }
      setActionTarget(null)
      setActionType(null)
      setRejectReason("")
    } catch (err: any) {
      showToast(
        "Action Failed",
        "warning",
        err.message || "Failed to process deletion request."
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const getResourceIcon = (resType: string) => {
    const norm = resType.toLowerCase()
    if (norm.includes("product") || norm.includes("batch")) return Package
    if (norm.includes("sales_order")) return ShoppingCart
    if (norm.includes("purchase_order")) return Receipt
    return FileText
  }

  const getResourceLabel = (resType: string) => {
    const norm = resType.toLowerCase()
    if (norm === "pharma_products") return "Pharma Stock Item"
    if (norm === "export_products") return "Export Commodity"
    if (norm === "pharma_product_batches") return "Stock Batch"
    if (norm === "sales_orders") return "Sales Order"
    if (norm === "purchase_orders") return "Purchase Order"
    return resType
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center justify-between border-black/5 bg-white/70">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">All Deletion Requests</p>
            <p className="text-2xl font-black text-zinc-950 mt-1">{counts.total}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-zinc-100 text-zinc-700">
            <ShieldAlert className="size-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between border-amber-200 bg-amber-50/60">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Awaiting Superadmin</p>
            <p className="text-2xl font-black text-amber-950 mt-1">{counts.pending}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800">
            <Clock className="size-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between border-emerald-200 bg-emerald-50/60">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Executed & Purged</p>
            <p className="text-2xl font-black text-emerald-950 mt-1">{counts.executed}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="size-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between border-rose-200 bg-rose-50/60">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Rejected Requests</p>
            <p className="text-2xl font-black text-rose-950 mt-1">{counts.rejected}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-800">
            <XCircle className="size-5" />
          </div>
        </GlassCard>
      </div>

      {/* 2. Control Toolbar */}
      <GlassCard className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by record name, ID, staff member or reason..."
              className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-zinc-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Filter Buttons */}
            <div className="inline-flex rounded-xl p-1 bg-zinc-100 border border-zinc-200/60">
              {[
                { key: "ALL", label: "All" },
                { key: "PENDING", label: `Pending (${counts.pending})` },
                { key: "EXECUTED", label: "Executed" },
                { key: "REJECTED", label: "Rejected" },
              ].map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setStatusFilter(pill.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    statusFilter === pill.key
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchRequests()}
              disabled={isLoading}
              title="Refresh requests"
              className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
            >
              <RefreshCw className={cn("size-4", isLoading && "animate-spin text-zinc-900")} />
            </button>
          </div>
        </div>

        {/* Resource Category Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="size-3" />
            Resource:
          </span>
          {[
            { key: "ALL", label: "All Resources" },
            { key: "pharma_products", label: "Pharma Items" },
            { key: "export_products", label: "Export Commodities" },
            { key: "pharma_product_batches", label: "Stock Batches" },
            { key: "sales_orders", label: "Sales Orders" },
            { key: "purchase_orders", label: "Purchase Orders" },
          ].map((res) => (
            <button
              key={res.key}
              onClick={() => setResourceFilter(res.key)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer",
                resourceFilter === res.key
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              {res.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 3. Requests Table / List */}
      <GlassCard className="p-0 overflow-hidden">
        {isLoading && requests.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <LoadingDots color="bg-zinc-900" size="md" />
            <span className="text-xs font-semibold">Loading deletion requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ShieldAlert className="size-8 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-700">No Deletion Requests Found</p>
            <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
              There are currently no deletion requests matching your search query or filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Target Record</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Reason / Justification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredRequests.map((req) => {
                  const ResIcon = getResourceIcon(req.resource_type)
                  const isPending = req.status === "Pending"
                  const isExecuted = req.status === "Executed"
                  const isRejected = req.status === "Rejected"

                  return (
                    <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors">
                      {/* Status */}
                      <td className="py-3.5 px-4 align-top shrink-0">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="size-3" />
                            Pending
                          </span>
                        )}
                        {isExecuted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            <Check className="size-3" />
                            Executed
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-200">
                            <X className="size-3" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Resource */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                            <ResIcon className="size-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-zinc-950 text-xs">
                              {getResourceLabel(req.resource_type)}
                            </div>
                            {req.warehouse_id && (
                              <div className="text-[10px] font-medium text-zinc-400">
                                {req.warehouse_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Target Record */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-zinc-900">{req.record_name}</div>
                        <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                          ID: {req.record_id}
                        </div>
                      </td>

                      {/* Requested By */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-zinc-800">{req.requested_by_name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-700 text-xs italic font-medium leading-relaxed">
                          "{req.reason}"
                        </div>
                        {req.rejection_reason && (
                          <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-medium">
                            <span className="font-bold">Rejection Note:</span> {req.rejection_reason}
                          </div>
                        )}
                        {req.reviewed_by && (
                          <div className="text-[10px] text-zinc-400 mt-1">
                            Reviewed by <span className="font-semibold text-zinc-600">{req.reviewed_by}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right shrink-0">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setActionTarget(req)
                                setActionType("approve")
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                              title="Approve and permanently delete record"
                            >
                              <Trash2 className="size-3" />
                              <span>Approve & Delete</span>
                            </button>
                            <button
                              onClick={() => {
                                setActionTarget(req)
                                setActionType("reject")
                                setRejectReason("")
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 text-xs font-bold transition-colors cursor-pointer"
                              title="Reject request"
                            >
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-zinc-400 italic">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* 4. Action Confirmation Modal */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div
            onClick={() => {
              if (!isProcessing) {
                setActionTarget(null)
                setActionType(null)
              }
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          <div className="relative z-10 bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-2 rounded-xl",
                    actionType === "approve" ? "bg-rose-100 text-rose-600" : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {actionType === "approve" ? <Trash2 className="size-5" /> : <XCircle className="size-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950">
                    {actionType === "approve" ? "Confirm Permanent Deletion" : "Reject Deletion Request"}
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    Superadmin Authorization
                  </p>
                </div>
              </div>
              <button
                disabled={isProcessing}
                onClick={() => {
                  setActionTarget(null)
                  setActionType(null)
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs">
                <div className="font-bold text-zinc-900">{actionTarget.record_name}</div>
                <div className="font-mono text-[10px] text-zinc-500 mt-0.5">
                  Type: {getResourceLabel(actionTarget.resource_type)} • ID: {actionTarget.record_id}
                </div>
                <div className="mt-2 text-[11px] text-zinc-600 italic">
                  Requester: <span className="font-semibold text-zinc-800">{actionTarget.requested_by_name}</span> ("{actionTarget.reason}")
                </div>
              </div>

              {actionType === "approve" ? (
                <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 text-xs text-rose-900 leading-relaxed font-medium">
                  Approving this request will <strong>permanently purge</strong> this record from the database. This action is irreversible.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 block">Rejection Reason (Optional):</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide context on why this deletion request was denied..."
                    rows={2}
                    className="w-full text-xs font-medium p-3 rounded-2xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none placeholder:text-zinc-400"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setActionTarget(null)
                  setActionType(null)
                }}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmAction}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md transition-all cursor-pointer min-w-[130px]",
                  actionType === "approve"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : "bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/20"
                )}
              >
                {isProcessing ? (
                  <LoadingDots color="bg-white" size="sm" />
                ) : actionType === "approve" ? (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Authorize Delete</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5" />
                    <span>Confirm Reject</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
