import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Trash2, UserPlus, Search, Mail, Phone, Tag, Users, FileText, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const OFFICIAL_ROLES = [
  "REFEREE", "ASSISTANT_REFEREE", "SCORER", "LINE_JUDGE", "MATCH_COMMISSIONER",
  "HEAD_COACH", "ASSISTANT_COACH", "TEAM_MANAGER", "TRAINER", "MEDIC", "PHYSIOTHERAPIST", "OTHER"
];

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  REGISTRATION: { label: "Registration", color: "text-blue-400 bg-blue-500/10", icon: UserCheck },
  ADMIN_ASSIGNMENT: { label: "Admin Assigned", color: "text-afrocat-teal bg-afrocat-teal/10", icon: Shield },
  O2BIS_TEAM_OFFICIAL: { label: "O2BIS", color: "text-afrocat-gold bg-afrocat-gold-soft", icon: FileText },
};

type ViewMode = "by-person" | "by-role" | "by-team";

export default function Officials() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "");

  const [showAssign, setShowAssign] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchGender, setSearchGender] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("by-person");
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

  const filteredOfficials = (officials as any[]).filter((o: any) => {
    const allRoles = o.allRoles || [];
    if (filterTeam && !allRoles.some((r: any) => r.teamId === filterTeam || r.teamName === "All Teams")) return false;
    if (filterSource && !allRoles.some((r: any) => r.source === filterSource)) return false;
    return true;
  }).sort((a: any, b: any) => (a.fullName || "").localeCompare(b.fullName || ""));

  const allFlatRoles: any[] = [];
  filteredOfficials.forEach((o: any) => {
    (o.allRoles || []).forEach((r: any) => {
      if (filterSource && r.source !== filterSource) return;
      if (filterTeam && r.teamId !== filterTeam && r.teamName !== "All Teams") return;
      allFlatRoles.push({ ...r, official: o });
    });
  });

  const groupedByRole: Record<string, any[]> = {};
  allFlatRoles.forEach(r => {
    const key = r.officialRole || "OTHER";
    if (!groupedByRole[key]) groupedByRole[key] = [];
    groupedByRole[key].push(r);
  });

  const groupedByTeam: Record<string, any[]> = {};
  allFlatRoles.forEach(r => {
    const key = r.teamName || "Unassigned";
    if (!groupedByTeam[key]) groupedByTeam[key] = [];
    groupedByTeam[key].push(r);
  });

  const renderSourceBadge = (source: string) => {
    const info = SOURCE_LABELS[source];
    if (!info) return null;
    const Icon = info.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${info.color} uppercase tracking-wider`}>
        <Icon size={10} /> {info.label}
      </span>
    );
  };

  const renderOfficialCard = (o: any, showRoles = true) => (
    <div key={o.id} className="afrocat-card p-4 space-y-2" data-testid={`official-card-${o.id}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-sm font-bold text-afrocat-gold shrink-0">
          {(o.fullName || "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-afrocat-text" data-testid={`text-official-name-${o.id}`}>{o.fullName || "Unknown"}</p>
          <div className="flex items-center gap-3 flex-wrap mt-0.5">
            {o.email && (
              <span className="flex items-center gap-1 text-[10px] text-afrocat-muted">
                <Mail size={10} /> {o.email}
              </span>
            )}
            {o.phone && (
              <span className="flex items-center gap-1 text-[10px] text-afrocat-muted">
                <Phone size={10} /> {o.phone}
              </span>
            )}
            {o.gender && (
              <span className="flex items-center gap-1 text-[10px] text-afrocat-muted">
                {o.gender}
              </span>
            )}
          </div>
        </div>
      </div>
      {showRoles && (o.allRoles || []).length > 0 && (
        <div className="pl-13 space-y-1">
          {(o.allRoles || []).map((r: any, i: number) => (
            <div key={r.id || i} className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-afrocat-text">{(r.officialRole || "").replace(/_/g, " ")}</span>
              <span className="text-[10px] text-afrocat-muted">→ {r.teamName || "—"}</span>
              {renderSourceBadge(r.source)}
              {!r.active && <span className="text-[9px] font-bold text-afrocat-red bg-afrocat-red-soft px-1.5 py-0.5 rounded-full">Inactive</span>}
              {canManage && r.source === "ADMIN_ASSIGNMENT" && (
                <button onClick={() => { if (confirm("Remove this assignment?")) removeMut.mutate(r.id); }}
                  className="p-0.5 rounded hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red transition-colors cursor-pointer" data-testid={`button-remove-${r.id}`}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRoleRow = (r: any) => (
    <div key={`${r.id}-${r.official?.id}`} className="afrocat-card p-3 flex items-center gap-3" data-testid={`role-row-${r.id}`}>
      <div className="w-8 h-8 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-xs font-bold text-afrocat-gold shrink-0">
        {(r.official?.fullName || "?").charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-afrocat-text">{r.official?.fullName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-afrocat-muted">{r.teamName}</span>
          {r.official?.email && <span className="text-[10px] text-afrocat-muted"><Mail size={9} className="inline mr-0.5" />{r.official.email}</span>}
          {r.official?.phone && <span className="text-[10px] text-afrocat-muted"><Phone size={9} className="inline mr-0.5" />{r.official.phone}</span>}
        </div>
      </div>
      {renderSourceBadge(r.source)}
      {canManage && r.source === "ADMIN_ASSIGNMENT" && (
        <button onClick={() => { if (confirm("Remove?")) removeMut.mutate(r.id); }}
          className="p-1 rounded hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-afrocat-gold" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-officials-title">Officials</h1>
              <p className="text-xs text-afrocat-muted">Unified view from Registration, Admin Assignments, and O2BIS roles</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => setShowAssign(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-assign-official">
              <Plus className="h-4 w-4" /> Assign Official
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
            {(["by-person", "by-role", "by-team"] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${viewMode === mode ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"}`}
                data-testid={`button-view-${mode}`}>
                {mode === "by-person" ? "By Person" : mode === "by-role" ? "By Role" : "By Team"}
              </button>
            ))}
          </div>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-filter-team">
            <option value="">All Teams</option>
            {(teams as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-filter-source">
            <option value="">All Sources</option>
            <option value="REGISTRATION">Registration</option>
            <option value="ADMIN_ASSIGNMENT">Admin Assigned</option>
            <option value="O2BIS_TEAM_OFFICIAL">O2BIS</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="afrocat-card p-3 flex items-center gap-2" data-testid="stat-total-officials">
            <Users size={18} className="text-afrocat-teal" />
            <div>
              <p className="text-lg font-bold text-afrocat-text">{filteredOfficials.length}</p>
              <p className="text-[10px] text-afrocat-muted">Total Officials</p>
            </div>
          </div>
          <div className="afrocat-card p-3 flex items-center gap-2" data-testid="stat-registration">
            <UserCheck size={18} className="text-blue-400" />
            <div>
              <p className="text-lg font-bold text-afrocat-text">{allFlatRoles.filter(r => r.source === "REGISTRATION").length}</p>
              <p className="text-[10px] text-afrocat-muted">From Registration</p>
            </div>
          </div>
          <div className="afrocat-card p-3 flex items-center gap-2" data-testid="stat-admin">
            <Shield size={18} className="text-afrocat-teal" />
            <div>
              <p className="text-lg font-bold text-afrocat-text">{allFlatRoles.filter(r => r.source === "ADMIN_ASSIGNMENT").length}</p>
              <p className="text-[10px] text-afrocat-muted">Admin Assigned</p>
            </div>
          </div>
          <div className="afrocat-card p-3 flex items-center gap-2" data-testid="stat-o2bis">
            <FileText size={18} className="text-afrocat-gold" />
            <div>
              <p className="text-lg font-bold text-afrocat-text">{allFlatRoles.filter(r => r.source === "O2BIS_TEAM_OFFICIAL").length}</p>
              <p className="text-[10px] text-afrocat-muted">O2BIS Roles</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : filteredOfficials.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No officials found</h3>
            <p className="text-sm text-afrocat-muted">{canManage ? "Assign officials to teams to get started." : "No officials have been assigned yet."}</p>
          </div>
        ) : viewMode === "by-person" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredOfficials.map((o: any) => renderOfficialCard(o))}
          </div>
        ) : viewMode === "by-role" ? (
          <div className="space-y-6">
            {Object.entries(groupedByRole).sort(([a], [b]) => a.localeCompare(b)).map(([role, items]) => (
              <div key={role}>
                <h2 className="text-xs font-bold text-afrocat-gold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Tag size={12} /> {role.replace(/_/g, " ")} <span className="text-afrocat-muted font-normal">({items.length})</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(renderRoleRow)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByTeam).sort(([a], [b]) => a.localeCompare(b)).map(([teamName, items]) => (
              <div key={teamName}>
                <h2 className="text-xs font-bold text-afrocat-gold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users size={12} /> {teamName} <span className="text-afrocat-muted font-normal">({items.length})</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(renderRoleRow)}
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
              <div className="max-h-48 overflow-y-auto mt-2 space-y-1">
                {[...(members as any[])].filter((m: any) => !searchGender || (m.gender || "").toLowerCase() === searchGender.toLowerCase()).sort((a: any, b: any) => (a.fullName || "").localeCompare(b.fullName || "")).map((m: any) => (
                  <button key={m.id} onClick={() => setAssignForm(f => ({ ...f, officialUserId: m.id }))}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${assignForm.officialUserId === m.id ? "bg-afrocat-teal/15 text-afrocat-teal" : "hover:bg-afrocat-white-5 text-afrocat-text"}`}
                    data-testid={`pick-official-${m.id}`}>
                    <UserPlus className="h-3 w-3 shrink-0" />
                    <div className="flex-1 text-left">
                      <span className="font-bold">{m.fullName}</span>
                      <span className="text-afrocat-muted ml-1">({m.role})</span>
                      {m.email && <span className="text-afrocat-muted ml-1 text-[10px]">{m.email}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Team</label>
              <select value={assignForm.teamId} onChange={e => setAssignForm(f => ({ ...f, teamId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-official-team">
                <option value="">Select team...</option>
                {(teams as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
