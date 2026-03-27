import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Users, Trophy, Pencil, Medal, Search, Trash2,
  UserPlus, X, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const CATEGORIES = ["MEN", "WOMEN", "VETERANS", "JUNIORS"] as const;
const POSITIONS = ["Outside Hitter", "Middle Blocker", "Opposite", "Setter", "Libero", "Defensive Specialist"];

export default function Teams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const canManage = user && ["ADMIN", "MANAGER"].includes(user.role);
  const canCreateTournament = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role || "");

  // ── Regular team form ──────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("MEN");
  const [season, setSeason] = useState("2024/2025");

  // ── Edit team form ─────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSeason, setEditSeason] = useState("");

  // ── Tournament team form ───────────────────────────────
  const [showTournament, setShowTournament] = useState(false);
  const [tName, setTName] = useState("");
  const [tTournamentName, setTTournamentName] = useState("");
  const [tCategory, setTCategory] = useState<string>("MEN");
  const [tSeason, setTSeason] = useState("2024/2025");

  // ── Roster manager ─────────────────────────────────────
  const [rosterTeam, setRosterTeam] = useState<any>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterGender, setRosterGender] = useState("");
  const [rosterPosition, setRosterPosition] = useState("");
  const [jerseyEdits, setJerseyEdits] = useState<Record<string, string>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Queries ────────────────────────────────────────────
  const { data: roster = [] } = useQuery({
    queryKey: ["/api/tournament-teams", rosterTeam?.id, "roster"],
    queryFn: () => api.getTournamentRoster(rosterTeam!.id),
    enabled: !!rosterTeam?.id,
  });

  // ── Mutations ──────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: () => api.createTeam({ name, category, season, isTournament: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); setShowCreate(false); setName(""); toast({ title: "Team created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTournamentMut = useMutation({
    mutationFn: () => api.createTeam({ name: tName, category: tCategory, season: tSeason, isTournament: true, tournamentName: tTournamentName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowTournament(false); setTName(""); setTTournamentName("");
      toast({ title: "Tournament team created", description: "You can now manage its roster." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () => api.updateTeam(editTeam.id, { name: editName, category: editCategory, season: editSeason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); setEditOpen(false); setEditTeam(null); toast({ title: "Team updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addPlayerMut = useMutation({
    mutationFn: ({ playerId, position }: { playerId: string; position?: string }) =>
      api.addToTournamentRoster(rosterTeam!.id, { playerId, position }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tournament-teams", rosterTeam?.id, "roster"] }); toast({ title: "Player added to roster" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removePlayerMut = useMutation({
    mutationFn: (playerId: string) => api.removeFromTournamentRoster(rosterTeam!.id, playerId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tournament-teams", rosterTeam?.id, "roster"] }); toast({ title: "Player removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRosterMut = useMutation({
    mutationFn: ({ playerId, jerseyNo }: { playerId: string; jerseyNo: number }) =>
      api.updateTournamentRosterEntry(rosterTeam!.id, playerId, { jerseyNo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/tournament-teams", rosterTeam?.id, "roster"] });
      setJerseyEdits(prev => { const next = { ...prev }; delete next[vars.playerId]; return next; });
      toast({ title: "Jersey number updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveJersey = (playerId: string, current: string) => {
    const num = parseInt(current, 10);
    if (!isNaN(num) && num >= 0) updateRosterMut.mutate({ playerId, jerseyNo: num });
  };

  // ── Derived data ───────────────────────────────────────
  const regularTeams = (teams as any[]).filter((t: any) => !t.isTournament);
  const tournamentTeams = (teams as any[]).filter((t: any) => t.isTournament);

  const rosterIds = new Set((roster as any[]).map((r: any) => r.playerId));

  const availablePlayers = (allPlayers as any[])
    .filter((p: any) => {
      if (rosterIds.has(p.id)) return false;
      const full = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (rosterSearch && !full.includes(rosterSearch.toLowerCase())) return false;
      if (rosterGender && (p.gender || "").toLowerCase() !== rosterGender.toLowerCase()) return false;
      if (rosterPosition && p.position !== rosterPosition) return false;
      return true;
    })
    .sort((a: any, b: any) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const openEditDialog = (team: any) => {
    setEditTeam(team); setEditName(team.name);
    setEditCategory(team.category); setEditSeason(team.season);
    setEditOpen(true);
  };

  const playerCount = (teamId: string) =>
    (allPlayers as any[]).filter((p: any) => p.teamId === teamId).length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Teams</h1>
            <p className="text-afrocat-muted mt-1">Manage club divisions, rosters and tournament squads</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canCreateTournament && (
              <button onClick={() => setShowTournament(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold text-afrocat-bg font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
                data-testid="button-create-tournament-team">
                <Medal size={16} /> Tournament Team
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
                data-testid="button-add-team">
                <Plus size={16} /> Add Team
              </button>
            )}
          </div>
        </div>

        {/* ── Regular Teams ── */}
        <section>
          <h2 className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={12} /> Club Teams
          </h2>
          {isLoading ? (
            <div className="text-center py-10 text-afrocat-muted">Loading teams...</div>
          ) : regularTeams.length === 0 ? (
            <div className="afrocat-card p-8 text-center text-afrocat-muted">No teams yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {regularTeams.map((team: any) => (
                <div key={team.id} className="afrocat-card p-5 hover:border-afrocat-teal/30 transition-all" data-testid={`card-team-${team.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-display font-bold text-afrocat-text" data-testid={`text-team-name-${team.id}`}>{team.name}</h3>
                      <p className="text-sm text-afrocat-muted mt-1">{team.category} · {team.season}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage && (
                        <button onClick={() => openEditDialog(team)}
                          className="w-8 h-8 rounded-full bg-afrocat-white-5 flex items-center justify-center hover:bg-afrocat-teal/10 transition-colors cursor-pointer"
                          data-testid={`button-edit-team-${team.id}`}>
                          <Pencil className="h-3.5 w-3.5 text-afrocat-muted" />
                        </button>
                      )}
                      <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center">
                        <Trophy className="h-4 w-4 text-afrocat-teal" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-afrocat-muted mt-4">
                    <Users className="h-4 w-4" />
                    <span>{playerCount(team.id)} Players</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Tournament Teams ── */}
        <section>
          <h2 className="text-xs font-bold text-afrocat-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Medal size={12} /> Tournament Teams
          </h2>
          {tournamentTeams.length === 0 ? (
            <div className="afrocat-card p-8 text-center">
              <Medal className="h-12 w-12 mx-auto mb-3 text-afrocat-muted opacity-30" />
              <p className="text-afrocat-muted text-sm">No tournament teams yet.</p>
              {canCreateTournament && (
                <button onClick={() => setShowTournament(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-afrocat-gold/10 border border-afrocat-gold/30 text-afrocat-gold text-sm font-bold cursor-pointer hover:bg-afrocat-gold/20 transition-colors">
                  Create Tournament Team
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {tournamentTeams.map((team: any) => {
                const isExpanded = expandedTeams.has(team.id);
                return (
                  <div key={team.id} className="afrocat-card overflow-hidden border-afrocat-gold/30" data-testid={`card-tournament-${team.id}`}>
                    {/* Tournament team header */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-afrocat-gold-soft flex items-center justify-center shrink-0">
                        <Medal className="h-5 w-5 text-afrocat-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-display font-bold text-afrocat-text">{team.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold uppercase tracking-wider">Tournament</span>
                        </div>
                        <p className="text-xs text-afrocat-muted mt-0.5">
                          {team.tournamentName && <span className="text-afrocat-gold font-medium">{team.tournamentName} · </span>}
                          {team.category} · {team.season}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <button onClick={() => openEditDialog(team)}
                            className="p-1.5 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid={`button-edit-tournament-${team.id}`}>
                            <Pencil size={14} />
                          </button>
                        )}
                        <button onClick={() => { setRosterTeam(team); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-gold/10 text-afrocat-gold text-xs font-bold cursor-pointer hover:bg-afrocat-gold/20 transition-colors"
                          data-testid={`button-manage-roster-${team.id}`}>
                          <UserPlus size={13} /> Manage Roster
                        </button>
                        <button onClick={() => toggleExpand(team.id)}
                          className="p-1.5 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid={`button-expand-${team.id}`}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded roster preview */}
                    {isExpanded && (
                      <TournamentRosterPreview teamId={team.id} canManage={!!canCreateTournament}
                        onRemove={(playerId) => {
                          setRosterTeam(team);
                          removePlayerMut.mutate(playerId);
                        }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Create Regular Team Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader><DialogTitle className="font-display text-afrocat-text">Add Team</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div><Label className="text-afrocat-muted text-sm">Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required data-testid="input-team-name"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" /></div>
            <div><Label className="text-afrocat-muted text-sm">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-afrocat-muted text-sm">Season</Label>
              <Input value={season} onChange={e => setSeason(e.target.value)} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" /></div>
            <Button type="submit" disabled={createMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white">
              {createMut.isPending ? "Creating..." : "Create Team"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Tournament Team Dialog ── */}
      <Dialog open={showTournament} onOpenChange={setShowTournament}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader>
            <DialogTitle className="font-display text-afrocat-gold flex items-center gap-2"><Medal size={18} /> Create Tournament Team</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-afrocat-muted -mt-2">A tournament team lets you pull players from any club team for a specific competition.</p>
          <form onSubmit={e => { e.preventDefault(); createTournamentMut.mutate(); }} className="space-y-4">
            <div><Label className="text-afrocat-muted text-sm">Team Name</Label>
              <Input value={tName} onChange={e => setTName(e.target.value)} required placeholder="e.g. Afrocat A — Nationals 2025"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" data-testid="input-tournament-team-name" /></div>
            <div><Label className="text-afrocat-muted text-sm">Tournament / Competition Name</Label>
              <Input value={tTournamentName} onChange={e => setTTournamentName(e.target.value)} placeholder="e.g. Namibia Open 2025"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" data-testid="input-tournament-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-afrocat-muted text-sm">Category</Label>
                <Select value={tCategory} onValueChange={setTCategory}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-afrocat-muted text-sm">Season</Label>
                <Input value={tSeason} onChange={e => setTSeason(e.target.value)} required
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" /></div>
            </div>
            <Button type="submit" disabled={createTournamentMut.isPending} className="w-full bg-afrocat-gold text-afrocat-bg hover:opacity-90 font-bold">
              {createTournamentMut.isPending ? "Creating..." : "Create Tournament Team"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Team Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) setEditTeam(null); }}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader><DialogTitle className="font-display text-afrocat-text">Edit Team</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); updateMut.mutate(); }} className="space-y-4">
            <div><Label className="text-afrocat-muted text-sm">Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required data-testid="input-edit-team-name"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" /></div>
            <div><Label className="text-afrocat-muted text-sm">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-afrocat-muted text-sm">Season</Label>
              <Input value={editSeason} onChange={e => setEditSeason(e.target.value)} required
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text mt-1" /></div>
            <Button type="submit" disabled={updateMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-save-team">
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Roster Manager Sheet ── */}
      {rosterTeam && (
        <Dialog open={!!rosterTeam} onOpenChange={o => { if (!o) setRosterTeam(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="font-display text-afrocat-gold flex items-center gap-2">
                <Medal size={18} /> {rosterTeam.name} — Roster
              </DialogTitle>
              {rosterTeam.tournamentName && (
                <p className="text-xs text-afrocat-muted">{rosterTeam.tournamentName} · {rosterTeam.category} · {rosterTeam.season}</p>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Current Roster */}
              <div>
                <p className="text-xs font-bold text-afrocat-gold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users size={11} /> Current Roster <span className="text-afrocat-muted font-normal">({(roster as any[]).length})</span>
                </p>
                {(roster as any[]).length === 0 ? (
                  <p className="text-xs text-afrocat-muted italic px-3 py-4 text-center border border-dashed border-afrocat-border rounded-lg">No players added yet</p>
                ) : (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {(roster as any[]).map((r: any) => {
                      const pendingJersey = jerseyEdits[r.playerId];
                      const displayJersey = pendingJersey !== undefined ? pendingJersey : String(r.jerseyNo ?? r.player?.jerseyNo ?? "");
                      return (
                        <div key={r.playerId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-afrocat-white-5" data-testid={`roster-row-${r.playerId}`}>
                          {canCreateTournament ? (
                            <div className="relative shrink-0" title="Edit jersey number">
                              <input
                                type="number"
                                min={0}
                                max={99}
                                value={displayJersey}
                                onChange={e => setJerseyEdits(prev => ({ ...prev, [r.playerId]: e.target.value }))}
                                onBlur={() => { if (pendingJersey !== undefined) saveJersey(r.playerId, pendingJersey); }}
                                onKeyDown={e => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                className="w-10 h-8 rounded-lg bg-afrocat-gold-soft border border-afrocat-gold/40 text-afrocat-gold text-xs font-bold text-center focus:outline-none focus:border-afrocat-gold appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                data-testid={`input-jersey-${r.playerId}`}
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-xs font-bold text-afrocat-gold shrink-0">
                              {r.jerseyNo ?? r.player?.jerseyNo ?? "—"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-afrocat-text truncate">{r.player?.fullName}</p>
                            <p className="text-[10px] text-afrocat-muted">
                              {r.position || r.player?.position || "—"}
                              {r.originalTeamName && <span className="ml-1 text-afrocat-teal">· {r.originalTeamName}</span>}
                            </p>
                          </div>
                          {canCreateTournament && (
                            <button onClick={() => removePlayerMut.mutate(r.playerId)}
                              className="p-1 rounded hover:bg-red-500/10 text-afrocat-muted hover:text-red-400 cursor-pointer transition-colors"
                              data-testid={`button-remove-roster-${r.playerId}`}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Players */}
              {canCreateTournament && (
                <div>
                  <p className="text-xs font-bold text-afrocat-teal uppercase tracking-wider mb-2 flex items-center gap-2">
                    <UserPlus size={11} /> Add Players from Club
                  </p>
                  <div className="flex gap-2 flex-wrap mb-2">
                    <div className="relative flex-1 min-w-36">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-afrocat-muted" />
                      <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search players..."
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs"
                        data-testid="input-roster-search" />
                    </div>
                    <select value={rosterGender} onChange={e => setRosterGender(e.target.value)}
                      className="px-2 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-roster-gender">
                      <option value="">Any Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <select value={rosterPosition} onChange={e => setRosterPosition(e.target.value)}
                      className="px-2 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-roster-position">
                      <option value="">Any Position</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {availablePlayers.length === 0 ? (
                      <p className="text-xs text-afrocat-muted italic text-center py-4">No players match your filters</p>
                    ) : availablePlayers.map((p: any) => {
                      const teamName = (teams as any[]).find((t: any) => t.id === p.teamId)?.name || "";
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-afrocat-white-5 transition-colors" data-testid={`available-player-${p.id}`}>
                          <div className="w-7 h-7 rounded-full bg-afrocat-teal/10 flex items-center justify-center text-xs font-bold text-afrocat-teal shrink-0">
                            {p.jerseyNo ?? "#"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-afrocat-text truncate">{p.firstName} {p.lastName}</p>
                            <p className="text-[10px] text-afrocat-muted">
                              {p.position || "No position"}
                              {teamName && <span className="ml-1 text-afrocat-teal">· {teamName}</span>}
                              {p.gender && <span className="ml-1">· {p.gender}</span>}
                            </p>
                          </div>
                          <button onClick={() => addPlayerMut.mutate({ playerId: p.id, position: p.position || undefined })}
                            disabled={addPlayerMut.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-afrocat-teal/10 text-afrocat-teal text-[11px] font-bold cursor-pointer hover:bg-afrocat-teal/20 transition-colors disabled:opacity-50"
                            data-testid={`button-add-player-${p.id}`}>
                            <Plus size={11} /> Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}

function TournamentRosterPreview({ teamId, canManage, onRemove }: { teamId: string; canManage: boolean; onRemove: (id: string) => void }) {
  const { data: roster = [] } = useQuery({
    queryKey: ["/api/tournament-teams", teamId, "roster"],
    queryFn: () => api.getTournamentRoster(teamId),
  });

  if ((roster as any[]).length === 0) {
    return <div className="px-4 pb-4 text-xs text-afrocat-muted italic">No players in roster yet. Click "Manage Roster" to add players.</div>;
  }

  return (
    <div className="px-4 pb-4 border-t border-afrocat-border pt-3">
      <p className="text-[10px] font-bold text-afrocat-muted uppercase tracking-wider mb-2">{(roster as any[]).length} Players in Roster</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {(roster as any[]).map((r: any) => (
          <div key={r.playerId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-afrocat-white-5" data-testid={`roster-preview-${r.playerId}`}>
            <div className="w-6 h-6 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-[10px] font-bold text-afrocat-gold shrink-0">
              {r.player?.jerseyNo ?? "—"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-afrocat-text truncate">{r.player?.fullName}</p>
              <p className="text-[9px] text-afrocat-teal truncate">{r.originalTeamName}</p>
            </div>
            {canManage && (
              <button onClick={() => onRemove(r.playerId)} className="text-afrocat-muted hover:text-red-400 cursor-pointer">
                <X size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
