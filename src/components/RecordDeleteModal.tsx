import { useState, useEffect } from "react"
import { Trash2, X, ShieldAlert, ShieldCheck, Send, CheckCircle2, AlertCircle } from "lucide-react"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { useAuthStore } from "@/lib/authStore"
import { useFeedback } from "@/context/FeedbackContext"
import { checkRecordEligibility, submitDeletionRequest, type DeletionEligibility } from "@/lib/deletionStore"

export interface RecordDeleteModalProps {
  isOpen: boolean
  title: string
  recordId?: string
  recordName?: string
  description?: string
  isDeleting?: boolean
  resourceType?: string
  warehouseId?: string
  onClose: () => void
  onConfirmDelete: () => void | Promise<void>
  onRequestSubmitted?: (requestId: string) => void
}

export function RecordDeleteModal({
  isOpen,
  title,
  recordId,
  recordName,
  description = "This action is permanent and cannot be undone. All associated data will be removed from system registry.",
  isDeleting = false,
  resourceType,
  warehouseId,
  onClose,
  onConfirmDelete,
  onRequestSubmitted,
}: RecordDeleteModalProps) {
  const { user } = useAuthStore()
  const { showToast } = useFeedback()

  const userRoles = (user?.roles || ((user as any)?.role ? [(user as any).role] : [])).map((r: string) => String(r).toLowerCase())
  const isSuperadmin = userRoles.includes("superadmin")

  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null)
  const [requestReason, setRequestReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch guardrail eligibility whenever modal opens with a resourceType
  useEffect(() => {
    if (!isOpen) {
      setEligibility(null)
      setRequestReason("")
      setSubmitted(false)
      setSubmitError(null)
      setCheckingEligibility(false)
      return
    }

    if (resourceType && recordId) {
      let isMounted = true
      setCheckingEligibility(true)
      checkRecordEligibility(resourceType, recordId)
        .then((res) => {
          if (isMounted) setEligibility(res)
        })
        .catch((err) => {
          if (isMounted) {
            console.warn("[GUARDRAILS ELIGIBILITY CHECK FAILED]:", err.message)
            // Fallback to allow request submission
            setEligibility({ canDelete: true, isPermanentlyBlocked: false, reason: "Eligible" })
          }
        })
        .finally(() => {
          if (isMounted) setCheckingEligibility(false)
        })

      return () => {
        isMounted = false
      }
    } else {
      setEligibility(null)
      setCheckingEligibility(false)
    }
  }, [isOpen, resourceType, recordId])

  if (!isOpen) return null

  // Determine mode
  const isBlocked = eligibility !== null && !eligibility.canDelete
  const isRequestMode = !isSuperadmin && Boolean(resourceType) && !isBlocked

  const handleSubmitRequest = async () => {
    if (!resourceType || !recordId) return
    const trimmed = requestReason.trim()
    if (!trimmed || trimmed.length < 5) {
      setSubmitError("Please provide a valid reason (at least 5 characters) for requesting deletion.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await submitDeletionRequest({
        resource_type: resourceType,
        record_id: recordId,
        record_name: recordName || recordId,
        warehouse_id: warehouseId,
        reason: trimmed,
      })
      setSubmitted(true)
      showToast(
        "Deletion Request Submitted",
        "success",
        `Request for '${recordName || recordId}' has been sent to Superadmin.`
      )
      onRequestSubmitted?.(res.id)
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit deletion request.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <BodyScrollLock />
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-xs" />

      {/* Modal Card */}
      <div className="relative z-10 bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header Title & Close Button */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                <ShieldAlert className="size-5" />
              </div>
            ) : isRequestMode ? (
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                <ShieldCheck className="size-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                <Trash2 className="size-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-zinc-950 tracking-tight">
                {isBlocked ? "Deletion Prohibited" : isRequestMode ? "Request Deletion Approval" : title}
              </h3>
              <p className="text-[11px] font-semibold text-zinc-400">
                {isBlocked
                  ? "Audit Integrity Policy"
                  : isRequestMode
                  ? "Staff Governance Protocol"
                  : isSuperadmin
                  ? "Superadmin Authority"
                  : "Permanent Action"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0 -mr-1.5 -mt-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Loading Eligibility Check */}
        {checkingEligibility && (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <LoadingDots color="bg-zinc-700" size="md" />
            <span className="text-xs font-semibold">Verifying deletion guardrails...</span>
          </div>
        )}

        {/* Content Body */}
        {!checkingEligibility && (
          <>
            {/* Target Details Badge */}
            <div className="space-y-3 mb-5">
              {(recordId || recordName) && (
                <div
                  className={`p-3 rounded-2xl border text-xs font-semibold ${
                    isBlocked
                      ? "bg-rose-50/70 border-rose-200 text-rose-950"
                      : isRequestMode
                      ? "bg-amber-50/70 border-amber-200 text-amber-950"
                      : "bg-zinc-50 border-zinc-200 text-zinc-950"
                  }`}
                >
                  {recordId && (
                    <div className="font-mono font-bold text-[11px] opacity-75 mb-0.5">
                      ID: {recordId}
                    </div>
                  )}
                  {recordName && <div className="font-bold text-xs truncate">{recordName}</div>}
                </div>
              )}

              {/* Mode 1: BLOCKED (Record has sales / issued orders) */}
              {isBlocked && (
                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-700 uppercase tracking-wider">
                    <AlertCircle className="size-3.5" />
                    <span>Protected Record</span>
                  </div>
                  <p className="text-xs text-rose-900 font-medium leading-relaxed">
                    {eligibility?.reason}
                  </p>
                </div>
              )}

              {/* Mode 2: REQUEST MODE (Non-superadmin requesting deletion) */}
              {isRequestMode && (
                <div className="space-y-3">
                  {submitted ? (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                      <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
                      <div className="text-xs font-black text-emerald-900">Request Sent to Superadmin</div>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Your request has been queued. An administrator will review and authorize it.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/70">
                        <p className="text-xs text-amber-900 font-medium leading-relaxed">
                          Staff members cannot delete records directly. Please provide a reason to request approval from the Superadmin.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 block">
                          Reason for Deletion <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={requestReason}
                          onChange={(e) => {
                            setRequestReason(e.target.value)
                            if (submitError) setSubmitError(null)
                          }}
                          placeholder="e.g. Inbound receipt entered with duplicate batch number, wrong packaging unit, etc."
                          rows={3}
                          className="w-full text-xs font-medium p-3 rounded-2xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none placeholder:text-zinc-400"
                        />
                        {submitError && (
                          <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertCircle className="size-3" />
                            <span>{submitError}</span>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Mode 3: DIRECT MODE (Superadmin or unmanaged resource) */}
              {!isBlocked && !isRequestMode && (
                <div className="space-y-2">
                  {isSuperadmin && resourceType && (
                    <div className="px-2.5 py-1.5 bg-purple-50 rounded-xl border border-purple-200 text-[11px] font-bold text-purple-900 inline-block">
                      Superadmin Override: Direct Deletion Authorized
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed">{description}</p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              {isBlocked ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Understood
                </button>
              ) : isRequestMode ? (
                !submitted && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || requestReason.trim().length < 5}
                      onClick={handleSubmitRequest}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-md shadow-amber-600/20 transition-all cursor-pointer min-w-[140px]"
                    >
                      {isSubmitting ? (
                        <LoadingDots color="bg-white" size="sm" />
                      ) : (
                        <>
                          <Send className="size-3.5" />
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                  </>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onConfirmDelete}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-md shadow-rose-600/20 transition-all cursor-pointer min-w-[120px]"
                  >
                    {isDeleting ? (
                      <LoadingDots color="bg-white" size="sm" />
                    ) : (
                      <>
                        <Trash2 className="size-3.5" />
                        <span>Delete Record</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
