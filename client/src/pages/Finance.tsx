import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  DollarSign, Plus, Check, X, Settings, Users, FileText,
  ArrowUpRight, ArrowDownRight, Trash2, Eye, ChevronDown, ChevronUp
} from "lucide-react";

type Tab = "summary" | "payments" | "expenses" | "players" | "config" | "ledger";

const FEE_TYPES = ["MEMBERSHIP", "DEVELOPMENT", "RESOURCE", "LEAGUE_AFFILIATION", "OTHER"];
const PAID_BY_OPTIONS = ["PLAYER", "CLUB", "SPONSOR", "OTHER"];
const EXPENSE_REASONS = ["TRANSPORT", "TRACK_SUIT", "JERSEY", "SHOES", "TRIP", "MEDICAL", "OTHER"];
const EXPENSE_PAID_BY = ["CLUB", "COACH", "ADMIN", "SPONSOR", "OTHER"];

export default function Finance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canApprove = user && (user.role === "ADMIN" || user.role === "FINANCE" || user.isSuperAdmin || user.roles?.some((r: string) => ["ADMIN", "FINANCE"].includes(r)));
  const canManage = user && (user.role === "ADMIN" || user.role === "FINANCE" || user.role === "MANAGER" || user.isSuperAdmin);

  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const [payForm, setPayForm] = useState({ playerId: "", feeType: "MEMBERSHIP", amount: "", paidBy: "PLAYER", paidByName: "", reference: "", paymentDate: "" });
  const [expForm, setExpForm] = useState({ playerId: "", amount: "", paidBy: "CLUB", paidByName: "", reason: "TRANSPORT", notes: "", expenseDate: "" });
  const [feeForm, setFeeForm] = useState<Record<string, string>>({});

  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: txns = [] } = useQuery({ queryKey: ["/api/finance"], queryFn: api.getFinanceTxns });
  const { data: payments = [] } = useQuery({ queryKey: ["/api/finance/payments"], queryFn: () => api.getFinancePayments() });
  const { data: expenses = [] } = useQuery({ queryKey: ["/api/finance/expenses"], queryFn: () => api.getFinanceExpenses() });
  const { data: feeConfig = {} } = useQuery({ queryKey: ["/api/finance/fee-config"], queryFn: api.getFeeConfig });
  const { data: summary } = useQuery({ queryKey: ["/api/finance/summary"], queryFn: () => api.getFinanceSummary(), enabled: !!canManage });
  const { data: playerFinance } = useQuery({ queryKey: ["/api/finance/player", selectedPlayerId], queryFn: () => api.getPlayerFinance(selectedPlayerId), enabled: !!selectedPlayerId });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance"] }); toast({ title: "Transaction Added" }); },
  });

  const deleteTxnMut = useMutation({
    mutationFn: (id: string) => api.deleteFinanceTxn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance"] }); toast({ title: "Deleted" }); },
  });

  const tabs: { id: Tab; label: string; icon: any; show: boolean }[] = [
    { id: "summary", label: "Summary", icon: DollarSign, show: true },
    { id: "payments", label: "Payments", icon: ArrowUpRight, show: true },
    { id: "expenses", label: "Expenses", icon: ArrowDownRight, show: true },
    { id: "players", label: "Player Finance", icon: Users, show: true },
    { id: "config", label: "Fee Config", icon: Settings, show: !!canManage },
    { id: "ledger", label: "General Ledger", icon: FileText, show: !!canManage },
  ];

  const statusBadge = (status: string) => {
    if (status === "APPROVED") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">APPROVED</span>;
    if (status === "REJECTED") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">REJECTED</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400">PENDING</span>;
  };

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
              <p className="text-xs text-afrocat-muted">Fees, payments, expenses, approvals & player value</p>
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
                <div className="text-2xl font-display font-bold text-green-400">N${summary?.totalReceived || 0}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Received</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-2xl font-display font-bold text-red-400">N${summary?.totalExpenses || 0}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Expenses</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className={`text-2xl font-display font-bold ${(summary?.netPosition || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>N${summary?.netPosition || 0}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Net</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-2xl font-display font-bold text-yellow-400">N${summary?.pendingPayments || 0}</div>
                <div className="text-[10px] text-afrocat-muted uppercase font-bold">Pending</div>
              </div>
            </div>

            <div className="afrocat-card p-5">
              <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Current Fee Schedule</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                  <div className="text-xs text-afrocat-muted">Non-Working Membership</div>
                  <div className="text-lg font-bold text-afrocat-text">N${feeConfig.membershipFeeNonWorking || "400"}</div>
                </div>
                <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                  <div className="text-xs text-afrocat-muted">Working Membership</div>
                  <div className="text-lg font-bold text-afrocat-text">N${feeConfig.membershipFeeWorking || "800"}</div>
                </div>
                <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                  <div className="text-xs text-afrocat-muted">Development Fee</div>
                  <div className="text-lg font-bold text-afrocat-text">N${feeConfig.developmentFee || "2500"}</div>
                </div>
                <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                  <div className="text-xs text-afrocat-muted">Resource Fee</div>
                  <div className="text-lg font-bold text-afrocat-text">N${feeConfig.resourceFee || "1500"}</div>
                </div>
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
                    <div className="text-sm font-bold text-afrocat-text">N${p.amount}</div>
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
                    <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={payForm.feeType} onValueChange={(v) => setPayForm({ ...payForm, feeType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="number" placeholder="Amount (N$)" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-payment-amount" />
                  <Select value={payForm.paidBy} onValueChange={(v) => setPayForm({ ...payForm, paidBy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAID_BY_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  {payForm.paidBy !== "PLAYER" && (
                    <input type="text" placeholder="Paid by name" value={payForm.paidByName} onChange={(e) => setPayForm({ ...payForm, paidByName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
                  )}
                  <input type="text" placeholder="Reference" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
                  <input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-payment-date" />
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                    <button onClick={() => createPaymentMut.mutate(payForm)} disabled={createPaymentMut.isPending}
                      className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-submit-payment">
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
                    <div className="text-sm font-bold text-afrocat-text">N${e.amount}</div>
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
                    <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={expForm.reason} onValueChange={(v) => setExpForm({ ...expForm, reason: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="number" placeholder="Amount (N$)" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-expense-amount" />
                  <Select value={expForm.paidBy} onValueChange={(v) => setExpForm({ ...expForm, paidBy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_PAID_BY.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <input type="text" placeholder="Notes" value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
                  <input type="date" value={expForm.expenseDate} onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-expense-date" />
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowExpenseForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                    <button onClick={() => createExpenseMut.mutate(expForm)} disabled={createExpenseMut.isPending}
                      className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-submit-expense">
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
            <div className="afrocat-card p-4">
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger data-testid="select-player-finance"><SelectValue placeholder="Select a player to view finances" /></SelectTrigger>
                <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName} (#{p.jerseyNo})</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {playerFinance && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Total Due</div>
                    <div className="text-xl font-display font-bold text-afrocat-text">N${playerFinance.fees?.total || 0}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Paid by Player</div>
                    <div className="text-xl font-display font-bold text-green-400">N${playerFinance.totalPaidByPlayer ?? 0}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <div className="text-xs text-afrocat-muted uppercase font-bold mb-1">Outstanding</div>
                    <div className="text-xl font-display font-bold text-red-400">N${playerFinance.outstanding ?? 0}</div>
                  </div>
                  <div className="afrocat-card p-4 text-center border-2 border-afrocat-gold/30">
                    <div className="text-xs text-afrocat-gold uppercase font-bold mb-1">Player Value</div>
                    <div className="text-xl font-display font-bold text-afrocat-gold">N${playerFinance.playerValue ?? 0}</div>
                  </div>
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Fee Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries(playerFinance.fees || {}).filter(([k]) => k !== "total").map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                        <span className="text-xs font-bold text-afrocat-muted uppercase">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-sm font-bold text-afrocat-text">N${String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Club Contribution: N${(playerFinance.clubExpenses ?? 0) + (playerFinance.totalPaidByOthers ?? 0)}</h3>
                  <p className="text-xs text-afrocat-muted">Includes approved expenses and payments where paidBy ≠ PLAYER</p>
                </div>
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
                  className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
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

        {activeTab === "ledger" && canManage && (
          <div className="space-y-4">
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
                      <tr key={t.id} className="border-b border-afrocat-border">
                        <td className="p-3 text-xs text-afrocat-text">{t.txnDate}</td>
                        <td className="p-3">{t.type === "INCOME" ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">INCOME</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">EXPENSE</span>}</td>
                        <td className="p-3 text-xs text-afrocat-text">{t.category}</td>
                        <td className="p-3 text-xs text-afrocat-text">{t.description}</td>
                        <td className="p-3 text-right text-xs font-bold text-afrocat-text">N${t.amount}</td>
                        <td className="p-3"><button onClick={() => deleteTxnMut.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txns.length === 0 && <div className="p-8 text-center text-afrocat-muted text-sm">No general ledger transactions.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}