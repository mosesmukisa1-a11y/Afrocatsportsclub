import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  FileText, Plus, CheckCircle, XCircle, Clock, AlertTriangle, Shield,
  Package, Truck, DollarSign, Calculator, Printer, Trash2, Edit, ChevronDown, ChevronUp
} from "lucide-react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-700",
};

const statusIcons: Record<string, any> = {
  DRAFT: Clock,
  ACTIVE: CheckCircle,
  EXPIRED: AlertTriangle,
  TERMINATED: XCircle,
};

const transferStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  CLOSED: "bg-purple-100 text-purple-700",
};

function ContractDetail({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("summary");

  const tabs = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "fees", label: "Fees", icon: DollarSign },
    { id: "items", label: "Items Issued", icon: Package },
    { id: "transport", label: "Transport", icon: Truck },
    { id: "transfer", label: "Transfer Calculator", icon: Calculator },
  ];

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${t.id}-${contract.id}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && <ContractSummary contract={contract} isAdmin={isAdmin} />}
      {activeTab === "fees" && <ContractFees contract={contract} isAdmin={isAdmin} />}
      {activeTab === "items" && <ContractItems contractId={contract.id} isAdmin={isAdmin} />}
      {activeTab === "transport" && <ContractTransport contractId={contract.id} isAdmin={isAdmin} />}
      {activeTab === "transfer" && <TransferCalculator contract={contract} isAdmin={isAdmin} />}
    </div>
  );
}

