import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { FileText, Plus, CheckCircle, XCircle, Clock, AlertTriangle, Shield } from "lucide-react";

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

export default function Contracts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: api.getPlayers });
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", selectedPlayerId],
    queryFn: () => api.getPlayerContracts(selectedPlayerId),
    enabled: !!selectedPlayerId,
  });

  const [form, setForm] = useState({
    playerId: "", contractType: "PERMANENT" as string, startDate: "", endDate: "",
    signOnFee: "", weeklyTransport: "", salaryAmount: "", obligations: "",
  });

  const createMut = useMutation({
    mutationFn: api.createContract,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setShowCreate(false);
      setForm({ playerId: "", contractType: "PERMANENT", startDate: "", endDate: "", signOnFee: "", weeklyTransport: "", salaryAmount: "", obligations: "" });
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
      obligations: form.obligations || null,
      status: "DRAFT",
    });
  };

  const daysUntilExpiry = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Player Contracts</h1>
            <p className="text-muted-foreground mt-1">Manage player contract lifecycle</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-create-contract">
              <Plus size={18} /> New Contract
            </button>
          )}
        </div>

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

              return (
                <div key={c.id} className="bg-card border rounded-xl p-6 space-y-4" data-testid={`card-contract-${c.id}`}>
                  <div className="flex items-start justify-between">
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {c.signOnFee != null && (
                      <div>
                        <p className="text-muted-foreground">Sign-On Fee</p>
                        <p className="font-semibold" data-testid={`text-sign-on-${c.id}`}>R {c.signOnFee.toLocaleString()}</p>
                      </div>
                    )}
                    {c.weeklyTransport != null && (
                      <div>
                        <p className="text-muted-foreground">Weekly Transport</p>
                        <p className="font-semibold" data-testid={`text-transport-${c.id}`}>R {c.weeklyTransport.toLocaleString()}</p>
                      </div>
                    )}
                    {c.salaryAmount != null && (
                      <div>
                        <p className="text-muted-foreground">Salary</p>
                        <p className="font-semibold" data-testid={`text-salary-${c.id}`}>R {c.salaryAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-semibold">
                        {Math.ceil((new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                      </p>
                    </div>
                  </div>

                  {c.obligations && (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Obligations</p>
                      <p className="bg-muted/50 rounded-lg p-3">{c.obligations}</p>
                    </div>
                  )}

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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
