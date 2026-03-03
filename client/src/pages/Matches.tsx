import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Users, Clock, Lock, Loader2, Trophy, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { SquadSelector } from "@/components/SquadSelector";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  UPCOMING: { bg: "bg-afrocat-teal-soft", text: "text-afrocat-teal", label: "Upcoming" },
  SCHEDULED: { bg: "bg-afrocat-white-10", text: "text-afrocat-muted", label: "Scheduled" },
  LIVE: { bg: "bg-afrocat-red-soft", text: "text-afrocat-red", label: "Live" },
  PLAYED: { bg: "bg-afrocat-green-soft", text: "text-afrocat-green", label: "Played" },
  CANCELLED: { bg: "bg-afrocat-red-soft", text: "text-afrocat-red", label: "Cancelled" },
};

export default function Matches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: matches = [], isLoading } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    teamId: "", opponent: "", matchDate: "", startTime: "",
    venue: "Home", competition: "", result: "" as string,
    setsFor: 0, setsAgainst: 0,
  });
  const [squadMatchId, setSquadMatchId] = useState<string | null>(null);
  const [squadTeamId, setSquadTeamId] = useState<string | null>(null);
  const [scoreModal, setScoreModal] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState({ homeScore: 0, awayScore: 0, result: "" });
  const [setStatsModal, setSetStatsModal] = useState<string | null>(null);
  const [setsInput, setSetsInput] = useState<Array<{ homePoints: number; awayPoints: number }>>([
    { homePoints: 0, awayPoints: 0 },
    { homePoints: 0, awayPoints: 0 },
    { homePoints: 0, awayPoints: 0 },
  ]);

  const isFuture = (dateStr: string, startTimeStr?: string) => {
    if (startTimeStr) return new Date(startTimeStr) > new Date();
    return new Date(dateStr) > new Date();
  };

  const createMut = useMutation({
    mutationFn: () => {
      const startTimeISO = form.startTime ? new Date(`${form.matchDate}T${form.startTime}`).toISOString() : undefined;
      const isFutureMatch = startTimeISO ? new Date(startTimeISO) > new Date() : new Date(form.matchDate) > new Date();
      return api.createMatch({
        ...form,
        startTime: startTimeISO,
        result: isFutureMatch ? null : (form.result || null),
        setsFor: isFutureMatch ? 0 : Number(form.setsFor),
        setsAgainst: isFutureMatch ? 0 : Number(form.setsAgainst),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setOpen(false);
      setForm({ teamId: "", opponent: "", matchDate: "", startTime: "", venue: "Home", competition: "", result: "", setsFor: 0, setsAgainst: 0 });
      toast({ title: "Match created" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setScoreModal(null);
      toast({ title: "Score saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setStatsMut = useMutation({
    mutationFn: () => api.submitMatchSetStats(setStatsModal!, { sets: setsInput }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setSetStatsModal(null);
      toast({ title: "Set stats & score saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canCreate = user && ["ADMIN", "MANAGER", "COACH", "STATISTICIAN"].includes(user.role);
  const canSelectSquad = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);
  const canScore = user && ["ADMIN", "MANAGER", "COACH", "STATISTICIAN"].includes(user.role);

  const formIsFuture = form.startTime
    ? new Date(`${form.matchDate}T${form.startTime}`) > new Date()
    : form.matchDate ? new Date(form.matchDate) > new Date() : false;

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

                  {!formIsFuture && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-afrocat-muted text-xs uppercase">Result</Label>
                        <Select value={form.result} onValueChange={v => setForm({ ...form, result: v })}>
                          <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="W">Win</SelectItem>
                            <SelectItem value="L">Loss</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-afrocat-muted text-xs uppercase">Sets For</Label>
                        <Input type="number" value={form.setsFor} onChange={e => setForm({ ...form, setsFor: Number(e.target.value) })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-sets-for" />
                      </div>
                      <div>
                        <Label className="text-afrocat-muted text-xs uppercase">Sets Against</Label>
                        <Input type="number" value={form.setsAgainst} onChange={e => setForm({ ...form, setsAgainst: Number(e.target.value) })} className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-sets-against" />
                      </div>
                    </div>
                  )}

                  {formIsFuture && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-afrocat-teal-soft text-afrocat-teal text-sm">
                      <Clock className="h-4 w-4" />
                      <span>This match is in the future — it will be marked as <strong>UPCOMING</strong>. Score fields are hidden.</span>
                    </div>
                  )}

                  <Button type="submit" disabled={createMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-submit-match">
                    {createMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create Match"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-afrocat-muted">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="afrocat-card py-10 text-center text-afrocat-muted" data-testid="text-no-matches">No matches scheduled yet.</div>
        ) : (
          <div className="space-y-4">
            {matches.map((match: any) => {
              const team = teams.find((t: any) => t.id === match.teamId);
              const isWin = match.result === "W";
              const showingSquad = squadMatchId === match.id && squadTeamId === match.teamId;
              const statusStyle = STATUS_STYLES[match.status] || STATUS_STYLES.SCHEDULED;
              const matchIsPast = match.startTime ? new Date(match.startTime) < new Date() : new Date(match.matchDate) < new Date();
              const canEnterScore = canScore && matchIsPast && !match.statsEntered && !match.scoreLocked;
              const isScoreLocked = match.scoreLocked || match.statsEntered;

              return (
                <div key={match.id} className="afrocat-card overflow-hidden" data-testid={`card-match-${match.id}`}>
                  <div className="flex flex-col md:flex-row">
                    <div className={`w-full md:w-2 ${match.result ? (isWin ? 'bg-afrocat-green' : 'bg-afrocat-red') : match.status === 'UPCOMING' ? 'bg-afrocat-teal' : 'bg-afrocat-white-10'} h-1.5 md:h-auto`} />
                    <div className="flex-1 p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3 text-sm text-afrocat-muted flex-wrap">
                            <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0 font-bold text-xs`} data-testid={`badge-status-${match.id}`}>
                              {statusStyle.label}
                            </Badge>
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
                            <div className="px-4 py-2 bg-afrocat-white-5 rounded-lg flex items-center justify-center min-w-[100px] border border-afrocat-border">
                              <span className="text-2xl font-bold font-display text-afrocat-text">{match.homeScore ?? match.setsFor ?? 0}</span>
                              <span className="mx-2 text-afrocat-muted">-</span>
                              <span className="text-2xl font-bold font-display text-afrocat-text">{match.awayScore ?? match.setsAgainst ?? 0}</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold font-display text-afrocat-text">{match.opponent}</h3>
                            </div>
                          </div>

                          {isScoreLocked && (
                            <div className="flex items-center gap-2 text-xs text-afrocat-muted">
                              <Lock className="h-3 w-3" />
                              <span>Score Locked {match.scoreSource === "STATS" ? "(From Stats)" : match.scoreSource === "MANUAL" ? "(Manual)" : ""}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          {canEnterScore && (
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
                                  setSetStatsModal(match.id);
                                  setSetsInput([
                                    { homePoints: 0, awayPoints: 0 },
                                    { homePoints: 0, awayPoints: 0 },
                                    { homePoints: 0, awayPoints: 0 },
                                  ]);
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
            })}
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
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Auto-detect from score" /></SelectTrigger>
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
                      <Button size="sm" variant="ghost" className="text-afrocat-red h-8 w-8 p-0" onClick={() => setSetsInput(setsInput.filter((_, j) => j !== i))}>×</Button>
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
                <span>Score will be computed from sets and locked. Manual editing will be blocked.</span>
              </div>
              <Button
                onClick={() => setStatsMut.mutate()}
                disabled={setStatsMut.isPending}
                className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80"
                data-testid="button-submit-sets"
              >
                {setStatsMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Sets & Lock Score"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
