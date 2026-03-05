import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Users, Clock, Lock, Loader2, Trophy, AlertTriangle, Pencil, Download, FileText, UserCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { SquadSelector } from "@/components/SquadSelector";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  UPCOMING: { bg: "bg-afrocat-teal-soft", text: "text-afrocat-teal", label: "Upcoming" },
  LIVE: { bg: "bg-afrocat-red-soft", text: "text-afrocat-red", label: "Live" },
  PAST_NO_SCORE: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Score Missing" },
  PLAYED: { bg: "bg-afrocat-green-soft", text: "text-afrocat-green", label: "Played" },
  CANCELLED: { bg: "bg-afrocat-red-soft", text: "text-afrocat-red", label: "Cancelled" },
};

export default function Matches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: upcomingMatches = [], isLoading: loadingUpcoming } = useQuery({ queryKey: ["/api/matches/upcoming"], queryFn: api.getUpcomingMatches });
  const { data: playedMatches = [], isLoading: loadingPlayed } = useQuery({ queryKey: ["/api/matches/played"], queryFn: api.getPlayedMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    teamId: "", opponent: "", matchDate: "", startTime: "",
    venue: "Home", competition: "", round: "",
  });
  const [squadMatchId, setSquadMatchId] = useState<string | null>(null);
  const [squadTeamId, setSquadTeamId] = useState<string | null>(null);
  const [scoreModal, setScoreModal] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState({ homeScore: 0, awayScore: 0, result: "" });
  const [setStatsModal, setSetStatsModal] = useState<any | null>(null);
  const [setsInput, setSetsInput] = useState<Array<{ homePoints: number; awayPoints: number }>>([
    { homePoints: 0, awayPoints: 0 },
    { homePoints: 0, awayPoints: 0 },
    { homePoints: 0, awayPoints: 0 },
  ]);
  const [statsTimeForm, setStatsTimeForm] = useState({ startTime: "", endTime: "" });

  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ startTime: "", venue: "", competition: "", round: "", notes: "", opponent: "" });
  const [staffModal, setStaffModal] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ headCoachUserId: "", assistantCoachUserId: "", medicUserId: "", teamManagerUserId: "" });
  const [o2bisModal, setO2bisModal] = useState<{ matchId: string; missing: string[] } | null>(null);
  const canManageStaff = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);
  const { data: allUsers = [] } = useQuery({ queryKey: ["/api/staff-eligible-users"], queryFn: api.getStaffEligibleUsers, enabled: !!canManageStaff });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/matches/upcoming"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches/played"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
  };

  const [finalScoreModal, setFinalScoreModal] = useState<string | null>(null);
  const [finalScoreForm, setFinalScoreForm] = useState({ homeScore: 0, awayScore: 0 });

  const createMut = useMutation({
    mutationFn: () => {
      const startTimeISO = form.startTime ? new Date(`${form.matchDate}T${form.startTime}`).toISOString() : undefined;
      return api.createMatch({
        teamId: form.teamId,
        opponent: form.opponent,
        matchDate: form.matchDate,
        startTime: startTimeISO,
        venue: form.venue,
        competition: form.competition,
        round: form.round || undefined,
      });
    },
    onSuccess: () => {
      invalidateAll();
      setOpen(false);
      setForm({ teamId: "", opponent: "", matchDate: "", startTime: "", venue: "Home", competition: "", round: "" });
      toast({ title: "Match created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const finalScoreMut = useMutation({
    mutationFn: () => api.submitFinalScore(finalScoreModal!, finalScoreForm),
    onSuccess: () => {
      invalidateAll();
      setFinalScoreModal(null);
      toast({ title: "Final score saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const scoreMut = useMutation({
    mutationFn: () => api.submitMatchScore(scoreModal!, {
      homeScore: scoreForm.homeScore,
      awayScore: scoreForm.awayScore,
      result: scoreForm.result || undefined,
      setsFor: scoreForm.homeScore,
      setsAgainst: scoreForm.awayScore,
    }),
    onSuccess: () => {
      invalidateAll();
      setScoreModal(null);
      toast({ title: "Score saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setStatsMut = useMutation({
    mutationFn: () => {
      const matchDate = setStatsModal?.matchDate || "";
      const payload: any = { sets: setsInput };
      if (statsTimeForm.startTime) {
        payload.startTime = new Date(`${matchDate}T${statsTimeForm.startTime}`).toISOString();
      }
      if (statsTimeForm.endTime) {
        payload.endTime = new Date(`${matchDate}T${statsTimeForm.endTime}`).toISOString();
      }
      return api.submitMatchSetStats(setStatsModal!.id, payload);
    },
    onSuccess: () => {
      invalidateAll();
      setSetStatsModal(null);
      setStatsTimeForm({ startTime: "", endTime: "" });
      toast({ title: "Set stats & score saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: () => api.editMatch(editModal.id, {
      startTime: editForm.startTime ? new Date(`${editModal.matchDate}T${editForm.startTime}`).toISOString() : undefined,
      venue: editForm.venue || undefined,
      competition: editForm.competition || undefined,
      round: editForm.round || undefined,
      notes: editForm.notes || undefined,
      opponent: editForm.opponent || undefined,
    }),
    onSuccess: () => {
      invalidateAll();
      setEditModal(null);
      toast({ title: "Match updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const staffMut = useMutation({
    mutationFn: () => api.saveMatchStaff(staffModal!, staffForm),
    onSuccess: () => {
      invalidateAll();
      setStaffModal(null);
      toast({ title: "Staff assigned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [liberoModal, setLiberoModal] = useState<{ matchId: string; teamId: string; totalSelected: number; liberoCount: number } | null>(null);
  const [liberoLoading, setLiberoLoading] = useState(false);

  const downloadO2bisPdf = async (matchId: string, skipMissing: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/api/docs/o2bis/${matchId}.pdf?skipMissing=${skipMissing}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        if (errData?.needsLiberos) {
          const allMatches = [...(upcomingMatches || []), ...(playedMatches || [])];
          const match = allMatches.find((m: any) => m.id === matchId);
          setLiberoModal({ matchId, teamId: match?.teamId || "", totalSelected: errData.totalSelected, liberoCount: errData.liberoCount });
          return;
        }
        throw new Error(errData?.message || "Failed to generate O2BIS PDF");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `O2BIS_${matchId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "O2BIS PDF downloaded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAutoSelectLiberosMatch = async () => {
    if (!liberoModal) return;
    setLiberoLoading(true);
    try {
      await api.autoSelectLiberos(liberoModal.matchId, liberoModal.teamId);
      setLiberoModal(null);
      await downloadO2bisPdf(liberoModal.matchId, false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLiberoLoading(false);
    }
  };

  const handleO2bisCheck = async (matchId: string) => {
    try {
      const result = await api.checkO2bis(matchId);
      if (result.missing && result.missing.length > 0) {
        setO2bisModal({ matchId, missing: result.missing });
      } else {
        await downloadO2bisPdf(matchId, false);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const canCreate = user && ["ADMIN", "MANAGER", "COACH", "STATISTICIAN"].includes(user.role);
  const canSelectSquad = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);
  const canScore = user && ["ADMIN", "MANAGER", "COACH", "STATISTICIAN"].includes(user.role);
  const isAdmin = user?.role === "ADMIN";
  const canAssignStaff = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);
  const canGenerateO2bis = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);

  const isLoading = loadingUpcoming || loadingPlayed;

  const renderMatchCard = (match: any, isUpcoming: boolean) => {
    const team = (teams || []).find((t: any) => t.id === match.teamId);
    const isWin = match.result === "W";
    const showingSquad = squadMatchId === match.id && squadTeamId === match.teamId;
    const isPastNoScore = match.status === "PAST_NO_SCORE";
    const canEnterScore = canScore && !isUpcoming && !match.statsEntered && !match.scoreLocked;
    const canEnterFinalScore = isAdmin && isPastNoScore;
    const isScoreLocked = match.scoreLocked || match.statsEntered;

    const statusStyle = STATUS_STYLES[match.status] || STATUS_STYLES.UPCOMING;

    return (
      <div key={match.id} className="afrocat-card overflow-hidden" data-testid={`card-match-${match.id}`}>
        <div className="flex flex-col md:flex-row">
          <div className={`w-full md:w-2 ${isUpcoming ? 'bg-afrocat-teal' : match.result ? (isWin ? 'bg-afrocat-green' : 'bg-afrocat-red') : 'bg-afrocat-white-10'} h-1.5 md:h-auto`} />
          <div className="flex-1 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 text-sm text-afrocat-muted flex-wrap">
                  <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0 font-bold text-xs`} data-testid={`badge-status-${match.id}`}>
                    {statusStyle.label}
                  </Badge>
                  {!isUpcoming && match.statsEntered && (
                    <Badge className="bg-afrocat-green-soft text-afrocat-green border-0 font-bold text-xs" data-testid={`badge-score-locked-stats-${match.id}`}>
                      <Lock className="h-3 w-3 mr-1" /> Score Locked (From Stats)
                    </Badge>
                  )}
                  {!isUpcoming && match.scoreLocked && match.scoreSource === "MANUAL" && !match.statsEntered && (
                    <Badge className="bg-afrocat-gold-soft text-afrocat-gold border-0 font-bold text-xs" data-testid={`badge-final-score-${match.id}`}>
                      <Trophy className="h-3 w-3 mr-1" /> Final Score
                    </Badge>
                  )}
                  <span className="font-medium px-2 py-0.5 rounded bg-afrocat-teal-soft text-afrocat-teal text-xs">{match.competition}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {match.matchDate}</span>
                  {match.startTime && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {match.venue}</span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex-1 text-right">
                    <h3 className="text-xl font-bold font-display text-afrocat-text">{team?.name || "Team"}</h3>
                  </div>
                  {isUpcoming ? (
                    <div className="px-4 py-2 bg-afrocat-white-5 rounded-lg flex flex-col items-center justify-center min-w-[100px] border border-afrocat-border">
                      <span className="text-sm font-medium text-afrocat-muted">vs</span>
                      {match.timeLeftLabel && (
                        <span className="text-xs text-afrocat-teal mt-1" data-testid={`text-countdown-${match.id}`}>{match.timeLeftLabel}</span>
                      )}
                    </div>
                  ) : isPastNoScore ? (
                    <div className="px-4 py-2 bg-yellow-500/5 rounded-lg flex items-center justify-center min-w-[100px] border border-yellow-500/20">
                      <span className="text-sm font-medium text-yellow-400" data-testid={`text-score-pending-${match.id}`}>Score pending</span>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-afrocat-white-5 rounded-lg flex items-center justify-center min-w-[100px] border border-afrocat-border">
                      <span className="text-2xl font-bold font-display text-afrocat-text" data-testid={`text-home-score-${match.id}`}>{match.homeScore ?? match.setsFor ?? 0}</span>
                      <span className="mx-2 text-afrocat-muted">-</span>
                      <span className="text-2xl font-bold font-display text-afrocat-text" data-testid={`text-away-score-${match.id}`}>{match.awayScore ?? match.setsAgainst ?? 0}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold font-display text-afrocat-text">{match.opponent}</h3>
                  </div>
                </div>

                {!isUpcoming && isScoreLocked && (
                  <div className="flex items-center gap-2 text-xs text-afrocat-muted">
                    <Lock className="h-3 w-3" />
                    <span>Score Locked {match.scoreSource === "STATS" ? "(From Stats)" : match.scoreSource === "MANUAL" ? "(Manual)" : ""}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {canEnterFinalScore && (
                  <Button
                    size="sm"
                    className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black"
                    onClick={() => { setFinalScoreModal(match.id); setFinalScoreForm({ homeScore: 0, awayScore: 0 }); }}
                    data-testid={`button-final-score-${match.id}`}
                  >
                    <Trophy className="h-4 w-4 mr-1" /> Enter Final Score
                  </Button>
                )}
                {canEnterScore && !isPastNoScore && (
                  <>
                    <Button
                      size="sm"
                      className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black"
                      onClick={() => { setScoreModal(match.id); setScoreForm({ homeScore: 0, awayScore: 0, result: "" }); }}
                      data-testid={`button-enter-score-${match.id}`}
                    >
                      <Trophy className="h-4 w-4 mr-1" /> Enter Score
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                      onClick={() => {
                        setSetStatsModal(match);
                        setSetsInput([
                          { homePoints: 0, awayPoints: 0 },
                          { homePoints: 0, awayPoints: 0 },
                          { homePoints: 0, awayPoints: 0 },
                        ]);
                        const existingStart = match.startTime ? new Date(match.startTime) : null;
                        setStatsTimeForm({
                          startTime: existingStart ? existingStart.toTimeString().slice(0,5) : "",
                          endTime: "",
                        });
                      }}
                      data-testid={`button-enter-sets-${match.id}`}
                    >
                      Enter Set Stats
                    </Button>
                  </>
                )}
                {canSelectSquad && (
                  <Button
                    variant={showingSquad ? "secondary" : "outline"}
                    size="sm"
                    className={showingSquad ? "" : "border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"}
                    onClick={() => {
                      if (showingSquad) { setSquadMatchId(null); setSquadTeamId(null); }
                      else { setSquadMatchId(match.id); setSquadTeamId(match.teamId); }
                    }}
                    data-testid={`button-squad-${match.id}`}
                  >
                    <Users className="h-4 w-4 mr-1" /> Starting 12
                  </Button>
                )}
                {isAdmin && isUpcoming && !match.statsEntered && !match.scoreLocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                    onClick={() => {
                      setEditModal(match);
                      const t = match.startTime ? new Date(match.startTime) : null;
                      setEditForm({
                        startTime: t ? `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}` : "",
                        venue: match.venue || "",
                        competition: match.competition || "",
                        round: match.round || "",
                        notes: match.notes || "",
                        opponent: match.opponent || "",
                      });
                    }}
                    data-testid={`button-edit-match-${match.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
                {canAssignStaff && isUpcoming && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                    onClick={async () => {
                      setStaffModal(match.id);
                      try {
                        const existing = await api.getMatchStaff(match.id);
                        if (existing) {
                          setStaffForm({
                            headCoachUserId: existing.headCoachUserId || "",
                            assistantCoachUserId: existing.assistantCoachUserId || "",
                            medicUserId: existing.medicUserId || "",
                            teamManagerUserId: existing.teamManagerUserId || "",
                          });
                        } else {
                          setStaffForm({ headCoachUserId: "", assistantCoachUserId: "", medicUserId: "", teamManagerUserId: "" });
                        }
                      } catch { setStaffForm({ headCoachUserId: "", assistantCoachUserId: "", medicUserId: "", teamManagerUserId: "" }); }
                    }}
                    data-testid={`button-staff-${match.id}`}
                  >
                    <UserCheck className="h-4 w-4 mr-1" /> Staff
                  </Button>
                )}
                {canGenerateO2bis && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-afrocat-teal text-afrocat-teal hover:bg-afrocat-teal/10"
                    onClick={() => handleO2bisCheck(match.id)}
                    data-testid={`button-o2bis-${match.id}`}
                  >
                    <FileText className="h-4 w-4 mr-1" /> O2BIS
                  </Button>
                )}
              </div>
            </div>

            {showingSquad && (
              <div className="mt-4 pt-4 border-t border-afrocat-border">
                <SquadSelector matchId={match.id} teamId={match.teamId} onClose={() => { setSquadMatchId(null); setSquadTeamId(null); }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-matches-title">Matches</h1>
            <p className="text-afrocat-muted mt-1">Schedule, results & squad selection</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-add-match">
                  <Plus className="mr-2 h-4 w-4" /> Schedule Match
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
                <DialogHeader><DialogTitle className="text-afrocat-text font-display">Schedule Match</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Team</Label>
                    <Select value={form.teamId} onValueChange={v => setForm({ ...form, teamId: v })}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-match-team">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Opponent</Label>
                    <Input value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-match-opponent" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-afrocat-muted text-xs uppercase">Date</Label>
                      <Input type="date" value={form.matchDate} onChange={e => setForm({ ...form, matchDate: e.target.value })} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-match-date" />
                    </div>
                    <div>
                      <Label className="text-afrocat-muted text-xs uppercase">Start Time</Label>
                      <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-match-time" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-afrocat-muted text-xs uppercase">Venue</Label>
                      <Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-match-venue" />
                    </div>
                    <div>
                      <Label className="text-afrocat-muted text-xs uppercase">Competition</Label>
                      <Input value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-match-competition" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-afrocat-teal-soft text-afrocat-teal text-sm" data-testid="text-future-match-note">
                    <Clock className="h-4 w-4" />
                    <span>Score will be available after match is played</span>
                  </div>

                  <Button type="submit" disabled={createMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-submit-match">
                    {createMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create Match"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-afrocat-muted" data-testid="text-loading-matches">Loading matches...</div>
        ) : (upcomingMatches.length === 0 && playedMatches.length === 0) ? (
          <div className="afrocat-card py-10 text-center text-afrocat-muted" data-testid="text-no-matches">No matches scheduled yet.</div>
        ) : (
          <div className="space-y-8">
            <div data-testid="section-upcoming-matches">
              <h2 className="text-xl font-display font-bold text-afrocat-teal mb-4 flex items-center gap-2" data-testid="text-upcoming-title">
                <Clock className="h-5 w-5" /> Upcoming Matches
              </h2>
              {upcomingMatches.length === 0 ? (
                <div className="afrocat-card py-6 text-center text-afrocat-muted" data-testid="text-no-upcoming">No upcoming matches.</div>
              ) : (
                <div className="space-y-4">
                  {upcomingMatches.map((match: any) => renderMatchCard(match, true))}
                </div>
              )}
            </div>

            <div data-testid="section-played-matches">
              <h2 className="text-xl font-display font-bold text-afrocat-green mb-4 flex items-center gap-2" data-testid="text-played-title">
                <Trophy className="h-5 w-5" /> Played Matches
              </h2>
              {playedMatches.length === 0 ? (
                <div className="afrocat-card py-6 text-center text-afrocat-muted" data-testid="text-no-played">No played matches yet.</div>
              ) : (
                <div className="space-y-4">
                  {playedMatches.map((match: any) => renderMatchCard(match, false))}
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={!!scoreModal} onOpenChange={(v) => { if (!v) setScoreModal(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
            <DialogHeader><DialogTitle className="text-afrocat-text font-display">Enter Final Score</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Home Sets Won</Label>
                  <Input type="number" min={0} value={scoreForm.homeScore} onChange={e => setScoreForm({ ...scoreForm, homeScore: Number(e.target.value) })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-home-score" />
                </div>
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Away Sets Won</Label>
                  <Input type="number" min={0} value={scoreForm.awayScore} onChange={e => setScoreForm({ ...scoreForm, awayScore: Number(e.target.value) })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-away-score" />
                </div>
              </div>
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Result Override (optional)</Label>
                <Select value={scoreForm.result} onValueChange={v => setScoreForm({ ...scoreForm, result: v })}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-score-result"><SelectValue placeholder="Auto-detect from score" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W">Win</SelectItem>
                    <SelectItem value="L">Loss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-afrocat-gold-soft text-afrocat-gold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>This will lock the score. Once locked, it cannot be edited unless stats are entered separately.</span>
              </div>
              <Button
                onClick={() => scoreMut.mutate()}
                disabled={scoreMut.isPending}
                className="w-full bg-afrocat-gold hover:bg-afrocat-gold/80 text-black"
                data-testid="button-submit-score"
              >
                {scoreMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Score & Lock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!setStatsModal} onOpenChange={(v) => { if (!v) setSetStatsModal(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-lg">
            <DialogHeader><DialogTitle className="text-afrocat-text font-display">Enter Set-by-Set Stats</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Match Start Time</Label>
                  <Input
                    type="time"
                    value={statsTimeForm.startTime}
                    onChange={e => setStatsTimeForm(p => ({ ...p, startTime: e.target.value }))}
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                    data-testid="input-stats-start-time"
                  />
                </div>
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Match End Time</Label>
                  <Input
                    type="time"
                    value={statsTimeForm.endTime}
                    onChange={e => setStatsTimeForm(p => ({ ...p, endTime: e.target.value }))}
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                    data-testid="input-stats-end-time"
                  />
                </div>
              </div>
              <div className="space-y-3">
                {setsInput.map((set, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-afrocat-white-3 border border-afrocat-border">
                    <span className="text-xs font-bold text-afrocat-muted w-12 shrink-0">Set {i + 1}</span>
                    <div className="flex-1">
                      <Label className="text-[10px] text-afrocat-muted">Home</Label>
                      <Input
                        type="number" min={0}
                        value={set.homePoints}
                        onChange={e => {
                          const newSets = [...setsInput];
                          newSets[i] = { ...newSets[i], homePoints: Number(e.target.value) };
                          setSetsInput(newSets);
                        }}
                        className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text h-8"
                        data-testid={`input-set-home-${i}`}
                      />
                    </div>
                    <span className="text-afrocat-muted font-bold">vs</span>
                    <div className="flex-1">
                      <Label className="text-[10px] text-afrocat-muted">Away</Label>
                      <Input
                        type="number" min={0}
                        value={set.awayPoints}
                        onChange={e => {
                          const newSets = [...setsInput];
                          newSets[i] = { ...newSets[i], awayPoints: Number(e.target.value) };
                          setSetsInput(newSets);
                        }}
                        className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text h-8"
                        data-testid={`input-set-away-${i}`}
                      />
                    </div>
                    {i >= 3 && (
                      <Button size="sm" variant="ghost" className="text-afrocat-red h-8 w-8 p-0" onClick={() => setSetsInput(setsInput.filter((_, j) => j !== i))} data-testid={`button-remove-set-${i}`}>×</Button>
                    )}
                  </div>
                ))}
              </div>
              {setsInput.length < 5 && (
                <Button
                  variant="outline" size="sm"
                  className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                  onClick={() => setSetsInput([...setsInput, { homePoints: 0, awayPoints: 0 }])}
                  data-testid="button-add-set"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Set
                </Button>
              )}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-afrocat-teal-soft text-afrocat-teal text-xs">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Start & end times lock the match. Score is computed from sets.</span>
              </div>
              <Button
                onClick={() => setStatsMut.mutate()}
                disabled={setStatsMut.isPending}
                className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80"
                data-testid="button-submit-sets"
              >
                {setStatsMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Sets & Lock Match"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editModal} onOpenChange={(v) => { if (!v) setEditModal(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
            <DialogHeader><DialogTitle className="text-afrocat-text font-display">Edit Match</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); editMut.mutate(); }} className="space-y-3">
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Opponent</Label>
                <Input value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-opponent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Start Time</Label>
                  <Input type="time" value={editForm.startTime} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-time" />
                </div>
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Venue</Label>
                  <Input value={editForm.venue} onChange={e => setEditForm({ ...editForm, venue: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-venue" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Competition</Label>
                  <Input value={editForm.competition} onChange={e => setEditForm({ ...editForm, competition: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-competition" />
                </div>
                <div>
                  <Label className="text-afrocat-muted text-xs uppercase">Round</Label>
                  <Input value={editForm.round} onChange={e => setEditForm({ ...editForm, round: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-round" />
                </div>
              </div>
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Notes</Label>
                <Input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-edit-notes" />
              </div>
              <Button type="submit" disabled={editMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-submit-edit">
                {editMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!staffModal} onOpenChange={(v) => { if (!v) setStaffModal(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
            <DialogHeader><DialogTitle className="text-afrocat-text font-display">Assign Match Staff</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); staffMut.mutate(); }} className="space-y-3">
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Head Coach *</Label>
                <select value={staffForm.headCoachUserId} onChange={e => setStaffForm({ ...staffForm, headCoachUserId: e.target.value })} required className="w-full px-3 py-2 rounded-md bg-afrocat-white-5 border border-afrocat-border text-afrocat-text" data-testid="select-staff-headcoach">
                  <option value="">Select Head Coach</option>
                  {allUsers.filter((u: any) => u.role === "COACH" || u.roles?.includes("COACH") || u.role === "ADMIN").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Assistant Coach</Label>
                <select value={staffForm.assistantCoachUserId} onChange={e => setStaffForm({ ...staffForm, assistantCoachUserId: e.target.value })} className="w-full px-3 py-2 rounded-md bg-afrocat-white-5 border border-afrocat-border text-afrocat-text" data-testid="select-staff-assistant">
                  <option value="">None</option>
                  {allUsers.filter((u: any) => u.role === "COACH" || u.roles?.includes("COACH") || u.role === "ADMIN").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Medic</Label>
                <select value={staffForm.medicUserId} onChange={e => setStaffForm({ ...staffForm, medicUserId: e.target.value })} className="w-full px-3 py-2 rounded-md bg-afrocat-white-5 border border-afrocat-border text-afrocat-text" data-testid="select-staff-medic">
                  <option value="">None</option>
                  {allUsers.filter((u: any) => u.role === "MEDICAL" || u.roles?.includes("MEDICAL") || u.role === "ADMIN").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-afrocat-muted text-xs uppercase">Team Manager</Label>
                <select value={staffForm.teamManagerUserId} onChange={e => setStaffForm({ ...staffForm, teamManagerUserId: e.target.value })} className="w-full px-3 py-2 rounded-md bg-afrocat-white-5 border border-afrocat-border text-afrocat-text" data-testid="select-staff-manager">
                  <option value="">None</option>
                  {allUsers.filter((u: any) => u.role === "MANAGER" || u.roles?.includes("MANAGER") || u.role === "ADMIN").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={staffMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-submit-staff">
                {staffMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Staff Assignment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!o2bisModal} onOpenChange={(v) => { if (!v) setO2bisModal(null); }}>
          <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
            <DialogHeader><DialogTitle className="text-afrocat-text font-display">O2BIS — Missing Information</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-afrocat-gold-soft text-afrocat-gold">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm mb-2">The following information is missing:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {o2bisModal?.missing.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              </div>
              <p className="text-sm text-afrocat-muted">You can go back and fill in the missing information, or skip and generate the O2BIS with blank fields.</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                  onClick={() => setO2bisModal(null)}
                  data-testid="button-o2bis-goback"
                >
                  Go Back & Fill
                </Button>
                <Button
                  className="flex-1 bg-afrocat-teal hover:bg-afrocat-teal/80"
                  onClick={async () => {
                    if (o2bisModal) {
                      await downloadO2bisPdf(o2bisModal.matchId, true);
                      setO2bisModal(null);
                    }
                  }}
                  data-testid="button-o2bis-skip"
                >
                  <Download className="h-4 w-4 mr-1" /> Skip & Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!finalScoreModal} onOpenChange={(open) => !open && setFinalScoreModal(null)}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-md">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-gold">Enter Final Score</DialogTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-afrocat-muted text-sm">Home Score</Label>
                <Input
                  type="number"
                  min={0}
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                  value={finalScoreForm.homeScore}
                  onChange={e => setFinalScoreForm(p => ({ ...p, homeScore: Number(e.target.value) }))}
                  data-testid="input-final-home-score"
                />
              </div>
              <div>
                <Label className="text-afrocat-muted text-sm">Away Score</Label>
                <Input
                  type="number"
                  min={0}
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                  value={finalScoreForm.awayScore}
                  onChange={e => setFinalScoreForm(p => ({ ...p, awayScore: Number(e.target.value) }))}
                  data-testid="input-final-away-score"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                onClick={() => setFinalScoreModal(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-afrocat-gold hover:bg-afrocat-gold/80 text-black"
                onClick={() => finalScoreMut.mutate()}
                disabled={finalScoreMut.isPending}
                data-testid="button-submit-final-score"
              >
                {finalScoreMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trophy className="h-4 w-4 mr-1" />}
                Save Final Score
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!liberoModal} onOpenChange={(open) => !open && setLiberoModal(null)}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-md">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-gold">Libero Selection Required</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-afrocat-muted">
              Squad has {liberoModal?.totalSelected} players (14+). At least 2 players must be marked as liberos.
              Currently {liberoModal?.liberoCount || 0} libero(s) selected.
            </p>
            <p className="text-sm text-afrocat-muted">
              Would you like the system to auto-select 2 liberos?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                onClick={() => setLiberoModal(null)}
                data-testid="button-libero-match-goback"
              >
                Go Back
              </Button>
              <Button
                className="flex-1 bg-afrocat-teal hover:bg-afrocat-teal/80"
                onClick={handleAutoSelectLiberosMatch}
                disabled={liberoLoading}
                data-testid="button-libero-match-autoselect"
              >
                {liberoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Auto-Select
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
