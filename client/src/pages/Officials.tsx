import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Trash2, UserPlus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const OFFICIAL_ROLES = [
  "REFEREE", "ASSISTANT_REFEREE", "SCORER", "LINE_JUDGE", "MATCH_COMMISSIONER", "OTHER"
];

interface FlatAssignment {
  assignmentId: string;
  officialName: string;
  officialRole: string;
  teamName: string;
  active: boolean;
  userId: string;
}

export default function Officials() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "");

  const [showAssign, setShowAssign] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchGender, setSearchGender] = useState("");
  const [assignForm, setAssignForm] = useState({ officialUserId: "", teamId: "", officialRole: "REFEREE" });

  const { data: officials = [], isLoading } = useQuery({
    queryKey: ["/api/officials"],
    queryFn: api.getOfficials,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: api.getTeams,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["/api/members/search", searchQ],
    queryFn: () => api.searchMembers(searchQ || undefined),
    enabled: showAssign,
  });

  const assignMut = useMutation({
    mutationFn: () => api.assignOfficial(assignForm),
    onSuccess: () => {
      toast({ title: "Official assigned" });
      setShowAssign(false);
      setAssignForm({ officialUserId: "", teamId: "", officialRole: "REFEREE" });
      qc.invalidateQueries({ queryKey: ["/api/officials"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.removeOfficialAssignment(id),
    onSuccess: () => {
      toast({ title: "Assignment removed" });
      qc.invalidateQueries({ queryKey: ["/api/officials"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const flatAssignments: FlatAssignment[] = [];
  officials.forEach((o: any) => {
    const assignments = o.assignments || [];
    if (assignments.length === 0) return;
    assignments.forEach((a: any) => {
      flatAssignments.push({
        assignmentId: a.id,
        officialName: o.fullName || "Unknown",
        officialRole: a.officialRole || "OTHER",
        teamName: a.teamName || "—",
        active: a.active !== false,
        userId: o.id || o.userId,
      });
    });
  });

  const grouped: Record<string, FlatAssignment[]> = {};
  flatAssignments.forEach(a => {
    const key = a.officialRole;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-afrocat-gold" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-officials-title">Officials</h1>
              <p className="text-xs text-afrocat-muted">Match officials and their team assignments</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => setShowAssign(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-assign-official">
              <Plus className="h-4 w-4" /> Assign Official
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : flatAssignments.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No officials assigned</h3>
            <p className="text-sm text-afrocat-muted">{canManage ? "Assign officials to teams to get started." : "No officials have been assigned yet."}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([role, items]) => (
              <div key={role}>
                <h2 className="text-sm font-bold text-afrocat-gold uppercase tracking-wider mb-3">{role.replace(/_/g, " ")}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((a) => (
                    <div key={a.assignmentId} className="afrocat-card p-4 flex items-center gap-3" data-testid={`official-card-${a.assignmentId}`}>
                      <div className="w-10 h-10 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-sm font-bold text-afrocat-gold">
                        {a.officialName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-afrocat-text">{a.officialName}</p>
                        <p className="text-[10px] text-afrocat-muted">Team: {a.teamName}</p>
                      </div>
                      {!a.active && <span className="text-[10px] font-bold text-afrocat-red bg-afrocat-red-soft px-2 py-0.5 rounded-full">Inactive</span>}
                      {canManage && (
                        <button onClick={() => { if (confirm("Remove this assignment?")) removeMut.mutate(a.assignmentId); }}
                          className="p-1.5 rounded-lg hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red transition-colors cursor-pointer" data-testid={`button-remove-official-${a.assignmentId}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-md">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-gold">Assign Official</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Search Member</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-afrocat-muted" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-official-search" />
              </div>
              <select value={searchGender} onChange={e => setSearchGender(e.target.value)}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-official-gender-filter">
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                {[...members].filter((m: any) => !searchGender || (m.gender || "").toLowerCase() === searchGender.toLowerCase()).sort((a: any, b: any) => (a.fullName || "").localeCompare(b.fullName || "")).map((m: any) => (
                  <button key={m.id} onClick={() => setAssignForm(f => ({ ...f, officialUserId: m.id }))}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${assignForm.officialUserId === m.id ? "bg-afrocat-teal/15 text-afrocat-teal" : "hover:bg-afrocat-white-5 text-afrocat-text"}`}
                    data-testid={`pick-official-${m.id}`}>
                    <UserPlus className="h-3 w-3" /> {m.fullName} <span className="text-afrocat-muted">({m.role})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Team</label>
              <select value={assignForm.teamId} onChange={e => setAssignForm(f => ({ ...f, teamId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-official-team">
                <option value="">Select team...</option>
                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Role</label>
              <select value={assignForm.officialRole} onChange={e => setAssignForm(f => ({ ...f, officialRole: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-official-role">
                {OFFICIAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>

            <button onClick={() => assignMut.mutate()} disabled={!assignForm.officialUserId || !assignForm.teamId || assignMut.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-confirm-assign">
              {assignMut.isPending ? "Assigning..." : "Assign Official"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
