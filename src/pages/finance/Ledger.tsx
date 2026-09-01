import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  Plus, 
  ChevronRight, 
  FileText, 
  ChevronDown, 
  X,
  RotateCcw,
  CheckCircle2,
  FolderTree,
  Folder,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Edit,
  MoreVertical,
  Trash2,
  AlertTriangle,
  Download,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore, type JournalEntry } from "@/lib/financeStore"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { 
  exportPeachtreeGeneralJournal, 
  exportPeachtreeChartOfAccounts,
  isDateInPreset,
} from "@/lib/peachtreeExportUtils"

import { Skeleton } from "@/components/ui/skeleton"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

export default function Ledger() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  const [activeTab, setActiveTab] = useState<"Entries" | "Chart">("Entries")

  // Store data
  const entries = store.getJournalEntries()
  const lines = store.getJournalEntryLines()
  const accounts = store.getAccounts()

  const [searchEntries, setSearchEntries] = useState("")
  const [jeDateFilter, setJeDateFilter] = useState("ALL")
  const [jeCustomStart, setJeCustomStart] = useState("")
  const [jeCustomEnd, setJeCustomEnd] = useState("")
  const [jeSourceFilter, setJeSourceFilter] = useState("ALL")

  // Journal Entries Column Resizing & Sorting State
  const defaultJeColWidths: Record<string, number> = {
    id: 110,
    entry_date: 115,
    description: 180,
    account_lines: 200,
    party: 150,
    debit_amount: 125,
    credit_amount: 125,
    source_type: 130,
    actions: 100,
  }

  const [jeColWidths, setJeColWidths] = useState<Record<string, number>>(defaultJeColWidths)
  const [jeSortKey, setJeSortKey] = useState<string | null>(null)
  const [jeSortDir, setJeSortDir] = useState<"asc" | "desc">("asc")
  const [openJeSortMenuCol, setOpenJeSortMenuCol] = useState<string | null>(null)

  const handleJeResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = jeColWidths[colKey] || 120

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(65, startWidth + deltaX)
      setJeColWidths((prev) => ({ ...prev, [colKey]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const jeColumns: { key: string; label: string; align?: "left" | "right" | "center" }[] = [
    { key: "id", label: "JE ID", align: "left" },
    { key: "entry_date", label: "Posting Date", align: "left" },
    { key: "description", label: "Description", align: "left" },
    { key: "account_lines", label: "Account Lines", align: "left" },
    { key: "party", label: "Party", align: "left" },
    { key: "debit_amount", label: "Debit (ETB)", align: "right" },
    { key: "credit_amount", label: "Credit (ETB)", align: "right" },
    { key: "source_type", label: "Voucher Type", align: "center" },
    { key: "actions", label: "Actions", align: "right" },
  ]
  
  // COA state
  const [coaSearch, setCoaSearch] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    Asset: true,
    Liability: true,
    Equity: true,
    Revenue: true,
    Expense: true,
    "1100": true,
    "1400": true,
    "2050": true,
    "3050": true,
    "4050": true,
    "5050": true,
    "5150": true,
  })
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [showAddChildModal, setShowAddChildModal] = useState(false)
  const [childParentAccount, setChildParentAccount] = useState<any>(null)
  const [newAccCode, setNewAccCode] = useState("")
  const [newAccName, setNewAccName] = useState("")
  const [newAccType, setNewAccType] = useState<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense">("Asset")
  const [newAccParent, setNewAccParent] = useState<string>("")
  const [newAccIsGroup, setNewAccIsGroup] = useState(false)

  // Filter Mode
  const [coaFilterMode, setCoaFilterMode] = useState<"ALL" | "AR" | "AP">("ALL")

  // Edit Account state
  const [showEditAccountModal, setShowEditAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const [editAccCode, setEditAccCode] = useState("")
  const [editAccName, setEditAccName] = useState("")
  const [editAccType, setEditAccType] = useState<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense">("Asset")
  const [editAccParent, setEditAccParent] = useState("")
  const [editAccIsGroup, setEditAccIsGroup] = useState(false)
  const [editAccIsActive, setEditAccIsActive] = useState(true)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  // Posting modal state
  const todayStr = new Date().toISOString().split("T")[0]
  const [showPostModal, setShowPostModal] = useState(false)
  const [newDate, setNewDate] = useState(todayStr)
  const [newDesc, setNewDesc] = useState("")
  const [newSourceType, setNewSourceType] = useState<JournalEntry["source_type"]>("Manual Adjustment")
  const [newSourceId, setNewSourceId] = useState(`JV-${Date.now().toString().slice(-4)}`)
  const newCurrency = "ETB"

  const [formLines, setFormLines] = useState<Array<{
    account_id: string
    debit: string
    credit: string
    party_type: "Customer" | "Supplier" | "Employee" | ""
    party_id: string
    party_name: string
  }>>([
    { account_id: accounts.find((a) => a.is_active)?.id || "", debit: "", credit: "", party_type: "", party_id: "", party_name: "" },
    { account_id: accounts.filter((a) => a.is_active)[1]?.id || "", debit: "", credit: "", party_type: "", party_id: "", party_name: "" },
  ])

  // Reversal computation
  const reversedEntryIds = new Set(
    entries
      .map((e) => e.is_reversal_of)
      .filter((id): id is string => id !== null && id !== undefined)
  )

  // Handlers
  const handlePostEntry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDesc.trim()) {
      showToast("Validation Error", "warning", "Please provide an accounting description.")
      return
    }

    const payloadLines = formLines.map((l) => ({
      account_id: l.account_id,
      debit_amount: parseFloat(l.debit) || 0,
      credit_amount: parseFloat(l.credit) || 0,
      party_type: l.party_type ? (l.party_type as any) : null,
      party_id: l.party_id || (l.party_name ? `PARTY-${l.party_name.replace(/\s+/g, "").toUpperCase()}` : null),
      party_name: l.party_name || null,
    }))

    const result = store.postJournalEntry(
      {
        entry_date: newDate,
        description: newDesc,
        source_type: newSourceType,
        source_id: newSourceId,
        created_by: "Senior Accountant",
        currency: newCurrency,
        exchange_rate: 1.0,
      },
      payloadLines
    )

    if (!result.success) {
      showToast("Posting Blocked", "warning", result.error || "Validation error.")
      return
    }

    setShowPostModal(false)
    setNewDesc("")
    setFormLines([
      { account_id: accounts.find((a) => a.is_active)?.id || "", debit: "", credit: "", party_type: "", party_id: "", party_name: "" },
      { account_id: accounts.filter((a) => a.is_active)[1]?.id || "", debit: "", credit: "", party_type: "", party_id: "", party_name: "" },
    ])

    if (result.autoRounded) {
      showToast(
        "Journal Entry Posted",
        "info",
        `Entry ${result.entry?.id} posted with auto-round off line of ETB ${result.roundOffAmount?.toFixed(2)}.`
      )
    } else {
      showToast("Journal Entry Posted", "success", `Entry ${result.entry?.id} posted to General Ledger.`)
    }
  }

  const handleReverseEntry = (entryId: string, lineId?: string) => {
    const res = store.reverseJournalEntry(entryId, lineId)
    if (res.success) {
      showToast(
        "Reversal Journal Entry Created",
        "success",
        `Created entry ${res.reversalEntry?.id} reversing ${lineId ? "line " + lineId : entryId}.`
      )
    } else {
      showToast("Reversal Failed", "warning", res.error || "Could not reverse entry.")
    }
  }

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccCode.trim() || !newAccName.trim()) {
      showToast("Validation Error", "warning", "Code and Name are required.")
      return
    }
    const res = store.addAccount({
      code: newAccCode,
      name: newAccName,
      account_type: newAccType,
      parent_account_id: newAccParent || null,
      is_active: true,
      is_group: newAccIsGroup,
    })
    if (res.success) {
      setShowAddAccountModal(false)
      setNewAccCode("")
      setNewAccName("")
      setNewAccParent("")
      setNewAccIsGroup(false)
      showToast("Account Created", "success", `Account ${newAccCode} - ${newAccName} added to Chart of Accounts.`)
    } else {
      showToast("Account Creation Failed", "warning", res.error || "Could not create account.")
    }
  }

  const handleCreateChildAccount = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccCode.trim() || !newAccName.trim()) {
      showToast("Validation Error", "warning", "Account Code and Name are required.")
      return
    }
    const res = store.addAccount({
      code: newAccCode.trim(),
      name: newAccName.trim(),
      account_type: newAccType,
      parent_account_id: childParentAccount?.id || newAccParent || null,
      is_active: true,
      is_group: newAccIsGroup,
    })
    if (res.success) {
      setShowAddChildModal(false)
      setChildParentAccount(null)
      setNewAccCode("")
      setNewAccName("")
      setNewAccParent("")
      setNewAccIsGroup(false)
      showToast("Sub-Account Created", "success", `Sub-Account ${newAccCode} - ${newAccName} added to Chart of Accounts.`)
    } else {
      showToast("Sub-Account Creation Failed", "warning", res.error || "Could not create sub-account.")
    }
  }

  const handleUpdateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAccount) return
    if (!editAccCode.trim() || !editAccName.trim()) {
      showToast("Validation Error", "warning", "Code and Name are required.")
      return
    }

    const res = store.updateAccount(editingAccount.id, {
      code: editAccCode,
      name: editAccName,
      account_type: editAccType,
      parent_account_id: editAccParent || null,
      is_group: editAccIsGroup,
      is_active: editAccIsActive,
    })

    if (res.success) {
      setShowEditAccountModal(false)
      setEditingAccount(null)
      showToast("Account Updated", "success", `Account ${editAccCode} - ${editAccName} successfully updated.`)
    } else {
      showToast("Account Update Failed", "warning", res.error || "Could not update account.")
    }
  }

  const handleConfirmDelete = () => {
    if (!editingAccount) return
    const res = store.deleteAccount(editingAccount.id)
    if (res.success) {
      setShowDeleteConfirmModal(false)
      setShowEditAccountModal(false)
      setEditingAccount(null)
      setEditMenuOpen(false)
      showToast("Account Deleted", "success", `Account ${editingAccount.code} has been deleted.`)
    } else {
      setShowDeleteConfirmModal(false)
      showToast("Account Deletion Failed", "warning", res.error || "Could not delete account with active transactions.")
    }
  }

  // Filter entries
  const filteredEntries = entries.filter((ent) => {
    if (!isDateInPreset(ent.entry_date, jeDateFilter, jeCustomStart, jeCustomEnd)) return false
    if (jeSourceFilter !== "ALL" && ent.source_type !== jeSourceFilter) return false
    const q = (searchEntries || "").toLowerCase()
    const desc = (ent.description || "").toLowerCase()
    const entId = (ent.id || "").toLowerCase()
    const srcId = (ent.source_id || "").toLowerCase()
    return desc.includes(q) || entId.includes(q) || srcId.includes(q)
  })

  const jeSourceTypes = Array.from(new Set(entries.map((e) => e.source_type)))

  // Sort entries
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (jeSortKey) {
      const entryLinesA = lines.filter((l) => l.journal_entry_id === a.id)
      const entryLinesB = lines.filter((l) => l.journal_entry_id === b.id)
      const totalDebitA = entryLinesA.reduce((s, l) => s + l.debit_amount, 0)
      const totalDebitB = entryLinesB.reduce((s, l) => s + l.debit_amount, 0)
      const totalCreditA = entryLinesA.reduce((s, l) => s + l.credit_amount, 0)
      const totalCreditB = entryLinesB.reduce((s, l) => s + l.credit_amount, 0)

      let valA: any = ""
      let valB: any = ""

      if (jeSortKey === "id") {
        valA = a.id
        valB = b.id
      } else if (jeSortKey === "entry_date") {
        valA = a.entry_date
        valB = b.entry_date
      } else if (jeSortKey === "description") {
        valA = a.description || ""
        valB = b.description || ""
      } else if (jeSortKey === "account_lines") {
        valA = entryLinesA.map((l) => l.account_id).join(",")
        valB = entryLinesB.map((l) => l.account_id).join(",")
      } else if (jeSortKey === "party") {
        valA = entryLinesA.map((l) => l.party_name || "").filter(Boolean).join(",")
        valB = entryLinesB.map((l) => l.party_name || "").filter(Boolean).join(",")
      } else if (jeSortKey === "debit_amount") {
        valA = totalDebitA
        valB = totalDebitB
      } else if (jeSortKey === "credit_amount") {
        valA = totalCreditA
        valB = totalCreditB
      } else if (jeSortKey === "source_type") {
        valA = a.source_type || ""
        valB = b.source_type || ""
      }

      if (typeof valA === "number" && typeof valB === "number") {
        if (valA !== valB) {
          return jeSortDir === "asc" ? valA - valB : valB - valA
        }
      } else if (typeof valA === "string" && typeof valB === "string") {
        const comp = valA.localeCompare(valB)
        if (comp !== 0) {
          return jeSortDir === "asc" ? comp : -comp
        }
      }
    }
    return 0
  })

  const [jePage, setJePage] = useState(1)
  const [jePageSize, setJePageSize] = useState(10)

  useEffect(() => {
    setJePage(1)
  }, [searchEntries, jeSourceFilter, jeDateFilter, filteredEntries.length])

  const totalJePages = Math.max(1, Math.ceil(sortedEntries.length / jePageSize))
  const displayedEntries = sortedEntries.slice((jePage - 1) * jePageSize, jePage * jePageSize)

  // COA Tree Helpers
  const isRootCategoryDummy = (a: any) => {
    return (
      (a.code === "1000" && a.name.toLowerCase() === "assets") ||
      (a.code === "2000" && a.name.toLowerCase() === "liabilities") ||
      (a.code === "3000" && a.name.toLowerCase() === "equity") ||
      (a.code === "4000" && (a.name.toLowerCase().includes("income") || a.name.toLowerCase().includes("revenue"))) ||
      (a.code === "5000" && a.name.toLowerCase() === "expenses" && a.is_group === true)
    )
  }

  const isChildOf = (child: any, parent: any) => {
    if (!child.parent_account_id || child.id === parent.id) return false
    const pId = parent.id
    const pCode = parent.code
    const cParent = child.parent_account_id
    return (
      cParent === pId ||
      cParent === pCode ||
      cParent === `ACC-${pCode}` ||
      (pId.startsWith("ACC-") && cParent === pId.replace("ACC-", ""))
    )
  }

  const getChildrenOfAccount = (parent: any) => {
    if (isRootCategoryDummy(parent)) return []
    return accounts.filter((a) => !isRootCategoryDummy(a) && isChildOf(a, parent))
  }

  const isGroupAccount = (acc: any) => {
    if (acc.is_group === true) return true
    return getChildrenOfAccount(acc).length > 0
  }

  const getAccountNetBalance = (acc: any) => {
    const accLines = lines.filter((l) => l.account_id === acc.id || l.account_id === acc.code || l.account_id === `ACC-${acc.code}`)
    const debitSum = accLines.reduce((s, l) => s + l.debit_amount, 0)
    const creditSum = accLines.reduce((s, l) => s + l.credit_amount, 0)
    if (acc.account_type === "Asset" || acc.account_type === "Expense") {
      return debitSum - creditSum
    }
    return creditSum - debitSum
  }

  const getGroupNetBalance = (acc: any): number => {
    let sum = getAccountNetBalance(acc)
    const children = getChildrenOfAccount(acc)
    for (const child of children) {
      if (isGroupAccount(child)) {
        sum += getGroupNetBalance(child)
      } else {
        sum += getAccountNetBalance(child)
      }
    }
    return sum
  }

  // Root category definitions mapping cleanly to company COA
  const coaRootCategories = [
    { key: "Asset", title: "Assets (1000s)", code: "1", color: "emerald", filter: (a: any) => a.account_type === "Asset" },
    { key: "Liability", title: "Liabilities (2000s)", code: "2", color: "amber", filter: (a: any) => a.account_type === "Liability" },
    { key: "Equity", title: "Equity & Capital (3000s)", code: "3", color: "purple", filter: (a: any) => a.account_type === "Equity" },
    { key: "Revenue", title: "Income & Revenue (4000s)", code: "4", color: "teal", filter: (a: any) => a.account_type === "Revenue" },
    { key: "COGS", title: "Cost of Sales / Selling & Distribution (6000s)", code: "6", color: "orange", filter: (a: any) => a.account_type === "Expense" && (a.code.startsWith("6") || a.id.startsWith("6") || a.peachtree_type === "Cost of Sales") },
    { key: "AdminExpense", title: "Administrative & General Expenses (8000s)", code: "8", color: "rose", filter: (a: any) => a.account_type === "Expense" && !(a.code.startsWith("6") || a.id.startsWith("6") || a.peachtree_type === "Cost of Sales") },
  ]

  const getTopLevelAccountsForCategory = (catKey: string) => {
    const cat = coaRootCategories.find((c) => c.key === catKey)
    if (!cat) return []
    return accounts.filter((a) => {
      if (!cat.filter(a)) return false
      if (isRootCategoryDummy(a)) return false

      if (!a.parent_account_id) return true

      const parentAcc = accounts.find(
        (p) => p.id === a.parent_account_id || p.code === a.parent_account_id || `ACC-${p.code}` === a.parent_account_id
      )
      if (!parentAcc) return true
      if (isRootCategoryDummy(parentAcc)) return true
      if (!cat.filter(parentAcc)) return true

      return false
    })
  }

  const renderAccountTreeNode = (acc: any, level = 1) => {
    const isGroup = isGroupAccount(acc)
    const children = getChildrenOfAccount(acc)
    const nodeKey = acc.code || acc.id
    const isExpanded = !!expandedNodes[nodeKey] || coaSearch.trim().length > 0
    const netBalance = isGroup ? getGroupNetBalance(acc) : getAccountNetBalance(acc)

    // AR / AP Filter Mode Check
    if (coaFilterMode === "AR") {
      const isArMatch =
        acc.code.startsWith("11") ||
        acc.code.startsWith("12") ||
        acc.code.startsWith("13") ||
        acc.code.startsWith("4") ||
        acc.peachtree_type === "Accounts Receivable" ||
        acc.peachtree_type === "Income" ||
        acc.name.toLowerCase().includes("receivable") ||
        acc.name.toLowerCase().includes("sales")
      const childHasAr = children.some((c: any) =>
        c.code.startsWith("11") ||
        c.code.startsWith("12") ||
        c.code.startsWith("13") ||
        c.code.startsWith("4") ||
        c.peachtree_type === "Accounts Receivable" ||
        c.peachtree_type === "Income" ||
        c.name.toLowerCase().includes("receivable") ||
        c.name.toLowerCase().includes("sales")
      )
      if (!isArMatch && !childHasAr) return null
    }

    if (coaFilterMode === "AP") {
      const isApMatch =
        acc.code.startsWith("20") ||
        acc.code.startsWith("21") ||
        acc.code.startsWith("60") ||
        acc.code.startsWith("80") ||
        acc.peachtree_type === "Other Current Liabilities" ||
        acc.peachtree_type === "Cost of Sales" ||
        acc.peachtree_type === "Expenses" ||
        acc.name.toLowerCase().includes("payable") ||
        acc.name.toLowerCase().includes("accrual") ||
        acc.name.toLowerCase().includes("expense") ||
        acc.name.toLowerCase().includes("cost")
      const childHasAp = children.some((c: any) =>
        c.code.startsWith("20") ||
        c.code.startsWith("21") ||
        c.code.startsWith("60") ||
        c.code.startsWith("80") ||
        c.peachtree_type === "Other Current Liabilities" ||
        c.peachtree_type === "Cost of Sales" ||
        c.peachtree_type === "Expenses" ||
        c.name.toLowerCase().includes("payable") ||
        c.name.toLowerCase().includes("accrual") ||
        c.name.toLowerCase().includes("expense") ||
        c.name.toLowerCase().includes("cost")
      )
      if (!isApMatch && !childHasAp) return null
    }

    // Search check
    const searchTerm = coaSearch.toLowerCase().trim()
    if (searchTerm) {
      const selfMatches = acc.code.toLowerCase().includes(searchTerm) || acc.name.toLowerCase().includes(searchTerm)
      const childMatches = children.some((c) => c.code.toLowerCase().includes(searchTerm) || c.name.toLowerCase().includes(searchTerm))
      if (!selfMatches && !childMatches) return null
    }

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }))
    }

    const handleAddChild = (e: React.MouseEvent) => {
      e.stopPropagation()
      setChildParentAccount(acc)
      setNewAccType(acc.account_type)
      setNewAccParent(acc.id)
      setNewAccCode(store.getNextSuggestedAccountCode(acc.code, acc.account_type))
      setNewAccName("")
      setNewAccIsGroup(false)
      setShowAddChildModal(true)
    }

    const handleEditAccount = (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingAccount(acc)
      setEditAccCode(acc.code)
      setEditAccName(acc.name)
      setEditAccType(acc.account_type)
      setEditAccParent(acc.parent_account_id || "")
      setEditAccIsGroup(!!acc.is_group)
      setEditAccIsActive(!!acc.is_active)
      setEditMenuOpen(false)
      setShowEditAccountModal(true)
    }

    return (
      <div key={acc.id} className="flex flex-col gap-1.5 w-full">
        <div
          onClick={isGroup ? toggleExpand : undefined}
          className={`flex items-center justify-between p-2.5 rounded-2xl transition-all border text-xs select-none ${
            isGroup
              ? "bg-zinc-100/90 hover:bg-zinc-200/80 border-zinc-200/90 font-bold text-zinc-900 cursor-pointer shadow-xs"
              : "bg-white hover:bg-emerald-50/40 border-zinc-200/70 font-semibold text-zinc-800 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {/* Tree Branch marker for nested children */}
            {level > 1 && (
              <span className="text-zinc-400 font-mono text-xs select-none pl-1">↳</span>
            )}

            {/* Chevron for Groups */}
            {isGroup ? (
              <button
                onClick={toggleExpand}
                className="p-1 rounded-md hover:bg-zinc-300/70 text-zinc-700 shrink-0 transition-colors"
              >
                {isExpanded ? <ChevronDown className="size-3.5 text-zinc-900" /> : <ChevronRight className="size-3.5 text-zinc-500" />}
              </button>
            ) : (
              <span className="size-3.5 shrink-0 flex items-center justify-center">
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </span>
            )}

            {/* Folder / File Icon */}
            {isGroup ? (
              isExpanded ? <FolderOpen className="size-4 text-amber-600 shrink-0" /> : <Folder className="size-4 text-amber-600 shrink-0" />
            ) : (
              <FileText className="size-3.5 text-emerald-600 shrink-0" />
            )}

            {/* Code & Name */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-black text-zinc-900 bg-zinc-200/90 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                {acc.code}
              </span>
              <span className="truncate font-bold text-zinc-900">{acc.name}</span>

              {/* Group / Inactive Badges */}
              {isGroup && (
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-100/90 border border-purple-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                  Group
                </span>
              )}

              {!acc.is_active && (
                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full shrink-0">
                  Inactive
                </span>
              )}
            </div>
          </div>

          {/* Right Balance & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right mr-1">
              <div className={`font-mono font-black text-xs ${isGroup ? "text-zinc-950" : "text-zinc-800"}`}>
                ETB {netBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {isGroup && (
                <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                  {children.length} sub-account{children.length === 1 ? "" : "s"}
                </div>
              )}
            </div>

            <button
              onClick={handleEditAccount}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1 rounded-full transition-all"
              title={`Edit ${acc.name}`}
            >
              <Edit className="size-3" /> Edit
            </button>

            {isGroup && (
              <button
                onClick={handleAddChild}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-full transition-all"
                title={`Add sub-account under ${acc.code} - ${acc.name}`}
              >
                <Plus className="size-3" /> Child
              </button>
            )}
          </div>
        </div>

        {/* Children List with Left Guide Rail */}
        {isGroup && isExpanded && children.length > 0 && (
          <div className="flex flex-col gap-1.5 ml-5 pl-3 border-l-2 border-zinc-200/90 my-1">
            {children.map((childAcc) => renderAccountTreeNode(childAcc, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — ledger data cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <motion.div 
        variants={stagger} 
        initial="hidden" 
        animate="visible" 
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12"
      >
        {/* Title Header Block */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Journal Entries & Ledger Engine</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-2xl leading-relaxed mt-1">
              Double-entry journal vouchers, chart of accounts, and period locking.
            </p>
          </div>
          <div className="flex items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* Tab Selection Switcher Bar */}
        <motion.div variants={fade} className="flex border-b border-zinc-200/60 mb-6 pb-px items-center justify-between overflow-x-auto scrollbar-none">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "Entries", label: "Journal Entries", icon: FileText },
              { id: "Chart", label: "Chart of Accounts", icon: FolderTree },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase whitespace-nowrap"
                >
                  <Icon className={`size-3.5 ${isActive ? "text-emerald-600" : "text-zinc-400"}`} />
                  <span className={isActive ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="ledger-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="text-[10px] font-mono font-black text-emerald-700 uppercase hidden lg:flex items-center gap-1.5 shrink-0 ml-4">
            <CheckCircle2 className="size-3.5" /> Ledger State: Balanced
          </div>
        </motion.div>

        {/* Tab Content Rendering */}
        <AnimatePresence mode="wait">
          {/* TAB 1: Journal Entries */}
          {activeTab === "Entries" && (
            <motion.div
              key="entries-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <GlassCard className="flex flex-col p-0">
                <div className="px-6 pt-6">
                  <FinanceTableToolbar
                    title="Journal Entry Ledger"
                    subtitle={`${filteredEntries.length} double-entry vouchers posted to the general ledger`}
                    searchValue={searchEntries}
                    onSearchChange={setSearchEntries}
                    searchPlaceholder="Search description, JE ID, source..."
                    dateFilter={{
                      value: jeDateFilter,
                      onChange: setJeDateFilter,
                      startDate: jeCustomStart,
                      endDate: jeCustomEnd,
                      onCustomDateChange: (start, end) => {
                        setJeCustomStart(start)
                        setJeCustomEnd(end)
                      },
                    }}
                    filters={[
                      {
                        value: jeSourceFilter,
                        onChange: setJeSourceFilter,
                        ariaLabel: "Voucher type filter",
                        options: [
                          { value: "ALL", label: "All Voucher Types" },
                          ...jeSourceTypes.map((t) => ({ value: t, label: t })),
                        ],
                      },
                    ]}
                    actions={[
                      {
                        label: `Export (${filteredEntries.length})`,
                        onClick: () => {
                          exportPeachtreeGeneralJournal(filteredEntries, lines, accounts, { format: "PEACHTREE_EXCEL" })
                          showToast("Journal Exported", "success", `Exported ${filteredEntries.length} filtered journal entries to Excel.`)
                        },
                        icon: <Download className="size-3.5" />,
                        variant: "emeraldLight",
                      },
                      { label: "Post Entry", onClick: () => setShowPostModal(true) },
                    ]}
                  />
                </div>
                <TableScrollWrapper>
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                        {jeColumns.map((col) => {
                          const width = jeColWidths[col.key] || 120
                          const isSorted = jeSortKey === col.key
                          const isMenuOpen = openJeSortMenuCol === col.key

                          return (
                            <th
                              key={col.key}
                              style={{ width: `${width}px`, minWidth: `${width}px` }}
                              className="relative px-3 py-3 group border-r border-zinc-200/50 last:border-r-0"
                            >
                              <div
                                className={`flex items-center justify-between gap-1 ${
                                  col.align === "right"
                                    ? "flex-row-reverse text-right"
                                    : col.align === "center"
                                    ? "justify-center"
                                    : ""
                                }`}
                              >
                                <span className="truncate">{col.label}</span>

                                {/* Dropdown Icon & Active Sort Indicator */}
                                {col.key !== "actions" && (
                                  <div className="relative flex items-center shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenJeSortMenuCol(isMenuOpen ? null : col.key)
                                      }}
                                      className={`p-1 rounded hover:bg-zinc-200/80 transition-colors flex items-center gap-0.5 ${
                                        isSorted
                                          ? "text-emerald-700 font-bold bg-emerald-100/80"
                                          : "text-zinc-400 opacity-0 group-hover:opacity-100"
                                      }`}
                                      title="Sort & Filter options"
                                    >
                                      {isSorted ? (
                                        jeSortDir === "asc" ? (
                                          <ArrowUp className="size-3" />
                                        ) : (
                                          <ArrowDown className="size-3" />
                                        )
                                      ) : (
                                        <ChevronDown className="size-3" />
                                      )}
                                    </button>

                                    {/* Dropdown Menu Popover */}
                                    {isMenuOpen && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-20 cursor-default"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setOpenJeSortMenuCol(null)
                                          }}
                                        />
                                        <div
                                          className={`absolute top-full mt-1.5 z-30 bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 min-w-[150px] text-xs font-semibold normal-case tracking-normal ${
                                            col.align === "right" ? "right-0 text-left" : "left-0 text-left"
                                          }`}
                                        >
                                          <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-400 border-b border-zinc-100 mb-1">
                                            Sort {col.label}
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setJeSortKey(col.key)
                                              setJeSortDir("asc")
                                              setOpenJeSortMenuCol(null)
                                            }}
                                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                                              isSorted && jeSortDir === "asc"
                                                ? "bg-emerald-50 text-emerald-800 font-bold"
                                                : "text-zinc-700 hover:bg-zinc-100"
                                            }`}
                                          >
                                            <ArrowUp className="size-3 text-emerald-600" />
                                            Sort Ascending
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setJeSortKey(col.key)
                                              setJeSortDir("desc")
                                              setOpenJeSortMenuCol(null)
                                            }}
                                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                                              isSorted && jeSortDir === "desc"
                                                ? "bg-emerald-50 text-emerald-800 font-bold"
                                                : "text-zinc-700 hover:bg-zinc-100"
                                            }`}
                                          >
                                            <ArrowDown className="size-3 text-emerald-600" />
                                            Sort Descending
                                          </button>
                                          {isSorted && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setJeSortKey(null)
                                                setOpenJeSortMenuCol(null)
                                              }}
                                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors border-t border-zinc-100 mt-1 pt-1.5"
                                            >
                                              <RotateCcw className="size-3" />
                                              Clear Sort
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Column Resizer Handle */}
                              <div
                                onMouseDown={(e) => handleJeResizeStart(e, col.key)}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-600 z-10 transition-colors"
                                title="Drag to resize column"
                              />
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse text-xs">
                            <td className="px-3 py-3"><Skeleton className="h-4 w-20 bg-zinc-200/80" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-4 w-36 bg-zinc-200/80" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-4 w-28 bg-zinc-200/80" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
                            <td className="px-3 py-3 text-right"><Skeleton className="h-4 w-20 bg-zinc-200/80 ml-auto" /></td>
                            <td className="px-3 py-3 text-right"><Skeleton className="h-4 w-20 bg-zinc-200/80 ml-auto" /></td>
                            <td className="px-3 py-3 text-center"><Skeleton className="h-4 w-16 bg-zinc-200/80 mx-auto" /></td>
                            <td className="px-3 py-3 text-right"><Skeleton className="h-4 w-12 bg-zinc-200/80 ml-auto" /></td>
                          </tr>
                        ))
                      ) : sortedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-xs font-semibold text-zinc-400">
                            No journal entries found matching search criteria.
                          </td>
                        </tr>
                      ) : (
                        displayedEntries.map((ent, idx) => {
                          const entryLines = lines.filter((l) => l.journal_entry_id === ent.id)
                          const isReversal = ent.is_reversal_of !== null
                          const isReversed = reversedEntryIds.has(ent.id)

                          const totalDebit = entryLines.reduce((s, l) => s + l.debit_amount, 0)
                          const totalCredit = entryLines.reduce((s, l) => s + l.credit_amount, 0)

                          return (
                            <tr key={`${ent.id}-${idx}`} className="hover:bg-zinc-50/60 transition-colors text-xs">
                              <td
                                style={{ width: `${jeColWidths.id}px` }}
                                className="px-3 py-3 whitespace-nowrap font-mono font-bold text-zinc-900 truncate"
                              >
                                {ent.id}
                              </td>
                              <td
                                style={{ width: `${jeColWidths.entry_date}px` }}
                                className="px-3 py-3 whitespace-nowrap font-medium text-zinc-700 truncate"
                              >
                                {ent.entry_date}
                              </td>
                              <td
                                style={{ width: `${jeColWidths.description}px` }}
                                className="px-3 py-3 truncate"
                              >
                                <div className="font-semibold text-zinc-800 truncate">{ent.description}</div>
                                <div className="text-[10px] font-mono text-zinc-400 truncate">By: {ent.created_by}</div>
                              </td>
                              <td
                                style={{ width: `${jeColWidths.account_lines}px` }}
                                className="px-3 py-3 truncate"
                              >
                                <div className="flex flex-col gap-1 max-w-sm">
                                  {entryLines.map((l) => {
                                    const acc = accounts.find((a) => a.id === l.account_id || a.code === l.account_id)
                                    return (
                                      <div key={l.id} className="flex items-center text-[11px] truncate">
                                        <span className="font-mono text-zinc-700 truncate">
                                          {acc ? `${acc.code} - ${acc.name}` : l.account_id}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </td>
                              <td
                                style={{ width: `${jeColWidths.party}px` }}
                                className="px-3 py-3 truncate"
                              >
                                <div className="flex flex-col gap-1 max-w-xs">
                                  {entryLines.map((l) => (
                                    <div key={l.id} className="text-[11px] font-semibold text-zinc-700 truncate">
                                      {l.party_name || "—"}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td
                                style={{ width: `${jeColWidths.debit_amount}px` }}
                                className="px-3 py-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap"
                              >
                                ETB {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td
                                style={{ width: `${jeColWidths.credit_amount}px` }}
                                className="px-3 py-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap"
                              >
                                ETB {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td
                                style={{ width: `${jeColWidths.source_type}px` }}
                                className="px-3 py-3 text-center whitespace-nowrap"
                              >
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  ent.source_type === "Payment Voucher"
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                    : ent.source_type === "Sales Invoice"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : ent.source_type === "Purchase Invoice"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                    : "bg-zinc-100 text-zinc-700"
                                }`}>
                                  {ent.source_type}
                                </span>
                              </td>
                              <td
                                style={{ width: `${jeColWidths.actions}px` }}
                                className="px-3 py-3 text-right whitespace-nowrap pr-3"
                              >
                                {!isReversal && !isReversed ? (
                                  <button
                                    onClick={() => handleReverseEntry(ent.id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full transition-colors"
                                  >
                                    <RotateCcw className="size-3" /> Reverse
                                  </button>
                                ) : isReversed ? (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                    Reversed
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    Reversal Entry
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </TableScrollWrapper>

                {!isLoading && sortedEntries.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                      <span>
                        Showing {Math.min((jePage - 1) * jePageSize + 1, sortedEntries.length)} to {Math.min(jePage * jePageSize, sortedEntries.length)} of {sortedEntries.length} entries
                      </span>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                        <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                        <select
                          value={jePageSize}
                          onChange={(e) => {
                            setJePageSize(Number(e.target.value))
                            setJePage(1)
                          }}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={jePage === 1}
                        onClick={() => setJePage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                        Page {jePage} of {totalJePages}
                      </span>
                      <button
                        type="button"
                        disabled={jePage >= totalJePages}
                        onClick={() => setJePage((p) => p + 1)}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* TAB 2: Chart of Accounts Tree */}
          {activeTab === "Chart" && (
            <motion.div
              key="chart-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* Single Clean Toolbar Card */}
              <GlassCard className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="flex items-center gap-2.5 bg-zinc-100/90 rounded-full px-4 h-10 w-full md:max-w-md border border-zinc-200/70">
                  <Search className="size-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search account code or name (e.g. 1010, Cash, Inventory)..."
                    value={coaSearch}
                    onChange={(e) => setCoaSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold focus:outline-none text-zinc-900"
                  />
                  {coaSearch && (
                    <button onClick={() => setCoaSearch("")} className="text-zinc-400 hover:text-zinc-600">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Mode Pills & Action Button */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                  <div className="flex items-center bg-zinc-100 p-1 rounded-full border border-zinc-200/70">
                    {(
                      [
                        { id: "ALL", label: "All Accounts" },
                        { id: "AR", label: "AR • Receivables" },
                        { id: "AP", label: "AP • Payables" },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setCoaFilterMode(mode.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                          coaFilterMode === mode.id
                            ? "bg-zinc-950 text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      exportPeachtreeChartOfAccounts(accounts, { format: "PEACHTREE_EXCEL" })
                      showToast("COA Exported", "success", "Exported Chart of Accounts to Excel.")
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-black shadow-md shadow-emerald-900/15 transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="size-3.5" />
                    <span>Export COA</span>
                  </button>

                  <button
                    onClick={() => {
                      setNewAccCode(store.getNextSuggestedAccountCode(null, "Asset"))
                      setNewAccName("")
                      setNewAccType("Asset")
                      setNewAccParent("")
                      setNewAccIsGroup(false)
                      setShowAddAccountModal(true)
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-900 shadow-md active:scale-95 transition-all shrink-0"
                  >
                    <Plus className="size-4" /> Add Account Node
                  </button>
                </div>
              </GlassCard>

              {/* 6 Clean Company COA Hierarchy Tree Cards */}
              <div className="flex flex-col gap-4">
                {coaRootCategories
                  .filter((rootCat) => {
                    if (coaFilterMode === "AR") return rootCat.key === "Asset" || rootCat.key === "Revenue"
                    if (coaFilterMode === "AP") return rootCat.key === "Liability" || rootCat.key === "COGS" || rootCat.key === "AdminExpense"
                    return true
                  })
                  .map((rootCat) => {
                  const typeAccounts = accounts.filter((a) => rootCat.filter(a))
                  const rootAccounts = getTopLevelAccountsForCategory(rootCat.key)
                  const isRootExpanded = expandedNodes[rootCat.key] !== false
                  const rootTotalNet = typeAccounts
                    .filter((a) => !isGroupAccount(a))
                    .reduce((sum, a) => sum + getAccountNetBalance(a), 0)

                  return (
                    <GlassCard key={rootCat.key} className="p-4 flex flex-col gap-3 overflow-hidden">
                      {/* Root Category Header */}
                      <div
                        onClick={() =>
                          setExpandedNodes((prev) => ({
                            ...prev,
                            [rootCat.key]: !isRootExpanded,
                          }))
                        }
                        className="flex items-center justify-between cursor-pointer border-b border-zinc-200/80 pb-3"
                      >
                        <div className="flex items-center gap-3">
                          <button className="p-1 rounded-md hover:bg-zinc-200/80 text-zinc-700 transition-colors">
                            {isRootExpanded ? <ChevronDown className="size-4 text-zinc-900" /> : <ChevronRight className="size-4 text-zinc-500" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                                {rootCat.code}
                              </span>
                              <h4 className="text-sm font-black text-zinc-950 uppercase tracking-wide">
                                {rootCat.title}
                              </h4>
                              <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                                {typeAccounts.length} accounts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Net Balance</span>
                            <span className="text-xs font-mono font-black text-zinc-950">
                              ETB {rootTotalNet.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tree Level Content */}
                      {isRootExpanded && (
                        <div className="flex flex-col gap-2 pt-1 pl-2">
                          {rootAccounts.length === 0 ? (
                            <div className="text-xs text-zinc-400 italic py-2 pl-4">No root accounts in this classification.</div>
                          ) : (
                            rootAccounts.map((acc) => renderAccountTreeNode(acc, 1))
                          )}
                        </div>
                      )}
                    </GlassCard>
                  )
                })}
              </div>
            </motion.div>
          )}



        </AnimatePresence>

        {/* MODAL 1: Post Journal Entry */}
        <AnimatePresence>
          {showPostModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-zinc-200 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
                  <h3 className="text-base font-black text-zinc-900">Post New Journal Entry</h3>
                  <button onClick={() => setShowPostModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handlePostEntry} className="flex flex-col gap-4 text-xs">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Entry Date</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Source Type</label>
                      <select
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold text-xs"
                      >
                        <option value="Manual Adjustment">Manual Adjustment</option>
                        <option value="Sales Invoice">Sales Invoice</option>
                        <option value="Purchase Invoice">Purchase Invoice</option>
                        <option value="Payroll">Payroll</option>
                        <option value="Exchange Revaluation">Exchange Revaluation</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Source Ref ID</label>
                      <input
                        type="text"
                        value={newSourceId}
                        onChange={(e) => setNewSourceId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Accounting Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Monthly Office Utility Bill Settlement"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    />
                  </div>

                  {/* Lines */}
                  <div className="flex flex-col gap-2">
                    <label className="font-bold text-zinc-700">Journal Lines (Debits = Credits)</label>
                    {formLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          value={line.account_id}
                          onChange={(e) => {
                            const updated = [...formLines]
                            updated[idx].account_id = e.target.value
                            setFormLines(updated)
                          }}
                          className="col-span-6 p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-medium text-xs"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Debit"
                          value={line.debit}
                          onChange={(e) => {
                            const updated = [...formLines]
                            updated[idx].debit = e.target.value
                            updated[idx].credit = ""
                            setFormLines(updated)
                          }}
                          className="col-span-3 p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                        />
                        <input
                          type="number"
                          placeholder="Credit"
                          value={line.credit}
                          onChange={(e) => {
                            const updated = [...formLines]
                            updated[idx].credit = e.target.value
                            updated[idx].debit = ""
                            setFormLines(updated)
                          }}
                          className="col-span-3 p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowPostModal(false)}
                      className="px-4 py-2.5 rounded-full bg-zinc-100 text-zinc-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-full bg-black text-white font-bold hover:bg-zinc-800"
                    >
                      Post Entry
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2A: Add Sub-Account (Child) */}
        <AnimatePresence>
          {showAddChildModal && childParentAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-2 border-emerald-500/20"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <Plus className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-zinc-900">Add Sub-Account</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Child
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">
                        Adding child node under {childParentAccount.name}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddChildModal(false)} className="text-zinc-400 hover:text-zinc-600 p-1">
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateChildAccount} className="flex flex-col gap-3.5 text-xs">
                  {/* Parent Info Card */}
                  <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="size-4 text-emerald-700 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Parent Group</span>
                        <span className="font-bold text-zinc-900">{childParentAccount.code} - {childParentAccount.name}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-zinc-800 border border-emerald-200">
                      {childParentAccount.account_type}
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Sub-Account Code</label>
                    <input
                      type="text"
                      value={newAccCode}
                      onChange={(e) => setNewAccCode(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold text-zinc-900 outline-none"
                      placeholder="e.g. 1011"
                      required
                    />
                    <p className="text-[10px] text-zinc-400 mt-1 font-medium">Auto-suggested based on parent account code.</p>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Sub-Account Name</label>
                    <input
                      type="text"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold text-zinc-900 outline-none"
                      placeholder="e.g. Commercial Bank of Ethiopia"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Classification</label>
                    <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80">
                      <button
                        type="button"
                        onClick={() => setNewAccIsGroup(false)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          !newAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <FileText className="size-3.5 text-emerald-600" /> Ledger (Postable)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAccIsGroup(true)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          newAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <Folder className="size-3.5 text-purple-600" /> Group (Folder)
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowAddChildModal(false)}
                      className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full bg-zinc-950 text-white font-bold hover:bg-zinc-800 transition-all shadow-sm"
                    >
                      Create Sub-Account
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Add Top-Level Account Node */}
        <AnimatePresence>
          {showAddAccountModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-2 border-zinc-900/10"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-2xl bg-zinc-100 border border-zinc-300 flex items-center justify-center text-zinc-900">
                      <FolderTree className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-zinc-900">Add Account Node</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                          Root
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">
                        Create a primary category or top-level account
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddAccountModal(false)} className="text-zinc-400 hover:text-zinc-600 p-1">
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateAccount} className="flex flex-col gap-3 text-xs">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Classification</label>
                    <select
                      value={newAccType}
                      onChange={(e) => {
                        const selectedType = e.target.value as any
                        setNewAccType(selectedType === "COGS" || selectedType === "AdminExpense" ? "Expense" : selectedType)
                        setNewAccParent("")
                        setNewAccCode(store.getNextSuggestedAccountCode(null, selectedType))
                      }}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold outline-none cursor-pointer"
                    >
                      <option value="Asset">Asset Accounts (1000s)</option>
                      <option value="Liability">Liability Accounts (2000s)</option>
                      <option value="Equity">Equity Accounts (3000s)</option>
                      <option value="Revenue">Income & Revenue Accounts (4000s)</option>
                      <option value="COGS">Cost of Sales / Selling & Distribution (6000s)</option>
                      <option value="AdminExpense">Administrative & General Expenses (8000s)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Code (e.g. 1120)</label>
                    <input
                      type="text"
                      value={newAccCode}
                      onChange={(e) => setNewAccCode(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold outline-none"
                      placeholder="1120"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Name</label>
                    <input
                      type="text"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold outline-none"
                      placeholder="e.g. Foreign Currency Accounts"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Node Classification</label>
                    <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80">
                      <button
                        type="button"
                        onClick={() => setNewAccIsGroup(false)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          !newAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <FileText className="size-3.5 text-emerald-600" /> Ledger (Postable)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAccIsGroup(true)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          newAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <Folder className="size-3.5 text-purple-600" /> Group (Folder)
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowAddAccountModal(false)}
                      className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full bg-zinc-950 text-white font-bold hover:bg-zinc-800 transition-all shadow-sm"
                    >
                      Create Account Node
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 3: Edit Account Node */}
        <AnimatePresence>
          {showEditAccountModal && editingAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-2 border-blue-500/20"
              >
                {/* Modal Header with 3-dot dropdown menu */}
                <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                      <Edit className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-zinc-900">Edit Account</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                          {editingAccount.code}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-400 mt-0.5 truncate max-w-[200px]">
                        {editingAccount.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 relative">
                    {/* 3-dot dropdown menu button */}
                    <button
                      type="button"
                      onClick={() => setEditMenuOpen(!editMenuOpen)}
                      className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
                      title="More Options"
                    >
                      <MoreVertical className="size-4" />
                    </button>

                    {/* 3-dot dropdown popover */}
                    {editMenuOpen && (
                      <div className="absolute right-0 top-8 z-50 w-52 bg-white rounded-2xl shadow-xl border border-zinc-200 p-2 space-y-1">
                        {/* Toggle Active / Inactive */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditAccIsActive(!editAccIsActive)
                            setEditMenuOpen(false)
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 rounded-xl transition-colors text-left"
                        >
                          <span>Account Status</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            editAccIsActive ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}>
                            {editAccIsActive ? "Active" : "Inactive"}
                          </span>
                        </button>

                        <div className="h-px bg-zinc-100 my-1" />

                        {/* Delete Account */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditMenuOpen(false)
                            setShowDeleteConfirmModal(true)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                        >
                          <Trash2 className="size-3.5" /> Delete Account Node
                        </button>
                      </div>
                    )}

                    {/* Close button */}
                    <button
                      onClick={() => setShowEditAccountModal(false)}
                      className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleUpdateAccountSubmit} className="flex flex-col gap-3 text-xs">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Code</label>
                    <input
                      type="text"
                      value={editAccCode}
                      onChange={(e) => setEditAccCode(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Name</label>
                    <input
                      type="text"
                      value={editAccName}
                      onChange={(e) => setEditAccName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Classification</label>
                    <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80">
                      <button
                        type="button"
                        onClick={() => setEditAccIsGroup(false)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          !editAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <FileText className="size-3.5 text-emerald-600" /> Ledger (Postable)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAccIsGroup(true)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          editAccIsGroup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <Folder className="size-3.5 text-purple-600" /> Group (Folder)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Account Type</label>
                    <select
                      value={editAccType}
                      onChange={(e) => setEditAccType(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold outline-none"
                    >
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                      <option value="Equity">Equity</option>
                      <option value="Revenue">Revenue</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Parent Group Account</label>
                    <select
                      value={editAccParent}
                      onChange={(e) => setEditAccParent(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold outline-none"
                    >
                      <option value="">(Root Account - No Parent)</option>
                      {accounts
                        .filter((a) => a.account_type === editAccType && a.id !== editingAccount.id && a.code !== editingAccount.code)
                        .map((a) => (
                          <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowEditAccountModal(false)}
                      className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full bg-zinc-950 text-white font-bold hover:bg-zinc-800 transition-all shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 4: Delete Account Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirmModal && editingAccount && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 text-center"
              >
                <div className="size-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="size-6" />
                </div>
                <h3 className="text-base font-black text-zinc-900 mb-1">Delete Account Node?</h3>
                <p className="text-xs text-zinc-500 font-semibold mb-4 leading-relaxed">
                  Are you sure you want to delete <strong className="text-zinc-900 font-mono">{editingAccount.code} - {editingAccount.name}</strong>?
                  Accounts with active transaction entries cannot be deleted.
                </p>

                <div className="flex justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirmModal(false)}
                    className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 rounded-full bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all shadow-sm"
                  >
                    Confirm Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  )
}
