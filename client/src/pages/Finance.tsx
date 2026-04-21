import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import {
  DollarSign, Plus, Check, X, Settings, Users, FileText,
  ArrowUpRight, ArrowDownRight, Trash2, TrendingUp, Scale,
  BarChart3, Receipt, Star, Printer, ChevronUp, ChevronDown,
  Download, Info, Trophy, Activity, Calendar, Package
} from "lucide-react";

type Tab = "summary" | "payments" | "expenses" | "players" | "config" | "ledger" | "income-statement" | "balance-sheet" | "valuations";

const FEE_TYPES = ["MEMBERSHIP", "DEVELOPMENT", "RESOURCE", "LEAGUE_AFFILIATION", "OTHER"];
const PAID_BY_OPTIONS = ["PLAYER", "CLUB", "SPONSOR", "OTHER"];
const EXPENSE_REASONS = ["TRANSPORT", "TRACK_SUIT", "JERSEY", "SHOES", "TRIP", "MEDICAL", "OTHER"];
const EXPENSE_PAID_BY = ["CLUB", "COACH", "ADMIN", "SPONSOR", "OTHER"];

const INCOME_CATEGORIES = [
  "Sponsorship", "Tournament Entry Fees", "Events / Fundraising", "Merchandise Sales",
  "Donations", "Grants", "Gate Takings", "Facility Hire", "Other"
];
const EXPENSE_CATEGORIES = [
  "Venue Hire", "Equipment", "Uniforms", "Travel & Transport", "Medical Supplies",
  "Administrative", "Utilities", "Referee Fees", "Tournament Fees",
  "Marketing", "Catering", "Other"
];

const fmt = (n: number) => `N$${Number(n || 0).toLocaleString()}`;
const inputCls = "w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal";

