import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, CheckCircle, XCircle, Clock, AlertTriangle, Shield,
  Package, Truck, DollarSign, Calculator, Printer, Trash2, ChevronDown, ChevronUp,
  CreditCard, Banknote, Users, TrendingUp, Hash, Loader2
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

const ATTIRE_PRESETS = [
  { name: "Membership Fee", price: 350, category: "fee" },
  { name: "Tracksuit Top", price: 350, category: "attire" },
  { name: "Tracksuit Bottom", price: 250, category: "attire" },
  { name: "Volleyball Vest", price: 270, category: "attire" },
  { name: "Afrocat Sublimated Shirt", price: 350, category: "attire" },
  { name: "Bag", price: 250, category: "attire" },
  { name: "Tight Short", price: 200, category: "attire" },
  { name: "Tight Long", price: 380, category: "attire" },
  { name: "2nd Skin", price: 350, category: "attire" },
  { name: "Sublimated Shorts", price: 250, category: "attire" },
  { name: "Sleeves", price: 120, category: "attire" },
  { name: "Transport (Weekly)", price: 50, category: "transport" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

const CONTRIBUTION_TYPES = [
  "First Aid", "Petrol", "Ball", "Tournament", "Year End", "Tour", "Other"
];

const FUNDRAISING_DEFAULTS = [
  { name: "Fun Day", amount: 100 },
  { name: "Raffle", amount: 100 },
  { name: "Mr & Miss Afrocat", amount: 150 },
  { name: "Tournament", amount: 200 },
];

const statusColors: Record<string, string> = {
  DRAFT: "bg-afrocat-white-10 text-afrocat-muted",
  ACTIVE: "bg-afrocat-green-soft text-afrocat-green",
  EXPIRED: "bg-afrocat-gold-soft text-afrocat-gold",
  TERMINATED: "bg-afrocat-red-soft text-afrocat-red",
};

const statusIcons: Record<string, any> = {
  DRAFT: Clock, ACTIVE: CheckCircle, EXPIRED: AlertTriangle, TERMINATED: XCircle,
};

const transferStatusColors: Record<string, string> = {
  DRAFT: "bg-afrocat-white-10 text-afrocat-muted",
  CONFIRMED: "bg-afrocat-teal-soft text-afrocat-teal",
  PAID: "bg-afrocat-green-soft text-afrocat-green",
  CLOSED: "bg-afrocat-gold-soft text-afrocat-gold",
};

function ContractDetail({ contract, isAdmin, players }: { contract: any; isAdmin: boolean; players: any[] }) {
  const [activeTab, setActiveTab] = useState<string>("summary");

  const tabs = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "fees", label: "Fees", icon: DollarSign },
    { id: "items", label: "Attire & Items", icon: Package },
    { id: "contributions", label: "Contributions", icon: CreditCard },
    { id: "transport", label: "Transport", icon: Truck },
    { id: "fundraising", label: "Fund Raising", icon: Banknote },
    { id: "value", label: "Player Value", icon: TrendingUp },
    { id: "transfer", label: "Transfer", icon: Calculator },
  ];

  return (
    <div className="mt-4 border-t border-afrocat-border pt-4">
      <div className="flex gap-1 border-b border-afrocat-border mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-afrocat-teal text-afrocat-teal" : "border-transparent text-afrocat-muted hover:text-afrocat-text"}`}
            data-testid={`tab-${t.id}-${contract.id}`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      {activeTab === "summary" && <ContractSummary contract={contract} isAdmin={isAdmin} />}
      {activeTab === "fees" && <ContractFees contract={contract} isAdmin={isAdmin} />}
      {activeTab === "items" && <ContractItems contractId={contract.id} isAdmin={isAdmin} />}
      {activeTab === "contributions" && <ContractContributions contract={contract} isAdmin={isAdmin} />}
      {activeTab === "transport" && <ContractTransport contractId={contract.id} isAdmin={isAdmin} />}
      {activeTab === "fundraising" && <FundRaisingPanel isAdmin={isAdmin} players={players} />}
      {activeTab === "value" && <PlayerValuePanel playerId={contract.playerId} />}
      {activeTab === "transfer" && <TransferCalculator contract={contract} isAdmin={isAdmin} />}
    </div>
  );
}

function ContractSummary({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const cur = contract.currency || "NAD";

  const investPdfMut = useMutation({
    mutationFn: () => api.generateContractInvestmentPdf(contract.id),
    onSuccess: (data: any) => {
      const w = window.open("", "_blank");
      if (w) { w.document.write(data.html); w.document.close(); }
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {contract.signOnFee != null && (
          <div className="p-3 rounded-lg bg-afrocat-white-3">
            <p className="text-xs text-afrocat-muted">Sign-On Fee</p>
            <p className="font-semibold text-afrocat-text" data-testid={`text-sign-on-${contract.id}`}>{cur} {contract.signOnFee?.toLocaleString()}</p>
          </div>
        )}
        {contract.weeklyTransport != null && (
          <div className="p-3 rounded-lg bg-afrocat-white-3">
            <p className="text-xs text-afrocat-muted">Weekly Transport</p>
            <p className="font-semibold text-afrocat-text">{cur} {contract.weeklyTransport?.toLocaleString()}</p>
          </div>
        )}
        {contract.salaryAmount != null && (
          <div className="p-3 rounded-lg bg-afrocat-white-3">
            <p className="text-xs text-afrocat-muted">Salary</p>
            <p className="font-semibold text-afrocat-text">{cur} {contract.salaryAmount?.toLocaleString()}</p>
          </div>
        )}
        {contract.releaseFee != null && (
          <div className="p-3 rounded-lg bg-afrocat-white-3">
            <p className="text-xs text-afrocat-muted">Release Fee</p>
            <p className="font-semibold text-afrocat-text">{cur} {contract.releaseFee?.toLocaleString()}</p>
          </div>
        )}
        <div className="p-3 rounded-lg bg-afrocat-white-3">
          <p className="text-xs text-afrocat-muted">Duration</p>
          <p className="font-semibold text-afrocat-text">{Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months</p>
        </div>
      </div>
      {contract.obligations && (
        <div className="text-sm">
          <p className="text-afrocat-muted mb-1">Obligations</p>
          <p className="bg-afrocat-white-3 rounded-lg p-3 text-afrocat-text">{contract.obligations}</p>
        </div>
      )}
      {isAdmin && (
        <Button variant="outline" size="sm" onClick={() => investPdfMut.mutate()} disabled={investPdfMut.isPending} className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5" data-testid={`button-investment-pdf-${contract.id}`}>
          <Printer size={14} className="mr-1" /> {investPdfMut.isPending ? "Generating..." : "Investment Summary PDF"}
        </Button>
      )}
    </div>
  );
}

function ContractFees({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const cur = contract.currency || "NAD";
  const [fees, setFees] = useState({
    membershipFeeRequired: contract.membershipFeeRequired ?? "",
    membershipFeePaid: contract.membershipFeePaid ?? "",
    developmentFeeRequired: contract.developmentFeeRequired ?? "",
    developmentFeePaid: contract.developmentFeePaid ?? "",
  });

  const saveMut = useMutation({
    mutationFn: () => api.updateContractFees(contract.id, {
      membershipFeeRequired: fees.membershipFeeRequired !== "" ? parseFloat(fees.membershipFeeRequired as any) : null,
      membershipFeePaid: fees.membershipFeePaid !== "" ? parseFloat(fees.membershipFeePaid as any) : null,
      developmentFeeRequired: fees.developmentFeeRequired !== "" ? parseFloat(fees.developmentFeeRequired as any) : null,
      developmentFeePaid: fees.developmentFeePaid !== "" ? parseFloat(fees.developmentFeePaid as any) : null,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });

  const memOut = Math.max(0, (parseFloat(fees.membershipFeeRequired as any) || 0) - (parseFloat(fees.membershipFeePaid as any) || 0));
  const devOut = Math.max(0, (parseFloat(fees.developmentFeeRequired as any) || 0) - (parseFloat(fees.developmentFeePaid as any) || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2 text-afrocat-text"><DollarSign size={14} className="text-afrocat-teal" /> Membership Fee</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Required</label>
              <input type="number" step="0.01" value={fees.membershipFeeRequired} onChange={e => setFees(f => ({ ...f, membershipFeeRequired: e.target.value as any }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" disabled={!isAdmin} data-testid="input-membership-required" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Paid</label>
              <input type="number" step="0.01" value={fees.membershipFeePaid} onChange={e => setFees(f => ({ ...f, membershipFeePaid: e.target.value as any }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" disabled={!isAdmin} data-testid="input-membership-paid" />
            </div>
          </div>
          <div className="text-sm"><span className="text-afrocat-muted">Outstanding: </span><span className={`font-bold ${memOut > 0 ? "text-afrocat-red" : "text-afrocat-green"}`}>{cur} {memOut.toFixed(2)}</span></div>
        </div>
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2 text-afrocat-text"><DollarSign size={14} className="text-afrocat-teal" /> Development Fee</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Required</label>
              <input type="number" step="0.01" value={fees.developmentFeeRequired} onChange={e => setFees(f => ({ ...f, developmentFeeRequired: e.target.value as any }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" disabled={!isAdmin} data-testid="input-development-required" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Paid</label>
              <input type="number" step="0.01" value={fees.developmentFeePaid} onChange={e => setFees(f => ({ ...f, developmentFeePaid: e.target.value as any }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" disabled={!isAdmin} data-testid="input-development-paid" />
            </div>
          </div>
          <div className="text-sm"><span className="text-afrocat-muted">Outstanding: </span><span className={`font-bold ${devOut > 0 ? "text-afrocat-red" : "text-afrocat-green"}`}>{cur} {devOut.toFixed(2)}</span></div>
        </div>
      </div>
      {isAdmin && (
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-save-fees">
          {saveMut.isPending ? "Saving..." : "Save Fees"}
        </Button>
      )}
    </div>
  );
}

function ContractItems({ contractId, isAdmin }: { contractId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["contractItems", contractId], queryFn: () => api.getContractItems(contractId) });
  const [showAdd, setShowAdd] = useState(false);
  const [itemForm, setItemForm] = useState({ itemName: "", quantity: "1", unitValue: "0", size: "", dateIssued: new Date().toISOString().split("T")[0], notes: "" });

  const handlePresetSelect = (presetName: string) => {
    const preset = ATTIRE_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setItemForm(f => ({ ...f, itemName: preset.name, unitValue: preset.price.toString() }));
    }
  };

  const createMut = useMutation({
    mutationFn: () => api.createContractItem(contractId, {
      itemName: itemForm.itemName,
      quantity: parseInt(itemForm.quantity),
      unitValue: parseFloat(itemForm.unitValue),
      size: itemForm.size || null,
      dateIssued: itemForm.dateIssued,
      notes: itemForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractItems", contractId] });
      setShowAdd(false);
      setItemForm({ itemName: "", quantity: "1", unitValue: "0", size: "", dateIssued: new Date().toISOString().split("T")[0], notes: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteContractItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contractItems", contractId] }),
  });

  const total = items.reduce((s: number, i: any) => s + (i.totalValue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-afrocat-text">Attire & Items Issued ({items.length})</h4>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-add-item">
            <Plus size={14} className="mr-1" /> Add Item
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3 border border-afrocat-border">
          <div>
            <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">Quick Select Attire</label>
            <div className="flex flex-wrap gap-1.5">
              {ATTIRE_PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => handlePresetSelect(p.name)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${itemForm.itemName === p.name ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:bg-afrocat-white-10 border border-afrocat-border"}`}
                  data-testid={`button-preset-${p.name.replace(/\s/g, "-").toLowerCase()}`}
                >
                  {p.name} — N${p.price}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-afrocat-muted">Item Name *</label>
              <input value={itemForm.itemName} onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-item-name" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Size</label>
              <select value={itemForm.size} onChange={e => setItemForm(f => ({ ...f, size: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-item-size">
                <option value="">N/A</option>
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Qty</label>
              <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-item-qty" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Unit Price (N$)</label>
              <input type="number" step="0.01" min="0" value={itemForm.unitValue} onChange={e => setItemForm(f => ({ ...f, unitValue: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-item-unit-value" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Date Issued</label>
              <input type="date" value={itemForm.dateIssued} onChange={e => setItemForm(f => ({ ...f, dateIssued: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-item-date" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Notes</label>
              <input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-item-notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!itemForm.itemName || createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-save-item">
              {createMut.isPending ? "Saving..." : "Save Item"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
              <tr>
                <th className="py-2 px-3 text-left">Date</th><th className="py-2 px-3 text-left">Item</th><th className="py-2 px-3 text-left">Size</th><th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Unit</th><th className="py-2 px-3 text-right">Total</th><th className="py-2 px-3 text-left">Notes</th>{isAdmin && <th className="py-2 px-3"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-item-${item.id}`}>
                  <td className="py-2 px-3 text-afrocat-muted">{item.dateIssued}</td>
                  <td className="py-2 px-3 font-medium text-afrocat-text">{item.itemName}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{item.size || "—"}</td>
                  <td className="py-2 px-3 text-right text-afrocat-text">{item.quantity}</td>
                  <td className="py-2 px-3 text-right text-afrocat-text">{(item.unitValue || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-afrocat-gold">{(item.totalValue || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{item.notes || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <button onClick={() => deleteMut.mutate(item.id)} className="text-afrocat-red hover:text-afrocat-red/70" data-testid={`button-delete-item-${item.id}`}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-afrocat-white-5">
                <td colSpan={5} className="py-2 px-3 text-right text-afrocat-muted">Total Items Value:</td>
                <td className="py-2 px-3 text-right text-afrocat-gold" data-testid="text-items-total">N$ {total.toFixed(2)}</td>
                <td colSpan={isAdmin ? 2 : 1}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-afrocat-muted text-center py-6">No items issued yet</p>
      )}
    </div>
  );
}

function ContractContributions({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contributions = [] } = useQuery({
    queryKey: ["contractContributions", contract.id],
    queryFn: () => api.getContractContributions(contract.id),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ itemName: CONTRIBUTION_TYPES[0], amount: "", dueDate: "", notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createContractContribution(contract.id, {
      playerId: contract.playerId,
      itemName: form.itemName,
      amount: parseFloat(form.amount),
      status: "DUE",
      dueDate: form.dueDate || null,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractContributions", contract.id] });
      setShowAdd(false);
      setForm({ itemName: CONTRIBUTION_TYPES[0], amount: "", dueDate: "", notes: "" });
      toast({ title: "Contribution added", description: "Player will be notified." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateContribution(id, { status, paidDate: status === "PAID" ? new Date().toISOString().split("T")[0] : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractContributions", contract.id] });
      toast({ title: "Status updated", description: "Player notified of payment update." });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteContribution(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contractContributions", contract.id] }),
  });

  const totalDue = contributions.filter((c: any) => c.status !== "PAID").reduce((s: number, c: any) => s + (c.amount || 0), 0);
  const totalPaid = contributions.filter((c: any) => c.status === "PAID").reduce((s: number, c: any) => s + (c.amount || 0), 0);

  const contribStatusColors: Record<string, string> = {
    PAID: "bg-afrocat-green-soft text-afrocat-green",
    DUE: "bg-afrocat-red-soft text-afrocat-red",
    PARTIAL: "bg-afrocat-gold-soft text-afrocat-gold",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm text-afrocat-text">For Office Use — Contributions ({contributions.length})</h4>
          <div className="flex gap-4 mt-1 text-xs">
            <span className="text-afrocat-green font-bold">Paid: N$ {totalPaid.toFixed(2)}</span>
            <span className="text-afrocat-red font-bold">Due: N$ {totalDue.toFixed(2)}</span>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-add-contribution">
            <Plus size={14} className="mr-1" /> Add
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3 border border-afrocat-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Type *</label>
              <select value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-contribution-type">
                {CONTRIBUTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Amount (N$) *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-contribution-amount" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-contribution-due" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-contribution-notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.amount || createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-save-contribution">
              {createMut.isPending ? "Saving..." : "Add Contribution"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
          </div>
        </div>
      )}

      {contributions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
              <tr>
                <th className="py-2 px-3 text-left">Type</th><th className="py-2 px-3 text-right">Amount</th><th className="py-2 px-3 text-center">Status</th><th className="py-2 px-3 text-left">Due</th><th className="py-2 px-3 text-left">Paid</th><th className="py-2 px-3 text-left">Notes</th>{isAdmin && <th className="py-2 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {contributions.map((c: any) => (
                <tr key={c.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-contribution-${c.id}`}>
                  <td className="py-2 px-3 font-medium text-afrocat-text">{c.itemName}</td>
                  <td className="py-2 px-3 text-right font-semibold text-afrocat-text">N$ {(c.amount || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${contribStatusColors[c.status] || ""}`}>{c.status}</span>
                  </td>
                  <td className="py-2 px-3 text-afrocat-muted">{c.dueDate || "—"}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{c.paidDate || "—"}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{c.notes || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {c.status !== "PAID" && (
                          <button onClick={() => updateStatusMut.mutate({ id: c.id, status: "PAID" })} className="px-2 py-0.5 rounded text-xs bg-afrocat-green-soft text-afrocat-green font-bold hover:bg-afrocat-green/20" data-testid={`button-mark-paid-${c.id}`}>
                            Mark Paid
                          </button>
                        )}
                        {c.status === "PAID" && (
                          <button onClick={() => updateStatusMut.mutate({ id: c.id, status: "DUE" })} className="px-2 py-0.5 rounded text-xs bg-afrocat-gold-soft text-afrocat-gold font-bold hover:bg-afrocat-gold/20" data-testid={`button-mark-due-${c.id}`}>
                            Mark Due
                          </button>
                        )}
                        <button onClick={() => deleteMut.mutate(c.id)} className="text-afrocat-red hover:text-afrocat-red/70" data-testid={`button-delete-contribution-${c.id}`}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-afrocat-muted text-center py-6">No contributions recorded yet</p>
      )}
    </div>
  );
}

function ContractTransport({ contractId, isAdmin }: { contractId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: benefits = [] } = useQuery({ queryKey: ["contractTransport", contractId], queryFn: () => api.getContractTransport(contractId) });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ benefitType: "TRAINING_TRANSPORT", dateFrom: "", dateTo: "", amount: "", frequency: "MONTHLY" as string, notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createContractTransport(contractId, {
      benefitType: form.benefitType, dateFrom: form.dateFrom, dateTo: form.dateTo || null,
      amount: parseFloat(form.amount), frequency: form.frequency, notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractTransport", contractId] });
      setShowAdd(false);
      setForm({ benefitType: "TRAINING_TRANSPORT", dateFrom: "", dateTo: "", amount: "", frequency: "MONTHLY", notes: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteContractTransport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contractTransport", contractId] }),
  });

  const typeLabels: Record<string, string> = { TRAINING_TRANSPORT: "Training", MATCH_TRANSPORT: "Match", OTHER: "Other" };
  const freqLabels: Record<string, string> = { ONE_TIME: "One-Time", WEEKLY: "Weekly", MONTHLY: "Monthly", PER_TRIP: "Per Trip" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-afrocat-text">Transport Benefits ({benefits.length})</h4>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-add-transport">
            <Plus size={14} className="mr-1" /> Add Benefit
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3 border border-afrocat-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Type</label>
              <select value={form.benefitType} onChange={e => setForm(f => ({ ...f, benefitType: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-transport-type">
                <option value="TRAINING_TRANSPORT">Training Transport</option>
                <option value="MATCH_TRANSPORT">Match Transport</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-transport-frequency">
                <option value="ONE_TIME">One-Time</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="PER_TRIP">Per Trip</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Amount (N$)</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-transport-amount" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Date From *</label>
              <input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-transport-from" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Date To</label>
              <input type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-transport-to" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-transport-notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.dateFrom || !form.amount || createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-save-transport">
              {createMut.isPending ? "Saving..." : "Save Benefit"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
          </div>
        </div>
      )}

      {benefits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
              <tr>
                <th className="py-2 px-3 text-left">Type</th><th className="py-2 px-3 text-left">Freq</th><th className="py-2 px-3 text-right">Amount</th><th className="py-2 px-3 text-left">From</th><th className="py-2 px-3 text-left">To</th><th className="py-2 px-3 text-left">Notes</th>{isAdmin && <th className="py-2 px-3"></th>}
              </tr>
            </thead>
            <tbody>
              {benefits.map((b: any) => (
                <tr key={b.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-transport-${b.id}`}>
                  <td className="py-2 px-3 text-afrocat-text">{typeLabels[b.benefitType] || b.benefitType}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{freqLabels[b.frequency] || b.frequency}</td>
                  <td className="py-2 px-3 text-right font-semibold text-afrocat-gold">{(b.amount || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{b.dateFrom}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{b.dateTo || "Ongoing"}</td>
                  <td className="py-2 px-3 text-afrocat-muted">{b.notes || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <button onClick={() => deleteMut.mutate(b.id)} className="text-afrocat-red hover:text-afrocat-red/70" data-testid={`button-delete-transport-${b.id}`}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-afrocat-muted text-center py-6">No transport benefits yet</p>
      )}
    </div>
  );
}

function FundRaisingPanel({ isAdmin, players }: { isAdmin: boolean; players: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: activities = [] } = useQuery({ queryKey: ["fundraisingActivities"], queryFn: api.getFundRaisingActivities });
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [actForm, setActForm] = useState({ name: "", targetAmount: "", season: new Date().getFullYear().toString() });
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  const createActMut = useMutation({
    mutationFn: () => api.createFundRaisingActivity({
      name: actForm.name, targetAmount: parseFloat(actForm.targetAmount), season: actForm.season || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fundraisingActivities"] });
      setShowAddActivity(false);
      setActForm({ name: "", targetAmount: "", season: new Date().getFullYear().toString() });
      toast({ title: "Activity created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteActMut = useMutation({
    mutationFn: (id: string) => api.deleteFundRaisingActivity(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fundraisingActivities"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-afrocat-text">Fund Raising Activities ({activities.length})</h4>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAddActivity(!showAddActivity)} className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black" data-testid="button-add-activity">
            <Plus size={14} className="mr-1" /> New Activity
          </Button>
        )}
      </div>

      {showAddActivity && (
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3 border border-afrocat-border">
          <div>
            <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">Quick Select</label>
            <div className="flex flex-wrap gap-1.5">
              {FUNDRAISING_DEFAULTS.map(d => (
                <button key={d.name} onClick={() => setActForm(f => ({ ...f, name: d.name, targetAmount: d.amount.toString() }))} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${actForm.name === d.name ? "bg-afrocat-gold text-black" : "bg-afrocat-white-5 text-afrocat-muted hover:bg-afrocat-white-10 border border-afrocat-border"}`} data-testid={`button-fr-preset-${d.name.replace(/\s/g, "-").toLowerCase()}`}>
                  {d.name} — N${d.amount}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">Name *</label>
              <input value={actForm.name} onChange={e => setActForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-activity-name" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Target (N$) *</label>
              <input type="number" step="0.01" min="0" value={actForm.targetAmount} onChange={e => setActForm(f => ({ ...f, targetAmount: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-activity-target" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Season</label>
              <input value={actForm.season} onChange={e => setActForm(f => ({ ...f, season: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-activity-season" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createActMut.mutate()} disabled={!actForm.name || !actForm.targetAmount || createActMut.isPending} className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black" data-testid="button-save-activity">
              {createActMut.isPending ? "Saving..." : "Create Activity"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddActivity(false)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
          </div>
        </div>
      )}

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((act: any) => (
            <div key={act.id} className="bg-afrocat-white-3 rounded-lg border border-afrocat-border" data-testid={`card-activity-${act.id}`}>
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedActivity(expandedActivity === act.id ? null : act.id)}>
                <div>
                  <h5 className="font-semibold text-sm text-afrocat-text">{act.name}</h5>
                  <p className="text-xs text-afrocat-muted">Target: N$ {(act.targetAmount || 0).toFixed(2)} {act.season && `• ${act.season}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); deleteActMut.mutate(act.id); }} className="text-afrocat-red hover:text-afrocat-red/70" data-testid={`button-delete-activity-${act.id}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  {expandedActivity === act.id ? <ChevronUp size={16} className="text-afrocat-muted" /> : <ChevronDown size={16} className="text-afrocat-muted" />}
                </div>
              </div>
              {expandedActivity === act.id && (
                <FundRaisingContributions activityId={act.id} isAdmin={isAdmin} players={players} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-afrocat-muted text-center py-6">No fund raising activities yet</p>
      )}
    </div>
  );
}

function FundRaisingContributions({ activityId, isAdmin, players }: { activityId: string; isAdmin: boolean; players: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contributions = [] } = useQuery({
    queryKey: ["fundraisingContributions", activityId],
    queryFn: () => api.getFundRaisingContributions(activityId),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ playerId: "", amount: "", contributionDate: new Date().toISOString().split("T")[0], notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createFundRaisingContribution({
      activityId, playerId: form.playerId, amount: parseFloat(form.amount),
      contributionDate: form.contributionDate, notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fundraisingContributions", activityId] });
      setShowAdd(false);
      setForm({ playerId: "", amount: "", contributionDate: new Date().toISOString().split("T")[0], notes: "" });
      toast({ title: "Contribution recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFundRaisingContribution(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fundraisingContributions", activityId] }),
  });

  const totalCollected = contributions.reduce((s: number, c: any) => s + (c.amount || 0), 0);

  return (
    <div className="border-t border-afrocat-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-afrocat-gold">Collected: N$ {totalCollected.toFixed(2)}</span>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5" data-testid="button-add-fr-contribution">
            <Plus size={12} className="mr-1" /> Record Payment
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select value={form.playerId} onChange={e => setForm(f => ({ ...f, playerId: e.target.value }))} className="px-2 py-1.5 border border-afrocat-border rounded-lg text-xs bg-afrocat-white-5 text-afrocat-text" data-testid="select-fr-player">
            <option value="">Select Player</option>
            {players.map((p: any) => <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>)}
          </select>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="px-2 py-1.5 border border-afrocat-border rounded-lg text-xs bg-afrocat-white-5 text-afrocat-text" data-testid="input-fr-amount" />
          <input type="date" value={form.contributionDate} onChange={e => setForm(f => ({ ...f, contributionDate: e.target.value }))} className="px-2 py-1.5 border border-afrocat-border rounded-lg text-xs bg-afrocat-white-5 text-afrocat-text" data-testid="input-fr-date" />
          <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.playerId || !form.amount || createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-xs" data-testid="button-save-fr-contribution">
            {createMut.isPending ? "..." : "Save"}
          </Button>
        </div>
      )}

      {contributions.length > 0 ? (
        <div className="space-y-1">
          {contributions.map((c: any) => {
            const player = players.find((p: any) => p.id === c.playerId);
            return (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-afrocat-white-5 text-xs" data-testid={`row-fr-contribution-${c.id}`}>
                <span className="font-medium text-afrocat-text">{player ? `${player.firstName} ${player.lastName}` : "Unknown"}</span>
                <div className="flex items-center gap-3">
                  <span className="text-afrocat-muted">{c.contributionDate}</span>
                  <span className="font-bold text-afrocat-gold">N$ {(c.amount || 0).toFixed(2)}</span>
                  {isAdmin && (
                    <button onClick={() => deleteMut.mutate(c.id)} className="text-afrocat-red hover:text-afrocat-red/70"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-afrocat-muted text-center py-3">No contributions yet</p>
      )}
    </div>
  );
}

function PlayerValuePanel({ playerId }: { playerId: string }) {
  const { data: value, isLoading } = useQuery({
    queryKey: ["playerValue", playerId],
    queryFn: () => api.getPlayerValue(playerId),
    enabled: !!playerId,
  });

  if (isLoading) return <div className="flex items-center justify-center py-8 text-afrocat-muted"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculating player value...</div>;
  if (!value) return <p className="text-sm text-afrocat-muted text-center py-6">Unable to calculate player value</p>;

  const items = [
    { label: "Sign-On Fees", value: value.signOnFees, cls: "text-afrocat-teal" },
    { label: "Development Fees", value: value.developmentFees, cls: "text-afrocat-teal" },
    { label: "Items Issued Value", value: value.itemsValue, cls: "text-afrocat-gold" },
    { label: "Transport Value", value: value.transportValue, cls: "text-afrocat-gold" },
    { label: "Contributions (Unpaid/Due)", value: value.contributionsDue, cls: "text-afrocat-red" },
    { label: "Contributions (Paid)", value: value.contributionsPaid, cls: "text-afrocat-green" },
    { label: "Fund Raising Total", value: value.fundraisingTotal, cls: "text-afrocat-green" },
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm text-afrocat-text flex items-center gap-2"><TrendingUp size={14} className="text-afrocat-gold" /> Player Investment Value</h4>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex justify-between py-2 px-3 border-b border-afrocat-border text-sm">
            <span className="text-afrocat-muted">{item.label}</span>
            <span className={`font-semibold ${item.cls}`}>N$ {(item.value || 0).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between py-3 px-3 text-lg font-bold border-t-2 border-afrocat-teal/30 mt-2 pt-3 rounded-lg bg-afrocat-teal-soft">
          <span className="text-afrocat-teal">TOTAL PLAYER VALUE</span>
          <span className="text-afrocat-teal" data-testid="text-player-value">N$ {(value.totalValue || 0).toFixed(2)}</span>
        </div>
      </div>
      <p className="text-xs text-afrocat-muted">Transfer-out fee: Excludes paid contributions, includes unpaid ones. Based on sign-on + development + items + transport + unpaid contributions.</p>
    </div>
  );
}

function TransferCalculator({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    fromClub: "Afrocat Volleyball Club", toClub: "",
    transferDate: new Date().toISOString().split("T")[0], nvfYear: new Date().getFullYear(),
  });
  const [breakdown, setBreakdown] = useState<any>(null);

  const calcMut = useMutation({
    mutationFn: () => api.calculateTransfer({ playerId: contract.playerId, contractId: contract.id, ...form }),
    onSuccess: (data: any) => setBreakdown(data),
  });

  const createCaseMut = useMutation({
    mutationFn: () => api.createTransferCase({ playerId: contract.playerId, contractId: contract.id, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transferCases"] });
      toast({ title: "Transfer case created" });
    },
  });

  const transferPdfMut = useMutation({
    mutationFn: (id: string) => api.generateTransferPdf(id),
    onSuccess: (data: any) => {
      const w = window.open("", "_blank");
      if (w) { w.document.write(data.html); w.document.close(); }
    },
  });

  const { data: transferCases = [] } = useQuery({
    queryKey: ["transferCases", contract.playerId],
    queryFn: () => api.getPlayerTransferCases(contract.playerId),
  });

  const cur = contract.currency || "NAD";

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-afrocat-gold-soft border border-afrocat-gold/20 text-sm text-afrocat-gold">
        <AlertTriangle size={14} className="inline mr-1" />
        Per NVF regulations, the contract release fee is capped at N$3,000 for transfer to any other club/team.
      </div>

      {isAdmin && (
        <div className="bg-afrocat-white-3 rounded-lg p-4 space-y-3 border border-afrocat-border">
          <h4 className="font-semibold text-sm flex items-center gap-2 text-afrocat-text"><Calculator size={14} className="text-afrocat-teal" /> Calculate Transfer</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-afrocat-muted">From Club</label>
              <input value={form.fromClub} onChange={e => setForm(f => ({ ...f, fromClub: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-from-club" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">To Club *</label>
              <input value={form.toClub} onChange={e => setForm(f => ({ ...f, toClub: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-to-club" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">Transfer Date</label>
              <input type="date" value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-transfer-date" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted">NVF Year</label>
              <input type="number" value={form.nvfYear} onChange={e => setForm(f => ({ ...f, nvfYear: parseInt(e.target.value) }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-nvf-year" />
            </div>
          </div>
          <Button onClick={() => calcMut.mutate()} disabled={!form.toClub || calcMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-calculate-transfer">
            {calcMut.isPending ? "Calculating..." : "Calculate Transfer Due"}
          </Button>
        </div>
      )}

      {breakdown && (
        <div className="bg-afrocat-white-3 border-2 border-afrocat-teal/20 rounded-xl p-6 space-y-4">
          <h4 className="font-bold text-lg text-afrocat-teal">Transfer Fee Breakdown</h4>
          {breakdown.warnings?.length > 0 && (
            <div className="bg-afrocat-gold-soft border border-afrocat-gold/20 rounded-lg p-2 text-xs text-afrocat-gold">
              {breakdown.warnings.map((w: string, i: number) => <p key={i}><AlertTriangle size={12} className="inline mr-1" />{w}</p>)}
            </div>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-afrocat-border"><span className="text-afrocat-muted">NVF Inter-Association Transfer Fee</span><span className="font-semibold text-afrocat-text">{cur} {breakdown.nvfFee?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b border-afrocat-border">
              <span className="text-afrocat-muted">Contract Release Fee {breakdown.releaseFeeCapApplied && <span className="text-xs text-afrocat-gold">(capped from {cur} {breakdown.originalReleaseFee?.toFixed(2)})</span>}</span>
              <span className="font-semibold text-afrocat-text">{cur} {breakdown.releaseFee?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-afrocat-border"><span className="text-afrocat-muted">Items Issued Value</span><span className="font-semibold text-afrocat-text">{cur} {breakdown.itemsValue?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b border-afrocat-border"><span className="text-afrocat-muted">Transport Benefits Value</span><span className="font-semibold text-afrocat-text">{cur} {breakdown.transportValue?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b border-afrocat-border"><span className="text-afrocat-muted">Membership Fee Outstanding</span><span className="font-semibold text-afrocat-text">{cur} {breakdown.membershipOutstanding?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b border-afrocat-border"><span className="text-afrocat-muted">Development Fee Outstanding</span><span className="font-semibold text-afrocat-text">{cur} {breakdown.developmentOutstanding?.toFixed(2)}</span></div>
            <div className="flex justify-between py-3 text-lg font-bold text-afrocat-teal border-t-2 border-afrocat-teal/30 mt-2 pt-3">
              <span>TOTAL TRANSFER AMOUNT DUE</span>
              <span data-testid="text-total-due">{cur} {breakdown.totalDue?.toFixed(2)}</span>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => createCaseMut.mutate()} disabled={createCaseMut.isPending} className="bg-afrocat-green hover:bg-afrocat-green/80 text-white" data-testid="button-create-transfer-case">
              {createCaseMut.isPending ? "Creating..." : "Create Transfer Case"}
            </Button>
          )}
        </div>
      )}

      {transferCases.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-afrocat-text">Transfer Cases</h4>
          {transferCases.map((tc: any) => (
            <div key={tc.id} className="bg-afrocat-white-3 border border-afrocat-border rounded-lg p-4 text-sm" data-testid={`card-transfer-${tc.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-afrocat-text">{tc.fromClub} → {tc.toClub}</span>
                  <span className="text-afrocat-muted ml-2">({tc.transferDate})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${transferStatusColors[tc.status] || ""}`}>{tc.status}</span>
                  <button onClick={() => transferPdfMut.mutate(tc.id)} className="text-afrocat-teal hover:text-afrocat-teal/80" data-testid={`button-transfer-pdf-${tc.id}`}><Printer size={14} /></button>
                </div>
              </div>
              <div className="text-lg font-bold text-afrocat-teal">{cur} {(tc.totalDue || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NvfFeeConfig() {
  const qc = useQueryClient();
  const { data: fees = [] } = useQuery({ queryKey: ["nvfFees"], queryFn: () => api.getNvfFees() });
  const [form, setForm] = useState({ year: new Date().getFullYear().toString(), feeType: "INTER_ASSOCIATION_TRANSFER_FEE", amount: "", notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createNvfFee({ year: parseInt(form.year), feeType: form.feeType, amount: parseFloat(form.amount), notes: form.notes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nvfFees"] });
      setForm({ year: new Date().getFullYear().toString(), feeType: "INTER_ASSOCIATION_TRANSFER_FEE", amount: "", notes: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteNvfFee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nvfFees"] }),
  });

  const typeLabels: Record<string, string> = { INTER_ASSOCIATION_TRANSFER_FEE: "Inter-Association Transfer Fee", OTHER: "Other" };

  return (
    <div className="afrocat-card overflow-hidden">
      <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
        <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold"><DollarSign size={18} /> NVF Transfer Fee Schedule</h3>
        <p className="text-xs text-afrocat-muted mt-0.5">Configure yearly NVF transfer fees used in the transfer calculator.</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-afrocat-muted">Year</label>
            <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-nvf-fee-year" />
          </div>
          <div>
            <label className="text-xs text-afrocat-muted">Fee Type</label>
            <select value={form.feeType} onChange={e => setForm(f => ({ ...f, feeType: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-nvf-fee-type">
              <option value="INTER_ASSOCIATION_TRANSFER_FEE">Inter-Association Transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-afrocat-muted">Amount (NAD)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-nvf-fee-amount" />
          </div>
          <div>
            <label className="text-xs text-afrocat-muted">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-nvf-fee-notes" />
          </div>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={!form.amount || createMut.isPending} className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black" data-testid="button-save-nvf-fee">
          {createMut.isPending ? "Saving..." : "Add NVF Fee"}
        </Button>

        {fees.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
                <tr>
                  <th className="py-2 px-3 text-left">Year</th><th className="py-2 px-3 text-left">Type</th><th className="py-2 px-3 text-right">Amount</th><th className="py-2 px-3 text-left">Notes</th><th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f: any) => (
                  <tr key={f.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-nvf-fee-${f.id}`}>
                    <td className="py-2 px-3 font-semibold text-afrocat-text">{f.year}</td>
                    <td className="py-2 px-3 text-afrocat-text">{typeLabels[f.feeType] || f.feeType}</td>
                    <td className="py-2 px-3 text-right font-semibold text-afrocat-gold">NAD {(f.amount || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-afrocat-muted">{f.notes || "—"}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => deleteMut.mutate(f.id)} className="text-afrocat-red hover:text-afrocat-red/70" data-testid={`button-delete-nvf-${f.id}`}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Contracts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [showNvfConfig, setShowNvfConfig] = useState(false);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: api.getPlayers });
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", selectedPlayerId],
    queryFn: () => api.getPlayerContracts(selectedPlayerId),
    enabled: !!selectedPlayerId,
  });

  const [form, setForm] = useState({
    playerId: "", contractType: "PERMANENT" as string, startDate: "", endDate: "",
    signOnFee: "", weeklyTransport: "", salaryAmount: "", releaseFee: "", obligations: "",
  });

  const createMut = useMutation({
    mutationFn: api.createContract,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setShowCreate(false);
      setForm({ playerId: "", contractType: "PERMANENT", startDate: "", endDate: "", signOnFee: "", weeklyTransport: "", salaryAmount: "", releaseFee: "", obligations: "" });
      toast({ title: "Contract created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveContract(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "Contract approved & activated" }); },
  });

  const terminateMut = useMutation({
    mutationFn: (id: string) => api.terminateContract(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "Contract terminated" }); },
  });

  const assignMembershipMut = useMutation({
    mutationFn: (playerId: string) => api.assignMembershipNo(playerId),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["players"] });
      toast({ title: "Membership assigned", description: `Number: ${data.membershipNo}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    createMut.mutate({
      playerId: form.playerId, contractType: form.contractType, startDate: form.startDate, endDate: form.endDate,
      signOnFee: form.signOnFee ? parseFloat(form.signOnFee) : null,
      weeklyTransport: form.weeklyTransport ? parseFloat(form.weeklyTransport) : null,
      salaryAmount: form.salaryAmount ? parseFloat(form.salaryAmount) : null,
      releaseFee: form.releaseFee ? parseFloat(form.releaseFee) : null,
      obligations: form.obligations || null, status: "DRAFT",
    });
  };

  const daysUntilExpiry = (endDate: string) => Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const selectedPlayer = players.find((p: any) => p.id === selectedPlayerId);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <img src={logo} alt="Afrocat Logo" className="w-14 h-14 object-contain" />
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-page-title">Player Contracts</h1>
              <p className="text-sm text-afrocat-muted italic mt-0.5">Attire, contributions, fees, fund raising & transfers</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {user?.role === "ADMIN" && (
                <Button onClick={() => setShowNvfConfig(!showNvfConfig)} variant="outline" size="sm" className="border-afrocat-gold text-afrocat-gold hover:bg-afrocat-gold-soft" data-testid="button-nvf-config">
                  <DollarSign size={14} className="mr-1" /> NVF Fees
                </Button>
              )}
              {isAdmin && (
                <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-create-contract">
                  <Plus size={14} className="mr-1" /> New Contract
                </Button>
              )}
            </div>
          </div>
        </div>

        {showNvfConfig && <NvfFeeConfig />}

        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Select Player</label>
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-contract-player">
                <SelectValue placeholder="Select a player to view contracts" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.lastName} {p.firstName} (#{p.jerseyNo}) {p.membershipNo ? `[M#${p.membershipNo}]` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlayerId && isAdmin && selectedPlayer && !selectedPlayer.membershipNo && (
            <Button size="sm" variant="outline" onClick={() => assignMembershipMut.mutate(selectedPlayerId)} disabled={assignMembershipMut.isPending} className="border-afrocat-gold text-afrocat-gold hover:bg-afrocat-gold-soft" data-testid="button-assign-membership">
              <Hash size={14} className="mr-1" /> {assignMembershipMut.isPending ? "Assigning..." : "Assign Membership #"}
            </Button>
          )}
          {selectedPlayer?.membershipNo && (
            <div className="px-3 py-2 rounded-lg bg-afrocat-teal-soft text-afrocat-teal text-sm font-bold" data-testid="text-membership-no">
              Membership #{selectedPlayer.membershipNo}
            </div>
          )}
        </div>

        {showCreate && isAdmin && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal"><FileText size={18} /> Create Contract</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">Player *</label>
                  <Select value={form.playerId} onValueChange={v => setForm(f => ({ ...f, playerId: v }))}>
                    <SelectTrigger className="bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-contract-player-create">
                      <SelectValue placeholder="Select Player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.lastName} {p.firstName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">Type</label>
                  <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="select-contract-type">
                    <option value="PERMANENT">Permanent</option><option value="SEASONAL">Seasonal</option><option value="TRIAL">Trial</option><option value="YOUTH">Youth</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-contract-start" />
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted font-semibold uppercase tracking-wider mb-1 block">End Date *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-contract-end" />
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted">Sign-On Fee (N$)</label>
                  <input type="number" value={form.signOnFee} onChange={e => setForm(f => ({ ...f, signOnFee: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-sign-on-fee" />
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted">Weekly Transport (N$)</label>
                  <input type="number" value={form.weeklyTransport} onChange={e => setForm(f => ({ ...f, weeklyTransport: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-weekly-transport" />
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted">Salary (N$)</label>
                  <input type="number" value={form.salaryAmount} onChange={e => setForm(f => ({ ...f, salaryAmount: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-salary" />
                </div>
                <div>
                  <label className="text-xs text-afrocat-muted">Release Fee (N$)</label>
                  <input type="number" value={form.releaseFee} onChange={e => setForm(f => ({ ...f, releaseFee: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" data-testid="input-release-fee" />
                </div>
                <div className="lg:col-span-4">
                  <label className="text-xs text-afrocat-muted">Obligations</label>
                  <textarea value={form.obligations} onChange={e => setForm(f => ({ ...f, obligations: e.target.value }))} className="w-full px-3 py-2 border border-afrocat-border rounded-lg text-sm bg-afrocat-white-5 text-afrocat-text" rows={2} data-testid="input-obligations" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!form.playerId || !form.startDate || !form.endDate || createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-submit-contract">
                {createMut.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating...</> : "Create Draft Contract"}
              </Button>
            </div>
          </div>
        )}

        {selectedPlayerId && (
          <div className="space-y-4">
            {contracts.length === 0 && (
              <div className="afrocat-card">
                <div className="py-12 text-center text-afrocat-muted">
                  <FileText size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No contracts found for this player</p>
                </div>
              </div>
            )}
            {contracts.map((c: any) => {
              const StatusIcon = statusIcons[c.status] || Clock;
              const days = daysUntilExpiry(c.endDate);
              const nearExpiry = c.status === "ACTIVE" && days <= 60 && days > 0;
              const isExpanded = expandedContract === c.id;

              return (
                <div key={c.id} className="afrocat-card overflow-hidden" data-testid={`card-contract-${c.id}`}>
                  <div className="p-5 cursor-pointer" onClick={() => setExpandedContract(isExpanded ? null : c.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon size={20} className={c.status === "ACTIVE" ? "text-afrocat-green" : c.status === "TERMINATED" ? "text-afrocat-red" : "text-afrocat-muted"} />
                        <div>
                          <h4 className="font-semibold text-afrocat-text">{c.contractType} Contract</h4>
                          <p className="text-sm text-afrocat-muted">{c.startDate} to {c.endDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {nearExpiry && (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-afrocat-gold-soft text-afrocat-gold rounded-full" data-testid="badge-renewal-warning">
                            <AlertTriangle size={12} /> Renewal in {days} days
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[c.status]}`} data-testid={`badge-status-${c.id}`}>
                          {c.status}
                        </span>
                        {isExpanded ? <ChevronUp size={18} className="text-afrocat-muted" /> : <ChevronDown size={18} className="text-afrocat-muted" />}
                      </div>
                    </div>

                    {isAdmin && c.status === "DRAFT" && (
                      <div className="flex gap-2 pt-3" onClick={e => e.stopPropagation()}>
                        <Button size="sm" onClick={() => approveMut.mutate(c.id)} className="bg-afrocat-green hover:bg-afrocat-green/80 text-white" data-testid={`button-approve-${c.id}`}>
                          <Shield size={14} className="mr-1" /> Approve & Activate
                        </Button>
                      </div>
                    )}
                    {isAdmin && c.status === "ACTIVE" && (
                      <div className="flex gap-2 pt-3" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => terminateMut.mutate(c.id)} className="border-afrocat-red text-afrocat-red hover:bg-afrocat-red-soft" data-testid={`button-terminate-${c.id}`}>
                          <XCircle size={14} className="mr-1" /> Terminate
                        </Button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5">
                      <ContractDetail contract={c} isAdmin={isAdmin} players={players} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