function ContractSummary({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const cur = contract.currency || "NAD";
  const qc = useQueryClient();

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
          <div><p className="text-muted-foreground">Sign-On Fee</p><p className="font-semibold" data-testid={`text-sign-on-${contract.id}`}>{cur} {contract.signOnFee?.toLocaleString()}</p></div>
        )}
        {contract.weeklyTransport != null && (
          <div><p className="text-muted-foreground">Weekly Transport</p><p className="font-semibold">{cur} {contract.weeklyTransport?.toLocaleString()}</p></div>
        )}
        {contract.salaryAmount != null && (
          <div><p className="text-muted-foreground">Salary</p><p className="font-semibold">{cur} {contract.salaryAmount?.toLocaleString()}</p></div>
        )}
        {contract.releaseFee != null && (
          <div><p className="text-muted-foreground">Release Fee</p><p className="font-semibold">{cur} {contract.releaseFee?.toLocaleString()}</p></div>
        )}
        <div><p className="text-muted-foreground">Duration</p><p className="font-semibold">{Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months</p></div>
        <div><p className="text-muted-foreground">Currency</p><p className="font-semibold">{cur}</p></div>
      </div>
      {contract.obligations && (
        <div className="text-sm"><p className="text-muted-foreground mb-1">Obligations</p><p className="bg-muted/50 rounded-lg p-3">{contract.obligations}</p></div>
      )}
      {isAdmin && (
        <button onClick={() => investPdfMut.mutate()} disabled={investPdfMut.isPending} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20" data-testid={`button-investment-pdf-${contract.id}`}>
          <Printer size={14} /> {investPdfMut.isPending ? "Generating..." : "Contract Investment Summary PDF"}
        </button>
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
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><DollarSign size={14} className="text-primary" /> Membership Fee</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Required</label>
              <input type="number" step="0.01" value={fees.membershipFeeRequired} onChange={e => setFees(f => ({ ...f, membershipFeeRequired: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" disabled={!isAdmin} data-testid="input-membership-required" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Paid</label>
              <input type="number" step="0.01" value={fees.membershipFeePaid} onChange={e => setFees(f => ({ ...f, membershipFeePaid: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" disabled={!isAdmin} data-testid="input-membership-paid" />
            </div>
          </div>
          <div className="text-sm"><span className="text-muted-foreground">Outstanding: </span><span className={`font-bold ${memOut > 0 ? "text-red-600" : "text-green-600"}`}>{cur} {memOut.toFixed(2)}</span></div>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><DollarSign size={14} className="text-primary" /> Development Fee</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Required</label>
              <input type="number" step="0.01" value={fees.developmentFeeRequired} onChange={e => setFees(f => ({ ...f, developmentFeeRequired: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" disabled={!isAdmin} data-testid="input-development-required" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Paid</label>
              <input type="number" step="0.01" value={fees.developmentFeePaid} onChange={e => setFees(f => ({ ...f, developmentFeePaid: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" disabled={!isAdmin} data-testid="input-development-paid" />
            </div>
          </div>
          <div className="text-sm"><span className="text-muted-foreground">Outstanding: </span><span className={`font-bold ${devOut > 0 ? "text-red-600" : "text-green-600"}`}>{cur} {devOut.toFixed(2)}</span></div>
        </div>
      </div>
      {isAdmin && (
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50" data-testid="button-save-fees">
          {saveMut.isPending ? "Saving..." : "Save Fees"}
        </button>
      )}
    </div>
  );
}

function ContractItems({ contractId, isAdmin }: { contractId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["contractItems", contractId], queryFn: () => api.getContractItems(contractId) });
  const [showAdd, setShowAdd] = useState(false);
  const [itemForm, setItemForm] = useState({ itemName: "", quantity: "1", unitValue: "0", dateIssued: new Date().toISOString().split("T")[0], notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createContractItem(contractId, {
      itemName: itemForm.itemName,
      quantity: parseInt(itemForm.quantity),
      unitValue: parseFloat(itemForm.unitValue),
      dateIssued: itemForm.dateIssued,
      notes: itemForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractItems", contractId] });
      setShowAdd(false);
      setItemForm({ itemName: "", quantity: "1", unitValue: "0", dateIssued: new Date().toISOString().split("T")[0], notes: "" });
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
        <h4 className="font-semibold text-sm">Items Issued ({items.length})</h4>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90" data-testid="button-add-item">
            <Plus size={14} /> Add Item
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Item Name *</label>
              <input value={itemForm.itemName} onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-item-name" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quantity</label>
              <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-item-qty" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unit Value</label>
              <input type="number" step="0.01" min="0" value={itemForm.unitValue} onChange={e => setItemForm(f => ({ ...f, unitValue: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-item-unit-value" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date Issued</label>
              <input type="date" value={itemForm.dateIssued} onChange={e => setItemForm(f => ({ ...f, dateIssued: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-item-date" />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-item-notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!itemForm.itemName || createMut.isPending} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50" data-testid="button-save-item">
              {createMut.isPending ? "Saving..." : "Save Item"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs bg-muted rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="py-2 px-3">Date</th><th className="py-2 px-3">Item</th><th className="py-2 px-3">Qty</th><th className="py-2 px-3">Unit Value</th><th className="py-2 px-3">Total</th><th className="py-2 px-3">Notes</th>{isAdmin && <th className="py-2 px-3"></th>}
            </tr></thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b" data-testid={`row-item-${item.id}`}>
                  <td className="py-2 px-3">{item.dateIssued}</td>
                  <td className="py-2 px-3 font-medium">{item.itemName}</td>
                  <td className="py-2 px-3">{item.quantity}</td>
                  <td className="py-2 px-3">{(item.unitValue || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 font-semibold">{(item.totalValue || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{item.notes || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <button onClick={() => deleteMut.mutate(item.id)} className="text-red-500 hover:text-red-700" data-testid={`button-delete-item-${item.id}`}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-muted/30">
                <td colSpan={4} className="py-2 px-3 text-right">Total Items Value:</td>
                <td className="py-2 px-3" data-testid="text-items-total">{total.toFixed(2)}</td>
                <td colSpan={isAdmin ? 2 : 1}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">No items issued yet</p>
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
      benefitType: form.benefitType,
      dateFrom: form.dateFrom,
      dateTo: form.dateTo || null,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      notes: form.notes || null,
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
        <h4 className="font-semibold text-sm">Transport Benefits ({benefits.length})</h4>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90" data-testid="button-add-transport">
            <Plus size={14} /> Add Benefit
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.benefitType} onChange={e => setForm(f => ({ ...f, benefitType: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="select-transport-type">
                <option value="TRAINING_TRANSPORT">Training Transport</option>
                <option value="MATCH_TRANSPORT">Match Transport</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="select-transport-frequency">
                <option value="ONE_TIME">One-Time</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="PER_TRIP">Per Trip</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-transport-amount" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date From *</label>
              <input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-transport-from" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date To</label>
              <input type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-transport-to" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-transport-notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!form.dateFrom || !form.amount || createMut.isPending} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50" data-testid="button-save-transport">
              {createMut.isPending ? "Saving..." : "Save Benefit"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs bg-muted rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {benefits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="py-2 px-3">Type</th><th className="py-2 px-3">Frequency</th><th className="py-2 px-3">Amount</th><th className="py-2 px-3">From</th><th className="py-2 px-3">To</th><th className="py-2 px-3">Notes</th>{isAdmin && <th className="py-2 px-3"></th>}
            </tr></thead>
            <tbody>
              {benefits.map((b: any) => (
                <tr key={b.id} className="border-b" data-testid={`row-transport-${b.id}`}>
                  <td className="py-2 px-3">{typeLabels[b.benefitType] || b.benefitType}</td>
                  <td className="py-2 px-3">{freqLabels[b.frequency] || b.frequency}</td>
                  <td className="py-2 px-3 font-semibold">{(b.amount || 0).toFixed(2)}</td>
                  <td className="py-2 px-3">{b.dateFrom}</td>
                  <td className="py-2 px-3">{b.dateTo || "Ongoing"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{b.notes || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <button onClick={() => deleteMut.mutate(b.id)} className="text-red-500 hover:text-red-700" data-testid={`button-delete-transport-${b.id}`}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">No transport benefits yet</p>
      )}
    </div>
  );
}

function TransferCalculator({ contract, isAdmin }: { contract: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fromClub: "Afrocat Volleyball Club",
    toClub: "",
    transferDate: new Date().toISOString().split("T")[0],
    nvfYear: new Date().getFullYear(),
  });
  const [breakdown, setBreakdown] = useState<any>(null);

  const calcMut = useMutation({
    mutationFn: () => api.calculateTransfer({
      playerId: contract.playerId,
      contractId: contract.id,
      ...form,
    }),
    onSuccess: (data: any) => setBreakdown(data),
  });

  const createCaseMut = useMutation({
    mutationFn: () => api.createTransferCase({
      playerId: contract.playerId,
      contractId: contract.id,
      ...form,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transferCases"] });
      alert("Transfer case created successfully.");
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <AlertTriangle size={14} className="inline mr-1" />
        Per NVF regulations, the contract release fee is capped at N$3,000 for transfer to any other club/team.
      </div>

      {isAdmin && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Calculator size={14} className="text-primary" /> Calculate Transfer</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">From Club</label>
              <input value={form.fromClub} onChange={e => setForm(f => ({ ...f, fromClub: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-from-club" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To Club *</label>
              <input value={form.toClub} onChange={e => setForm(f => ({ ...f, toClub: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-to-club" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Transfer Date</label>
              <input type="date" value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-transfer-date" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">NVF Year</label>
              <input type="number" value={form.nvfYear} onChange={e => setForm(f => ({ ...f, nvfYear: parseInt(e.target.value) }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-nvf-year" />
            </div>
          </div>
          <button onClick={() => calcMut.mutate()} disabled={!form.toClub || calcMut.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50" data-testid="button-calculate-transfer">
            {calcMut.isPending ? "Calculating..." : "Calculate Transfer Due"}
          </button>
        </div>
      )}

      {breakdown && (
        <div className="bg-card border-2 border-primary/20 rounded-xl p-6 space-y-4">
          <h4 className="font-bold text-lg text-primary">Transfer Fee Breakdown</h4>
          {breakdown.warnings?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
              {breakdown.warnings.map((w: string, i: number) => <p key={i}><AlertTriangle size={12} className="inline mr-1" />{w}</p>)}
            </div>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b"><span>NVF Inter-Association Transfer Fee</span><span className="font-semibold">{cur} {breakdown.nvfFee?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b">
              <span>Contract Release Fee {breakdown.releaseFeeCapApplied && <span className="text-xs text-amber-600">(capped from {cur} {breakdown.originalReleaseFee?.toFixed(2)})</span>}</span>
              <span className="font-semibold">{cur} {breakdown.releaseFee?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 border-b"><span>Items Issued Value</span><span className="font-semibold">{cur} {breakdown.itemsValue?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>Transport Benefits Value</span><span className="font-semibold">{cur} {breakdown.transportValue?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>Membership Fee Outstanding</span><span className="font-semibold">{cur} {breakdown.membershipOutstanding?.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>Development Fee Outstanding</span><span className="font-semibold">{cur} {breakdown.developmentOutstanding?.toFixed(2)}</span></div>
            <div className="flex justify-between py-2 text-lg font-bold text-primary border-t-2 border-primary/30 mt-2 pt-3">
              <span>TOTAL TRANSFER AMOUNT DUE</span>
              <span data-testid="text-total-due">{cur} {breakdown.totalDue?.toFixed(2)}</span>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => createCaseMut.mutate()} disabled={createCaseMut.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50" data-testid="button-create-transfer-case">
              {createCaseMut.isPending ? "Creating..." : "Create Transfer Case"}
            </button>
          )}
        </div>
      )}

      {transferCases.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Transfer Cases</h4>
          {transferCases.map((tc: any) => (
            <div key={tc.id} className="bg-card border rounded-lg p-4 text-sm" data-testid={`card-transfer-${tc.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold">{tc.fromClub} → {tc.toClub}</span>
                  <span className="text-muted-foreground ml-2">({tc.transferDate})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${transferStatusColors[tc.status]}`}>{tc.status}</span>
                  <button onClick={() => transferPdfMut.mutate(tc.id)} className="text-primary hover:text-primary/80" data-testid={`button-transfer-pdf-${tc.id}`}><Printer size={14} /></button>
                </div>
              </div>
              <div className="text-lg font-bold text-primary">{cur} {(tc.totalDue || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Contracts() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveContract(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });

  const terminateMut = useMutation({
    mutationFn: (id: string) => api.terminateContract(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });

  const handleCreate = () => {
    createMut.mutate({
      playerId: form.playerId,
      contractType: form.contractType,
      startDate: form.startDate,
      endDate: form.endDate,
      signOnFee: form.signOnFee ? parseFloat(form.signOnFee) : null,
      weeklyTransport: form.weeklyTransport ? parseFloat(form.weeklyTransport) : null,
      salaryAmount: form.salaryAmount ? parseFloat(form.salaryAmount) : null,
      releaseFee: form.releaseFee ? parseFloat(form.releaseFee) : null,
      obligations: form.obligations || null,
      status: "DRAFT",
    });
  };

  const daysUntilExpiry = (endDate: string) => {
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Player Contracts</h1>
            <p className="text-muted-foreground mt-1">Manage contract lifecycle, items, fees & transfers</p>
          </div>
          <div className="flex gap-2">
            {user?.role === "ADMIN" && (
              <button onClick={() => setShowNvfConfig(!showNvfConfig)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors" data-testid="button-nvf-config">
                <DollarSign size={18} /> NVF Fees
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-create-contract">
                <Plus size={18} /> New Contract
              </button>
            )}
          </div>
        </div>

        {showNvfConfig && <NvfFeeConfig />}

        <div className="flex gap-4 items-center">
          <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} className="px-3 py-2 border rounded-lg bg-background min-w-[250px]" data-testid="select-contract-player">
            <option value="">Select a player to view contracts</option>
            {players.map((p: any) => (
              <option key={p.id} value={p.id}>{p.lastName} {p.firstName} (#{p.jerseyNo})</option>
            ))}
          </select>
        </div>

        {showCreate && isAdmin && (
          <div className="bg-card border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><FileText size={18} /> Create Contract</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select value={form.playerId} onChange={e => setForm(f => ({ ...f, playerId: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="select-contract-player-create">
                <option value="">Select Player</option>
                {players.map((p: any) => <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>)}
              </select>
              <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="select-contract-type">
                <option value="PERMANENT">Permanent</option>
                <option value="SEASONAL">Seasonal</option>
                <option value="TRIAL">Trial</option>
                <option value="YOUTH">Youth</option>
              </select>
              <input type="date" placeholder="Start Date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-contract-start" />
              <input type="date" placeholder="End Date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-contract-end" />
              <input type="number" placeholder="Sign-On Fee" value={form.signOnFee} onChange={e => setForm(f => ({ ...f, signOnFee: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-sign-on-fee" />
              <input type="number" placeholder="Weekly Transport" value={form.weeklyTransport} onChange={e => setForm(f => ({ ...f, weeklyTransport: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-weekly-transport" />
              <input type="number" placeholder="Salary Amount" value={form.salaryAmount} onChange={e => setForm(f => ({ ...f, salaryAmount: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-salary" />
              <input type="number" placeholder="Release Fee" value={form.releaseFee} onChange={e => setForm(f => ({ ...f, releaseFee: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-release-fee" />
              <textarea placeholder="Obligations" value={form.obligations} onChange={e => setForm(f => ({ ...f, obligations: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background md:col-span-2 lg:col-span-4" rows={2} data-testid="input-obligations" />
            </div>
            <button onClick={handleCreate} disabled={!form.playerId || !form.startDate || !form.endDate} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50" data-testid="button-submit-contract">
              Create Draft Contract
            </button>
          </div>
        )}

        {selectedPlayerId && (
          <div className="space-y-4">
            {contracts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={48} className="mx-auto mb-4 opacity-30" />
                <p>No contracts found for this player</p>
              </div>
            )}
            {contracts.map((c: any) => {
              const StatusIcon = statusIcons[c.status] || Clock;
              const days = daysUntilExpiry(c.endDate);
              const nearExpiry = c.status === "ACTIVE" && days <= 60 && days > 0;
              const isExpanded = expandedContract === c.id;

              return (
                <div key={c.id} className="bg-card border rounded-xl p-6 space-y-4" data-testid={`card-contract-${c.id}`}>
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedContract(isExpanded ? null : c.id)}>
                    <div className="flex items-center gap-3">
                      <StatusIcon size={20} className={c.status === "ACTIVE" ? "text-green-600" : c.status === "TERMINATED" ? "text-red-600" : "text-muted-foreground"} />
                      <div>
                        <h4 className="font-semibold">{c.contractType} Contract</h4>
                        <p className="text-sm text-muted-foreground">{c.startDate} to {c.endDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {nearExpiry && (
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full" data-testid="badge-renewal-warning">
                          <AlertTriangle size={12} /> Renewal in {days} days
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[c.status]}`} data-testid={`badge-status-${c.id}`}>
                        {c.status}
                      </span>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isAdmin && c.status === "DRAFT" && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => approveMut.mutate(c.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700" data-testid={`button-approve-${c.id}`}>
                        <Shield size={14} /> Approve & Activate
                      </button>
                    </div>
                  )}
                  {isAdmin && c.status === "ACTIVE" && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => terminateMut.mutate(c.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700" data-testid={`button-terminate-${c.id}`}>
                        <XCircle size={14} /> Terminate
                      </button>
                    </div>
                  )}

                  {isExpanded && <ContractDetail contract={c} isAdmin={isAdmin} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function NvfFeeConfig() {
  const qc = useQueryClient();
  const { data: fees = [] } = useQuery({ queryKey: ["nvfFees"], queryFn: () => api.getNvfFees() });
  const [form, setForm] = useState({ year: new Date().getFullYear().toString(), feeType: "INTER_ASSOCIATION_TRANSFER_FEE", amount: "", notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createNvfFee({
      year: parseInt(form.year),
      feeType: form.feeType,
      amount: parseFloat(form.amount),
      notes: form.notes || null,
    }),
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
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-amber-800"><DollarSign size={18} /> NVF Transfer Fee Schedule</h3>
      <p className="text-xs text-amber-600">Configure yearly NVF transfer fees. These are used in the transfer calculator.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-amber-700">Year</label>
          <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white" data-testid="input-nvf-fee-year" />
        </div>
        <div>
          <label className="text-xs text-amber-700">Fee Type</label>
          <select value={form.feeType} onChange={e => setForm(f => ({ ...f, feeType: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white" data-testid="select-nvf-fee-type">
            <option value="INTER_ASSOCIATION_TRANSFER_FEE">Inter-Association Transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-amber-700">Amount (NAD)</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white" data-testid="input-nvf-fee-amount" />
        </div>
        <div>
          <label className="text-xs text-amber-700">Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white" data-testid="input-nvf-fee-notes" />
        </div>
      </div>
      <button onClick={() => createMut.mutate()} disabled={!form.amount || createMut.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50" data-testid="button-save-nvf-fee">
        {createMut.isPending ? "Saving..." : "Add NVF Fee"}
      </button>

      {fees.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-amber-700">
              <th className="py-2 px-3">Year</th><th className="py-2 px-3">Type</th><th className="py-2 px-3">Amount</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3"></th>
            </tr></thead>
            <tbody>
              {fees.map((f: any) => (
                <tr key={f.id} className="border-b" data-testid={`row-nvf-fee-${f.id}`}>
                  <td className="py-2 px-3 font-semibold">{f.year}</td>
                  <td className="py-2 px-3">{typeLabels[f.feeType] || f.feeType}</td>
                  <td className="py-2 px-3 font-semibold">NAD {(f.amount || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{f.notes || "—"}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => deleteMut.mutate(f.id)} className="text-red-500 hover:text-red-700" data-testid={`button-delete-nvf-${f.id}`}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