export default function Finance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canApprove = user && (user.role === "ADMIN" || user.role === "FINANCE" || user.isSuperAdmin || user.roles?.some((r: string) => ["ADMIN", "FINANCE"].includes(r)));
  const canManage = user && (user.role === "ADMIN" || user.role === "FINANCE" || user.role === "MANAGER" || user.isSuperAdmin);

  const downloadPdf = async (url: string, filename: string) => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) { const e = await resp.json().catch(() => null); throw new Error(e?.message || "Failed to generate PDF"); }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast({ title: "PDF downloaded" });
    } catch (err: any) {
      toast({ title: "PDF error", description: err.message, variant: "destructive" });
    }
  };

  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "MALE" | "FEMALE">("");
  const [teamFilter, setTeamFilter] = useState("");
  const isPlayerRole = user?.role === "PLAYER";

  const [payForm, setPayForm] = useState({ playerId: "", feeType: "MEMBERSHIP", amount: "", paidBy: "PLAYER", paidByName: "", reference: "", paymentDate: "" });
  const [expForm, setExpForm] = useState({ playerId: "", amount: "", paidBy: "CLUB", paidByName: "", reason: "TRANSPORT", notes: "", expenseDate: "" });
  const [feeForm, setFeeForm] = useState<Record<string, string>>({});
  const [ledgerForm, setLedgerForm] = useState({ type: "INCOME", category: "Sponsorship", amount: "", description: "", reference: "", txnDate: "" });
  const [stmtPeriod, setStmtPeriod] = useState({ from: "", to: "" });

  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: txns = [] } = useQuery({ queryKey: ["/api/finance"], queryFn: api.getFinanceTxns });
  const { data: payments = [] } = useQuery({ queryKey: ["/api/finance/payments"], queryFn: () => api.getFinancePayments() });
  const { data: expenses = [] } = useQuery({ queryKey: ["/api/finance/expenses"], queryFn: () => api.getFinanceExpenses() });
  const { data: feeConfig = {} } = useQuery({ queryKey: ["/api/finance/fee-config"], queryFn: api.getFeeConfig });
  const { data: summary } = useQuery({ queryKey: ["/api/finance/summary"], queryFn: () => api.getFinanceSummary(), enabled: !!canManage });
  const { data: playerFinance } = useQuery({
    queryKey: ["/api/finance/player", selectedPlayerId],
    queryFn: () => api.getPlayerFinance(selectedPlayerId),
    enabled: !!selectedPlayerId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isPlayerRole && user?.playerId && !selectedPlayerId) {
      setSelectedPlayerId(user.playerId);
    }
  }, [isPlayerRole, user?.playerId]);

  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [stmtFetch, setStmtFetch] = useState({ from: "", to: "" });

  const { data: incomeStatement } = useQuery({
    queryKey: ["/api/finance/income-statement", stmtFetch.from, stmtFetch.to],
    queryFn: () => api.getIncomeStatement(stmtFetch.from || undefined, stmtFetch.to || undefined),
    enabled: activeTab === "income-statement" && !!canManage,
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["/api/finance/balance-sheet"],
    queryFn: api.getBalanceSheet,
    enabled: activeTab === "balance-sheet" && !!canManage,
  });

  const { data: valuations, isLoading: valuationsLoading } = useQuery({
    queryKey: ["/api/finance/valuations"],
    queryFn: api.getFinanceValuations,
    enabled: activeTab === "valuations" && !!canManage,
  });

  const [valSort, setValSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "transferValue", dir: "desc" });
  const [valFilter, setValFilter] = useState({ type: "ALL", search: "" });
  const [selectedTeamPdf, setSelectedTeamPdf] = useState("");

  const getValField = (row: any, col: string): any => {
    if (col.includes(".")) { const [k1, k2] = col.split("."); return row[k1]?.[k2]; }
    return row[col];
  };

  const valPlayerRows = (() => {
    if (!valuations?.players) return [];
    let rows = [...valuations.players];
    if (valFilter.search) rows = rows.filter((r: any) => r.name.toLowerCase().includes(valFilter.search.toLowerCase()) || r.position.toLowerCase().includes(valFilter.search.toLowerCase()) || r.team.toLowerCase().includes(valFilter.search.toLowerCase()));
    rows.sort((a: any, b: any) => {
      const av = getValField(a, valSort.col) ?? -1, bv = getValField(b, valSort.col) ?? -1;
      if (typeof av === "string") return valSort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return valSort.dir === "asc" ? av - bv : bv - av;
    });
    return rows;
  })();

  const valOfficialRows = (() => {
    if (!valuations?.officials) return [];
    let rows = [...valuations.officials];
    if (valFilter.search) rows = rows.filter((r: any) => r.name.toLowerCase().includes(valFilter.search.toLowerCase()) || r.position.toLowerCase().includes(valFilter.search.toLowerCase()));
    return rows;
  })();

  const sortHeader = (col: string, label: string) => (
    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted cursor-pointer hover:text-afrocat-text select-none"
      onClick={() => setValSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }))}>
      <span className="flex items-center gap-1">{label}
        {valSort.col === col ? (valSort.dir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
      </span>
    </th>
  );

  const sortedPlayers = [...players].sort((a: any, b: any) =>
    `${a.lastName || ""} ${a.firstName || ""}`.toLowerCase().localeCompare(`${b.lastName || ""} ${b.firstName || ""}`.toLowerCase())
  );

  const filteredDropdownPlayers = useMemo(() => {
    let result = sortedPlayers;
    if (genderFilter) result = result.filter((p: any) => (p.gender || "").toUpperCase() === genderFilter);
    if (teamFilter) result = result.filter((p: any) => p.teamId === teamFilter);
    if (playerSearch.trim()) {
      const q = playerSearch.toLowerCase();
      result = result.filter((p: any) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        String(p.jerseyNo || "").includes(q) ||
        (p.position || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedPlayers, playerSearch, genderFilter, teamFilter]);

  const createPaymentMut = useMutation({
    mutationFn: (data: any) => api.createFinancePayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/payments"] });
      toast({ title: "Payment Created (Pending Approval)" });
      setShowPaymentForm(false);
      setPayForm({ playerId: "", feeType: "MEMBERSHIP", amount: "", paidBy: "PLAYER", paidByName: "", reference: "", paymentDate: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approvePaymentMut = useMutation({
    mutationFn: (id: string) => api.approveFinancePayment(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/payments"] }); toast({ title: "Payment Approved" }); },
  });

  const rejectPaymentMut = useMutation({
    mutationFn: (id: string) => api.rejectFinancePayment(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/payments"] }); toast({ title: "Payment Rejected" }); },
  });

  const createExpenseMut = useMutation({
    mutationFn: (data: any) => api.createFinanceExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses"] });
      toast({ title: "Expense Created (Pending Approval)" });
      setShowExpenseForm(false);
      setExpForm({ playerId: "", amount: "", paidBy: "CLUB", paidByName: "", reason: "TRANSPORT", notes: "", expenseDate: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveExpenseMut = useMutation({
    mutationFn: (id: string) => api.approveFinanceExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses"] }); toast({ title: "Expense Approved" }); },
  });

  const rejectExpenseMut = useMutation({
    mutationFn: (id: string) => api.rejectFinanceExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses"] }); toast({ title: "Expense Rejected" }); },
  });

  const saveFeeConfigMut = useMutation({
    mutationFn: (data: Record<string, string>) => api.updateFeeConfig(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/fee-config"] }); toast({ title: "Fee Configuration Saved" }); },
  });

  const createTxnMut = useMutation({
    mutationFn: (data: any) => api.createFinanceTxn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/balance-sheet"] });
      toast({ title: "Transaction Recorded" });
      setShowLedgerForm(false);
      setLedgerForm({ type: "INCOME", category: "Sponsorship", amount: "", description: "", reference: "", txnDate: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTxnMut = useMutation({
    mutationFn: (id: string) => api.deleteFinanceTxn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/balance-sheet"] });
      toast({ title: "Deleted" });
    },
  });

  const tabs: { id: Tab; label: string; icon: any; show: boolean }[] = [
    { id: "summary", label: "Summary", icon: DollarSign, show: true },
    { id: "payments", label: "Payments", icon: ArrowUpRight, show: true },
    { id: "expenses", label: "Expenses", icon: ArrowDownRight, show: true },
    { id: "players", label: "Player Finance", icon: Users, show: true },
    { id: "ledger", label: "Ledger", icon: Receipt, show: !!canManage },
    { id: "income-statement", label: "Income Statement", icon: TrendingUp, show: !!canManage },
    { id: "balance-sheet", label: "Balance Sheet", icon: Scale, show: !!canManage },
    { id: "valuations", label: "Valuations", icon: Star, show: !!canManage },
    { id: "config", label: "Fee Config", icon: Settings, show: !!canManage },
  ];

  const statusBadge = (status: string) => {
    if (status === "APPROVED") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">APPROVED</span>;
    if (status === "REJECTED") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">REJECTED</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400">PENDING</span>;
  };

  const SectionRow = ({ label, amount, indent = false, bold = false, isTotal = false }: { label: string; amount: number; indent?: boolean; bold?: boolean; isTotal?: boolean }) => (
    <div className={`flex justify-between items-center py-2 ${isTotal ? "border-t border-afrocat-border mt-1" : "border-b border-afrocat-border/40"} ${indent ? "pl-6" : ""}`}>
      <span className={`text-sm ${bold || isTotal ? "font-bold text-afrocat-text" : "text-afrocat-muted"}`}>{label}</span>
      <span className={`text-sm font-bold ${isTotal ? "text-base" : ""} ${amount >= 0 ? "text-afrocat-text" : "text-red-400"}`}>{fmt(Math.abs(amount))}</span>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-afrocat-teal-soft flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-afrocat-teal" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-finance-title">Finance</h1>
              <p className="text-xs text-afrocat-muted">Fees, payments, expenses, reports & financial statements</p>
            </div>
          </div>
        </div>

        <div className="afrocat-card p-1.5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.filter((t) => t.show).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === t.id ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"
                }`}
                data-testid={`tab-finance-${t.id}`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="afrocat-card p-4 text-center">
                <div className="text-2xl font-display font-bold text-green-400" data-testid="text-total-received">{fmt(summary?.totalReceived || 0)}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Received</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-2xl font-display font-bold text-red-400" data-testid="text-total-expenses">{fmt(summary?.totalExpenses || 0)}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Expenses</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className={`text-2xl font-display font-bold ${(summary?.netPosition || 0) >= 0 ? "text-green-400" : "text-red-400"}`} data-testid="text-net-position">{fmt(summary?.netPosition || 0)}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Net</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-2xl font-display font-bold text-yellow-400">{fmt(summary?.pendingPayments || 0)}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Pending</div>
              </div>
            </div>

            <div className="afrocat-card p-5">
              <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Current Fee Schedule</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Non-Working Membership", key: "membershipFeeNonWorking", def: "400" },
                  { label: "Working Membership", key: "membershipFeeWorking", def: "800" },
                  { label: "Development Fee", key: "developmentFee", def: "2500" },
                  { label: "Resource Fee", key: "resourceFee", def: "1500" },
                ].map(f => (
                  <div key={f.key} className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                    <div className="text-xs text-afrocat-muted">{f.label}</div>
                    <div className="text-lg font-bold text-afrocat-text">{fmt(parseInt(String(feeConfig[f.key] || f.def)) || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-new-payment">
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            </div>

            {payments.length === 0 && <div className="afrocat-card p-8 text-center text-afrocat-muted text-sm">No payments recorded yet.</div>}

            {payments.map((p: any) => (
              <div key={p.id} className="afrocat-card p-4" data-testid={`payment-card-${p.id}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-afrocat-text">{p.playerName}</div>
                    <div className="text-[10px] text-afrocat-muted">{p.feeType} • Paid by {p.paidBy}{p.paidByName ? ` (${p.paidByName})` : ""} • {p.paymentDate}</div>
                    {p.reference && <div className="text-[10px] text-afrocat-muted">Ref: {p.reference}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-afrocat-text">{fmt(p.amount)}</div>
                    {statusBadge(p.status)}
                  </div>
                  {canApprove && p.status === "PENDING_APPROVAL" && (
                    <div className="flex gap-1">
                      <button onClick={() => approvePaymentMut.mutate(p.id)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer" data-testid={`button-approve-payment-${p.id}`}><Check className="w-4 h-4" /></button>
                      <button onClick={() => rejectPaymentMut.mutate(p.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer" data-testid={`button-reject-payment-${p.id}`}><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showPaymentForm && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-md p-6 space-y-4">
                  <h3 className="font-display font-bold text-lg text-afrocat-text">Record Payment</h3>
                  <Select value={payForm.playerId} onValueChange={(v) => setPayForm({ ...payForm, playerId: v })}>
                    <SelectTrigger data-testid="select-payment-player"><SelectValue placeholder="Select Player" /></SelectTrigger>
                    <SelectContent>{sortedPlayers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={payForm.feeType} onValueChange={(v) => setPayForm({ ...payForm, feeType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="number" placeholder="Amount (N$)" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={inputCls} data-testid="input-payment-amount" />
                  <Select value={payForm.paidBy} onValueChange={(v) => setPayForm({ ...payForm, paidBy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAID_BY_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  {payForm.paidBy !== "PLAYER" && (
                    <input type="text" placeholder="Paid by name" value={payForm.paidByName} onChange={(e) => setPayForm({ ...payForm, paidByName: e.target.value })} className={inputCls} />
                  )}
                  <input type="text" placeholder="Reference" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className={inputCls} />
                  <input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} className={inputCls} data-testid="input-payment-date" />
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                    <button onClick={() => createPaymentMut.mutate(payForm)} disabled={createPaymentMut.isPending} className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-submit-payment">
                      {createPaymentMut.isPending ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <button onClick={() => setShowExpenseForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-new-expense">
                  <Plus className="w-4 h-4" /> Log Expense
                </button>
              </div>
            )}

            {expenses.length === 0 && <div className="afrocat-card p-8 text-center text-afrocat-muted text-sm">No expenses recorded yet.</div>}

            {expenses.map((e: any) => (
              <div key={e.id} className="afrocat-card p-4" data-testid={`expense-card-${e.id}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-afrocat-text">{e.playerName}</div>
                    <div className="text-[10px] text-afrocat-muted">{e.reason} • Paid by {e.paidBy}{e.paidByName ? ` (${e.paidByName})` : ""} • {e.expenseDate}</div>
                    {e.notes && <div className="text-[10px] text-afrocat-muted">{e.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-afrocat-text">{fmt(e.amount)}</div>
                    {statusBadge(e.status)}
                  </div>
                  {canApprove && e.status === "PENDING_APPROVAL" && (
                    <div className="flex gap-1">
                      <button onClick={() => approveExpenseMut.mutate(e.id)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer"><Check className="w-4 h-4" /></button>
                      <button onClick={() => rejectExpenseMut.mutate(e.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showExpenseForm && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-md p-6 space-y-4">
                  <h3 className="font-display font-bold text-lg text-afrocat-text">Log Player Expense</h3>
                  <Select value={expForm.playerId} onValueChange={(v) => setExpForm({ ...expForm, playerId: v })}>
                    <SelectTrigger data-testid="select-expense-player"><SelectValue placeholder="Select Player" /></SelectTrigger>
                    <SelectContent>{sortedPlayers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={expForm.reason} onValueChange={(v) => setExpForm({ ...expForm, reason: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="number" placeholder="Amount (N$)" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className={inputCls} data-testid="input-expense-amount" />
                  <Select value={expForm.paidBy} onValueChange={(v) => setExpForm({ ...expForm, paidBy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_PAID_BY.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="text" placeholder="Notes" value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} className={inputCls} />
                  <input type="date" value={expForm.expenseDate} onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })} className={inputCls} data-testid="input-expense-date" />
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowExpenseForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                    <button onClick={() => createExpenseMut.mutate(expForm)} disabled={createExpenseMut.isPending} className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-submit-expense">
                      {createExpenseMut.isPending ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "players" && (
          <div className="space-y-4">
            {isPlayerRole ? (
              <div className="afrocat-card p-4 flex items-center gap-3">
                <Users className="w-5 h-5 text-afrocat-teal" />
                <div>
                  <div className="text-xs text-afrocat-muted uppercase font-bold">Your Finance Profile</div>
                  <div className="text-sm font-medium text-afrocat-text">
                    {playerFinance?.playerName || "Loading your data…"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="afrocat-card p-4 space-y-3">
                {/* Filter chips: gender + team */}
                <div className="flex flex-wrap gap-2">
                  {(["", "MALE", "FEMALE"] as const).map(g => (
                    <button
                      key={g || "all-gender"}
                      onClick={() => setGenderFilter(g)}
                      data-testid={`chip-gender-${g || "all"}`}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        genderFilter === g
                          ? "bg-afrocat-teal text-white border-afrocat-teal"
                          : "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border hover:border-afrocat-teal/40"
                      }`}
                    >
                      {g === "" ? "All" : g === "MALE" ? "♂ Men" : "♀ Women"}
                    </button>
                  ))}
                  <div className="h-6 w-px bg-afrocat-border mx-1" />
                  <button
                    onClick={() => setTeamFilter("")}
                    data-testid="chip-team-all"
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                      teamFilter === ""
                        ? "bg-afrocat-gold text-white border-afrocat-gold"
                        : "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border hover:border-afrocat-gold/40"
                    }`}
                  >
                    All Teams
                  </button>
                  {(teams as any[]).map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => setTeamFilter(t.id)}
                      data-testid={`chip-team-${t.id}`}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        teamFilter === t.id
                          ? "bg-afrocat-gold text-white border-afrocat-gold"
                          : "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border hover:border-afrocat-gold/40"
                      }`}
                    >
                      {t.name || t.teamName}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afrocat-muted pointer-events-none" />
                  <input
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    placeholder="Search by name, jersey #, or position…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                    data-testid="input-player-finance-search"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-xl border border-afrocat-border divide-y divide-afrocat-border/40" data-testid="list-player-finance-picker">
                  {filteredDropdownPlayers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-afrocat-muted text-center">No players found</div>
                  ) : filteredDropdownPlayers.map((p: any) => (
                    <button key={p.id}
                      onClick={() => setSelectedPlayerId(p.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left cursor-pointer ${selectedPlayerId === p.id ? "bg-afrocat-teal/15 text-afrocat-teal font-semibold" : "text-afrocat-text hover:bg-afrocat-white-5"}`}
                      data-testid={`item-player-finance-${p.id}`}>
                      <span className="w-7 h-7 rounded-full bg-afrocat-gold-soft text-afrocat-gold text-xs font-bold flex items-center justify-center shrink-0">
                        {p.jerseyNo || "—"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{p.lastName}, {p.firstName}</span>
                        <span className="block text-[10px] text-afrocat-muted truncate">{p.position || "—"} · {p.gender || ""}</span>
                      </span>
                      {selectedPlayerId === p.id && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {playerFinance && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Total Due</div>
                    <div className="text-xl font-display font-bold text-afrocat-text">{fmt(playerFinance.fees?.total || 0)}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Paid by Player</div>
                    <div className="text-xl font-display font-bold text-green-400">{fmt(playerFinance.totalPaidByPlayer ?? 0)}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Outstanding</div>
                    <div className={`text-xl font-display font-bold ${playerFinance.outstanding > 0 ? "text-red-400" : "text-green-400"}`}>{playerFinance.outstanding > 0 ? fmt(playerFinance.outstanding) : "PAID ✓"}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="text-xs text-afrocat-muted uppercase font-bold">Transfer Value</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-afrocat-green-soft text-afrocat-green text-[9px] font-bold tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-afrocat-green animate-pulse inline-block" />LIVE
                      </span>
                    </div>
                    <div className="text-xl font-display font-bold text-afrocat-gold">{fmt(playerFinance.transferValue ?? 0)}</div>
                    <div className="text-[9px] text-afrocat-muted mt-1">Updates with stats &amp; attendance</div>
                  </div>
                </div>

                {/* Fee Breakdown */}
                <div className="afrocat-card p-4 space-y-2">
                  <h4 className="font-bold text-sm text-afrocat-text mb-2 flex items-center gap-2"><Receipt className="w-4 h-4 text-afrocat-teal" /> Fee Breakdown</h4>
                  {[
                    { label: "Membership Fee", val: playerFinance.fees?.membership },
                    { label: "Development Fee", val: playerFinance.fees?.development },
                    { label: "Resource Fee", val: playerFinance.fees?.resource },
                    ...(playerFinance.fees?.league > 0 ? [{ label: "League Affiliation Fee", val: playerFinance.fees?.league }] : []),
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-1 border-b border-afrocat-border/30 last:border-0">
                      <span className="text-xs text-afrocat-muted">{row.label}</span>
                      <span className="text-xs font-bold text-afrocat-text">{fmt(row.val || 0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 mt-1">
                    <span className="text-xs font-bold text-afrocat-text">Total Due</span>
                    <span className="text-sm font-display font-bold text-afrocat-teal">{fmt(playerFinance.fees?.total || 0)}</span>
                  </div>
                </div>

                {/* Valuation Breakdown */}
                {playerFinance.valuationBreakdown && (
                  <div className="afrocat-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-afrocat-text flex items-center gap-2"><Trophy className="w-4 h-4 text-afrocat-gold" /> Transfer Value Calculation</h4>
                      <span className="px-1.5 py-0.5 rounded-full bg-afrocat-green-soft text-afrocat-green text-[9px] font-bold tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-afrocat-green animate-pulse inline-block" />LIVE
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { icon: <Package className="w-3.5 h-3.5" />, label: "1. Base Value", desc: playerFinance.valuationBreakdown.baseLabel, value: fmt(playerFinance.valuationBreakdown.baseValue), color: "text-afrocat-text" },
                        { icon: <Calendar className="w-3.5 h-3.5" />, label: "2. Age Multiplier", desc: playerFinance.valuationBreakdown.ageLabel, value: `× ${playerFinance.valuationBreakdown.ageMult}`, color: "text-blue-400" },
                        { icon: <Activity className="w-3.5 h-3.5" />, label: "3. Performance Score", desc: playerFinance.valuationBreakdown.perfLabel, value: `${playerFinance.valuationBreakdown.perfScore}/100`, color: "text-purple-400" },
                        { icon: <Users className="w-3.5 h-3.5" />, label: "4. Attendance Rate", desc: playerFinance.valuationBreakdown.attendLabel, value: `${playerFinance.valuationBreakdown.attendRate}%`, color: "text-green-400" },
                        { icon: <DollarSign className="w-3.5 h-3.5" />, label: "5. Club Investment", desc: "Equipment, fees & expenses paid by club", value: fmt(playerFinance.valuationBreakdown.clubInvestment), color: "text-afrocat-teal" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 bg-afrocat-white-3 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <span className="text-afrocat-muted mt-0.5">{row.icon}</span>
                            <div>
                              <div className="text-xs font-bold text-afrocat-gold">{row.label}</div>
                              <div className="text-[10px] text-afrocat-muted leading-tight mt-0.5">{row.desc}</div>
                            </div>
                          </div>
                          <span className={`text-sm font-display font-bold shrink-0 ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-afrocat-white-5 border border-afrocat-teal/30 p-3 space-y-1">
                      <div className="text-[9px] text-afrocat-muted uppercase font-bold tracking-wider">Formula</div>
                      <div className="text-[10px] text-afrocat-text font-mono leading-tight">{playerFinance.valuationBreakdown.formula}</div>
                      <div className="flex items-center justify-between pt-1 border-t border-afrocat-border/30 mt-1">
                        <span className="text-xs font-bold text-afrocat-teal">TRANSFER VALUE</span>
                        <span className="text-lg font-display font-bold text-afrocat-gold">{fmt(playerFinance.transferValue ?? 0)}</span>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => downloadPdf(`/api/finance/player/${selectedPlayerId}/valuation-pdf`, `Finance_${playerFinance?.playerName?.replace(/\s+/g,"_") || selectedPlayerId}.pdf`)}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-afrocat-teal/20 hover:bg-afrocat-teal/30 border border-afrocat-teal/40 text-afrocat-teal text-xs font-bold transition-all cursor-pointer"
                        data-testid="button-download-player-pdf">
                        <Download className="w-3.5 h-3.5" /> Download Player Finance PDF
                      </button>
                    )}
                  </div>
                )}

                {/* Payment History */}
                {(playerFinance.payments || []).filter((p: any) => p.status === "APPROVED").length > 0 && (
                  <div className="afrocat-card p-4 space-y-2">
                    <h4 className="font-bold text-sm text-afrocat-text mb-2">Payment History</h4>
                    {(playerFinance.payments || []).filter((p: any) => p.status === "APPROVED").map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-afrocat-border/40 last:border-0">
                        <div>
                          <div className="text-xs font-medium text-afrocat-text">{p.feeType?.replace(/_/g, " ")} — {p.paymentDate}</div>
                          <div className="text-[10px] text-afrocat-muted">Paid by {p.paidBy}{p.paidByName ? ` (${p.paidByName})` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-afrocat-text">{fmt(p.amount)}</div>
                          {statusBadge(p.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "valuations" && canManage && (
          <div className="space-y-5">
            {valuationsLoading ? (
              <div className="flex items-center justify-center py-20 text-afrocat-muted">Loading valuations…</div>
            ) : valuations ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Players</div>
                    <div className="text-2xl font-display font-bold text-afrocat-text" data-testid="val-player-count">{valuations.totals?.playerCount ?? 0}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Officials</div>
                    <div className="text-2xl font-display font-bold text-afrocat-text" data-testid="val-official-count">{valuations.totals?.officialCount ?? 0}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Total Outstanding</div>
                    <div className="text-xl font-display font-bold text-red-400" data-testid="val-total-outstanding">{fmt(valuations.totals?.totalOutstanding ?? 0)}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Squad Transfer Pool</div>
                    <div className="text-xl font-display font-bold text-afrocat-gold" data-testid="val-transfer-pool">{fmt(valuations.totals?.totalTransferValue ?? 0)}</div>
                  </div>
                </div>

                <div className="afrocat-card p-3 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={valFilter.search}
                    onChange={e => setValFilter(f => ({ ...f, search: e.target.value }))}
                    placeholder="Search by name, position, team…"
                    className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text"
                    data-testid="input-val-search"
                  />
                  {/* Team PDF */}
                  {valuations?.players && (() => {
                    const teams = Array.from(new Map((valuations.players as any[]).filter(r => r.teamId).map((r: any) => [r.teamId, r.team])).entries());
                    return teams.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={selectedTeamPdf}
                          onChange={e => setSelectedTeamPdf(e.target.value)}
                          className="px-2 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-xs text-afrocat-text"
                          data-testid="select-team-pdf"
                        >
                          <option value="">Team PDF…</option>
                          {teams.map(([id, name]) => <option key={id as string} value={id as string}>{name as string}</option>)}
                        </select>
                        {selectedTeamPdf && (
                          <button
                            onClick={() => { const name = (valuations?.players as any[])?.find(r => r.teamId === selectedTeamPdf)?.team || selectedTeamPdf; downloadPdf(`/api/finance/team/${selectedTeamPdf}/valuation-pdf`, `Team_Finance_${name.replace(/\s+/g,"_")}.pdf`); }}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-afrocat-teal/20 hover:bg-afrocat-teal/30 border border-afrocat-teal/40 text-afrocat-teal text-xs font-bold cursor-pointer"
                            data-testid="button-team-pdf">
                            <Download className="w-3.5 h-3.5" /> Get
                          </button>
                        )}
                      </div>
                    ) : null;
                  })()}
                  <button
                    onClick={() => downloadPdf("/api/finance/club/valuation-pdf", `Afrocat_Club_Finance_${new Date().toISOString().slice(0,10)}.pdf`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-gold hover:bg-afrocat-gold/80 text-afrocat-dark text-sm font-bold cursor-pointer"
                    data-testid="button-club-finance-pdf"
                  >
                    <Download className="w-4 h-4" /> Club PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-teal hover:bg-afrocat-teal/80 text-white text-sm font-bold"
                    data-testid="button-val-print"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>

                <div className="afrocat-card overflow-hidden">
                  <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-4 py-2.5 flex items-center justify-between">
                    <h3 className="font-display font-bold text-afrocat-teal text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" /> Player Membership Dues & Transfer Values ({valPlayerRows.length})
                    </h3>
                    <p className="text-[10px] text-afrocat-muted hidden sm:block">
                      Fee policy: Working N${valuations.feeConfig?.membershipW ?? 800} · Non-working N${valuations.feeConfig?.membershipNW ?? 400} · Dev N${valuations.feeConfig?.devFee ?? 2500} · Resources N${valuations.feeConfig?.resFee ?? 1500}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-player-valuations">
                      <thead className="bg-afrocat-white-3 border-b border-afrocat-border">
                        <tr>
                          {sortHeader("name", "Player")}
                          {sortHeader("position", "Pos")}
                          {sortHeader("team", "Team")}
                          {sortHeader("age", "Age")}
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Class</th>
                          {sortHeader("fees.total", "Total Due")}
                          {sortHeader("totalPaid", "Paid")}
                          {sortHeader("outstanding", "Outstanding")}
                          {sortHeader("perfScore", "Perf Score")}
                          {sortHeader("attendRate", "Attend %")}
                          {sortHeader("transferValue", "Transfer Value")}
                          <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-afrocat-border">
                        {valPlayerRows.length === 0 && (
                          <tr><td colSpan={12} className="py-8 text-center text-afrocat-muted text-sm">No players found.</td></tr>
                        )}
                        {valPlayerRows.map((r: any, i: number) => {
                          const tv = r.transferValue ?? 0;
                          const tvTier = tv >= 15000 ? "text-afrocat-gold font-bold" : tv >= 10000 ? "text-afrocat-teal font-bold" : tv >= 7000 ? "text-green-400 font-semibold" : tv >= 4000 ? "text-afrocat-text" : "text-afrocat-muted";
                          const perfColor = r.perfScore >= 70 ? "bg-afrocat-gold-soft text-afrocat-gold" : r.perfScore >= 55 ? "bg-afrocat-teal-soft text-afrocat-teal" : r.perfScore >= 40 ? "bg-green-900/30 text-green-400" : "bg-afrocat-red-soft text-afrocat-red";
                          return (
                            <tr key={r.id} className={`hover:bg-afrocat-white-3 transition-colors ${i % 2 === 0 ? "" : "bg-afrocat-white-3/30"}`} data-testid={`row-val-player-${r.id}`}>
                              <td className="px-3 py-2.5 font-medium text-afrocat-text">{r.name}</td>
                              <td className="px-3 py-2.5 text-afrocat-muted text-xs">{r.position}</td>
                              <td className="px-3 py-2.5 text-afrocat-muted text-xs">{r.team}</td>
                              <td className="px-3 py-2.5 text-afrocat-muted text-xs">{r.age ?? "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.employmentClass === "WORKING" ? "bg-afrocat-teal-soft text-afrocat-teal" : "bg-afrocat-white-5 text-afrocat-muted"}`}>
                                  {r.employmentClass === "WORKING" ? "WORKING" : "NON-WORK"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-afrocat-text font-medium">{fmt(r.fees?.total ?? 0)}</td>
                              <td className="px-3 py-2.5 text-green-400 font-medium">{fmt(r.totalPaid ?? 0)}</td>
                              <td className="px-3 py-2.5">
                                <span className={`font-bold ${r.outstanding > 0 ? "text-red-400" : "text-green-400"}`}>{fmt(r.outstanding ?? 0)}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${perfColor}`}>
                                  {r.perfScore ?? 50}/100
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-afrocat-muted text-xs">{r.attendRate ?? 0}%</td>
                              <td className="px-3 py-2.5">
                                <span className={tvTier}>{fmt(tv)}</span>
                                {tv >= 15000 && <Star className="w-3 h-3 inline ml-1 text-afrocat-gold fill-current" />}
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  onClick={() => downloadPdf(`/api/finance/player/${r.id}/valuation-pdf`, `Finance_${r.name.replace(/\s+/g,"_")}.pdf`)}
                                  title={`Download PDF for ${r.name}`}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded bg-afrocat-white-5 hover:bg-afrocat-teal/20 border border-afrocat-border hover:border-afrocat-teal/40 text-afrocat-muted hover:text-afrocat-teal transition-all cursor-pointer"
                                  data-testid={`button-player-pdf-${r.id}`}>
                                  <Download className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {valPlayerRows.length > 0 && (
                        <tfoot className="bg-afrocat-white-3 border-t-2 border-afrocat-border">
                          <tr>
                            <td colSpan={5} className="px-3 py-2.5 font-bold text-afrocat-text text-sm">TOTALS ({valPlayerRows.length} players)</td>
                            <td className="px-3 py-2.5 font-bold text-afrocat-text">{fmt(valPlayerRows.reduce((s: number, r: any) => s + (r.fees?.total ?? 0), 0))}</td>
                            <td className="px-3 py-2.5 font-bold text-green-400">{fmt(valPlayerRows.reduce((s: number, r: any) => s + (r.totalPaid ?? 0), 0))}</td>
                            <td className="px-3 py-2.5 font-bold text-red-400">{fmt(valPlayerRows.reduce((s: number, r: any) => s + (r.outstanding ?? 0), 0))}</td>
                            <td colSpan={2} />
                            <td className="px-3 py-2.5 font-bold text-afrocat-gold">{fmt(valPlayerRows.reduce((s: number, r: any) => s + (r.transferValue ?? 0), 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                <div className="afrocat-card overflow-hidden">
                  <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-4 py-2.5">
                    <h3 className="font-display font-bold text-afrocat-gold text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Officials & Staff Membership Dues ({valOfficialRows.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-official-valuations">
                      <thead className="bg-afrocat-white-3 border-b border-afrocat-border">
                        <tr>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Name</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Role(s)</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Class</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Total Due</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Outstanding</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-afrocat-muted">Transfer Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-afrocat-border">
                        {valOfficialRows.length === 0 && (
                          <tr><td colSpan={6} className="py-6 text-center text-afrocat-muted text-sm">No officials found.</td></tr>
                        )}
                        {valOfficialRows.map((r: any, i: number) => (
                          <tr key={r.id} className={`hover:bg-afrocat-white-3 transition-colors ${i % 2 === 0 ? "" : "bg-afrocat-white-3/30"}`} data-testid={`row-val-official-${r.id}`}>
                            <td className="px-3 py-2.5 font-medium text-afrocat-text">{r.name}</td>
                            <td className="px-3 py-2.5 text-afrocat-muted text-xs">{r.position}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.employmentClass === "WORKING" ? "bg-afrocat-teal-soft text-afrocat-teal" : "bg-afrocat-white-5 text-afrocat-muted"}`}>
                                {r.employmentClass === "WORKING" ? "WORKING" : "NON-WORK"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-afrocat-text font-medium">{fmt(r.fees?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 font-bold text-red-400">{fmt(r.outstanding ?? 0)}</td>
                            <td className="px-3 py-2.5 text-afrocat-muted text-xs italic">N/A</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="afrocat-card p-4 bg-afrocat-white-3 border border-afrocat-border">
                  <h4 className="font-bold text-xs text-afrocat-muted uppercase tracking-wider mb-3">Transfer Value Methodology</h4>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-afrocat-muted">
                    <div><span className="text-afrocat-text font-semibold">Position Base:</span> OPP N$6,000 · OH N$5,000 · MB/S N$4,500 · L N$3,500 · Default N$4,000</div>
                    <div><span className="text-afrocat-text font-semibold">Age Multiplier:</span> &lt;17 ×0.7 · 17-21 ×1.5 · 22-26 ×2.0 · 27-30 ×1.4 · 31-34 ×0.9 · 35+ ×0.6</div>
                    <div><span className="text-afrocat-text font-semibold">Performance Score:</span> Weighted kills/aces/blocks/digs/assists per match, normalised 0-100</div>
                    <div><span className="text-afrocat-text font-semibold">Attendance Bonus:</span> Up to +40% for perfect attendance · Club investment added to final value</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === "ledger" && canManage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-afrocat-muted">Record income from other sources (sponsorships, events, donations) and general club expenses.</p>
              <button onClick={() => setShowLedgerForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-add-txn">
                <Plus className="w-4 h-4" /> Add Entry
              </button>
            </div>

            <div className="afrocat-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-afrocat-border bg-afrocat-white-3">
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Date</th>
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Type</th>
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Category</th>
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Description</th>
                      <th className="text-right p-3 text-xs font-bold text-afrocat-muted uppercase">Amount</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t: any) => (
                      <tr key={t.id} className="border-b border-afrocat-border" data-testid={`txn-row-${t.id}`}>
                        <td className="p-3 text-xs text-afrocat-text">{t.txnDate}</td>
                        <td className="p-3">
                          {t.type === "INCOME"
                            ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">INCOME</span>
                            : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">EXPENSE</span>}
                        </td>
                        <td className="p-3 text-xs text-afrocat-text">{t.category}</td>
                        <td className="p-3 text-xs text-afrocat-text">{t.description}</td>
                        <td className="p-3 text-right text-xs font-bold text-afrocat-text">{fmt(t.amount)}</td>
                        <td className="p-3">
                          <button onClick={() => deleteTxnMut.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer" data-testid={`button-delete-txn-${t.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txns.length === 0 && <div className="p-8 text-center text-afrocat-muted text-sm">No entries yet. Add income or expense entries above.</div>}
              </div>
            </div>

            {showLedgerForm && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-md p-6 space-y-4">
                  <h3 className="font-display font-bold text-lg text-afrocat-text">Add Income / Expense Entry</h3>

                  <div className="grid grid-cols-2 gap-2">
                    {["INCOME", "EXPENSE"].map(t => (
                      <button
                        key={t}
                        onClick={() => setLedgerForm({ ...ledgerForm, type: t, category: t === "INCOME" ? "Sponsorship" : "Venue Hire" })}
                        className={`py-2 rounded-xl font-bold text-sm cursor-pointer transition-all ${ledgerForm.type === t
                          ? t === "INCOME" ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border"}`}
                        data-testid={`button-txn-type-${t.toLowerCase()}`}
                      >
                        {t === "INCOME" ? "Income" : "Expense"}
                      </button>
                    ))}
                  </div>

                  <Select value={ledgerForm.category} onValueChange={(v) => setLedgerForm({ ...ledgerForm, category: v })}>
                    <SelectTrigger data-testid="select-txn-category"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {(ledgerForm.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="number"
                    placeholder="Amount (N$)"
                    value={ledgerForm.amount}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                    className={inputCls}
                    data-testid="input-txn-amount"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={ledgerForm.description}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                    className={inputCls}
                    data-testid="input-txn-description"
                  />
                  <input
                    type="text"
                    placeholder="Reference (optional)"
                    value={ledgerForm.reference}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, reference: e.target.value })}
                    className={inputCls}
                  />
                  <div>
                    <label className="text-xs text-afrocat-muted block mb-1">Transaction Date</label>
                    <input
                      type="date"
                      value={ledgerForm.txnDate}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, txnDate: e.target.value })}
                      className={inputCls}
                      data-testid="input-txn-date"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowLedgerForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                    <button
                      onClick={() => createTxnMut.mutate(ledgerForm)}
                      disabled={createTxnMut.isPending || !ledgerForm.amount || !ledgerForm.txnDate}
                      className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50"
                      data-testid="button-submit-txn"
                    >
                      {createTxnMut.isPending ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "income-statement" && canManage && (
          <div className="space-y-4">
            <div className="afrocat-card p-4">
              <p className="text-xs font-bold text-afrocat-muted uppercase mb-3">Filter Period</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-afrocat-muted block mb-1">From</label>
                  <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} className={inputCls} data-testid="input-stmt-from" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-afrocat-muted block mb-1">To</label>
                  <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} className={inputCls} data-testid="input-stmt-to" />
                </div>
                <button
                  onClick={() => setStmtFetch({ from: stmtFrom, to: stmtTo })}
                  className="px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer"
                  data-testid="button-generate-statement"
                >
                  Generate
                </button>
              </div>
            </div>

            {incomeStatement && (
              <div className="afrocat-card p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-afrocat-border pb-4">
                  <div>
                    <h2 className="font-display font-bold text-lg text-afrocat-text flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-afrocat-teal" /> Income Statement
                    </h2>
                    <p className="text-xs text-afrocat-muted mt-0.5">
                      {incomeStatement.period?.from || "All time"}{incomeStatement.period?.to ? ` to ${incomeStatement.period.to}` : ""}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-afrocat-teal opacity-40" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-green-400 mb-2 uppercase tracking-wider">Income</h3>
                  {incomeStatement.income?.playerFees?.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase text-afrocat-muted font-bold mb-1">Player Fees</p>
                      {incomeStatement.income.playerFees.map((f: any) => (
                        <SectionRow key={f.type} label={f.type.replace(/_/g, " ")} amount={f.amount} indent />
                      ))}
                      <SectionRow label="Total Player Fees" amount={incomeStatement.income.totalPlayerIncome} bold />
                    </>
                  )}
                  {incomeStatement.income?.otherIncome?.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase text-afrocat-muted font-bold mb-1 mt-3">Other Income</p>
                      {incomeStatement.income.otherIncome.map((f: any) => (
                        <SectionRow key={f.category} label={f.category} amount={f.amount} indent />
                      ))}
                      <SectionRow label="Total Other Income" amount={incomeStatement.income.totalOtherIncome} bold />
                    </>
                  )}
                  <div className="mt-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-400">TOTAL INCOME</span>
                      <span className="font-black text-green-400 text-lg" data-testid="text-total-income">{fmt(incomeStatement.income?.totalIncome || 0)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-red-400 mb-2 uppercase tracking-wider">Expenses</h3>
                  {incomeStatement.expenses?.playerExpenses?.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase text-afrocat-muted font-bold mb-1">Player Expenses</p>
                      {incomeStatement.expenses.playerExpenses.map((e: any) => (
                        <SectionRow key={e.reason} label={e.reason.replace(/_/g, " ")} amount={e.amount} indent />
                      ))}
                      <SectionRow label="Total Player Expenses" amount={incomeStatement.expenses.totalPlayerExpenses} bold />
                    </>
                  )}
                  {incomeStatement.expenses?.otherExpenses?.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase text-afrocat-muted font-bold mb-1 mt-3">Other Expenses</p>
                      {incomeStatement.expenses.otherExpenses.map((e: any) => (
                        <SectionRow key={e.category} label={e.category} amount={e.amount} indent />
                      ))}
                      <SectionRow label="Total Other Expenses" amount={incomeStatement.expenses.totalOtherExpenses} bold />
                    </>
                  )}
                  <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-400">TOTAL EXPENSES</span>
                      <span className="font-black text-red-400 text-lg" data-testid="text-total-expenses-stmt">{fmt(incomeStatement.expenses?.totalExpenses || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border-2 ${(incomeStatement.netSurplus || 0) >= 0 ? "bg-green-500/10 border-green-500/40" : "bg-red-500/10 border-red-500/40"}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-black text-base ${(incomeStatement.netSurplus || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(incomeStatement.netSurplus || 0) >= 0 ? "NET SURPLUS" : "NET DEFICIT"}
                    </span>
                    <span className={`font-black text-2xl ${(incomeStatement.netSurplus || 0) >= 0 ? "text-green-400" : "text-red-400"}`} data-testid="text-net-surplus">
                      {fmt(Math.abs(incomeStatement.netSurplus || 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!incomeStatement && (
              <div className="afrocat-card p-10 text-center space-y-2">
                <TrendingUp className="w-10 h-10 text-afrocat-muted mx-auto opacity-40" />
                <p className="text-afrocat-muted text-sm">Select a period and click Generate to view the Income Statement.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "balance-sheet" && canManage && (
          <div className="space-y-4">
            {balanceSheet ? (
              <div className="afrocat-card p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-afrocat-border pb-4">
                  <div>
                    <h2 className="font-display font-bold text-lg text-afrocat-text flex items-center gap-2">
                      <Scale className="w-5 h-5 text-afrocat-teal" /> Balance Sheet
                    </h2>
                    <p className="text-xs text-afrocat-muted mt-0.5">As at today — all-time cumulative position</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-afrocat-teal mb-2 uppercase tracking-wider">Assets</h3>
                  <SectionRow label="Cash from Player Fees" amount={balanceSheet.assets?.cashFromFees || 0} indent />
                  <SectionRow label="Other Income Received" amount={balanceSheet.assets?.otherIncome || 0} indent />
                  <SectionRow label="Cash & Bank Balance" amount={balanceSheet.assets?.cashAndBank || 0} bold />
                  <SectionRow label="Outstanding Receivables (pending payments)" amount={balanceSheet.assets?.outstandingReceivables || 0} indent />
                  <div className="mt-2 p-3 rounded-xl bg-afrocat-teal-soft border border-afrocat-teal/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-afrocat-teal">TOTAL ASSETS</span>
                      <span className="font-black text-afrocat-teal text-lg" data-testid="text-total-assets">{fmt(balanceSheet.assets?.totalAssets || 0)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-red-400 mb-2 uppercase tracking-wider">Liabilities</h3>
                  <SectionRow label="Player Expenses (approved)" amount={balanceSheet.liabilities?.playerExpenses || 0} indent />
                  <SectionRow label="Other Expenses (ledger)" amount={balanceSheet.liabilities?.otherExpenses || 0} indent />
                  <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-400">TOTAL LIABILITIES</span>
                      <span className="font-black text-red-400 text-lg" data-testid="text-total-liabilities">{fmt(balanceSheet.liabilities?.totalLiabilities || 0)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-afrocat-gold mb-2 uppercase tracking-wider">Equity / Retained Surplus</h3>
                  <div className={`p-4 rounded-xl border-2 ${(balanceSheet.equity?.retainedSurplus || 0) >= 0 ? "bg-afrocat-gold-soft border-afrocat-gold/30" : "bg-red-500/10 border-red-500/40"}`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-black text-base ${(balanceSheet.equity?.retainedSurplus || 0) >= 0 ? "text-afrocat-gold" : "text-red-400"}`}>
                        RETAINED SURPLUS
                      </span>
                      <span className={`font-black text-2xl ${(balanceSheet.equity?.retainedSurplus || 0) >= 0 ? "text-afrocat-gold" : "text-red-400"}`} data-testid="text-retained-surplus">
                        {fmt(Math.abs(balanceSheet.equity?.retainedSurplus || 0))}
                      </span>
                    </div>
                    <p className="text-xs text-afrocat-muted mt-1">Total Assets − Total Liabilities</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-afrocat-muted font-bold">Liabilities + Equity</span>
                    <span className="text-afrocat-text font-bold">
                      {fmt((balanceSheet.liabilities?.totalLiabilities || 0) + (balanceSheet.equity?.retainedSurplus || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="text-afrocat-muted font-bold">Total Assets</span>
                    <span className="text-afrocat-teal font-bold">{fmt(balanceSheet.assets?.totalAssets || 0)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="afrocat-card p-10 text-center space-y-2">
                <Scale className="w-10 h-10 text-afrocat-muted mx-auto opacity-40" />
                <p className="text-afrocat-muted text-sm">Loading balance sheet...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "config" && canManage && (
          <div className="afrocat-card p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-afrocat-text">Fee Configuration</h3>
            {[
              { key: "membershipFeeNonWorking", label: "Membership Fee (Non-Working)", default: "400" },
              { key: "membershipFeeWorking", label: "Membership Fee (Working)", default: "800" },
              { key: "developmentFee", label: "Development Fee (Once Off)", default: "2500" },
              { key: "resourceFee", label: "Resource Fee (Annual)", default: "1500" },
              { key: "leagueAffiliationFeePerPlayer", label: "League Affiliation Fee per Player", default: "0" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">{f.label}</label>
                <input
                  type="number"
                  value={feeForm[f.key] ?? feeConfig[f.key] ?? f.default}
                  onChange={(e) => setFeeForm({ ...feeForm, [f.key]: e.target.value })}
                  className={inputCls}
                  data-testid={`input-fee-${f.key}`}
                />
              </div>
            ))}
            <button
              onClick={() => saveFeeConfigMut.mutate({ ...feeConfig, ...feeForm })}
              disabled={saveFeeConfigMut.isPending}
              className="w-full py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50"
              data-testid="button-save-fee-config"
            >
              {saveFeeConfigMut.isPending ? "Saving..." : "Save Fee Config"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
