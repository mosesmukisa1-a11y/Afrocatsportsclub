import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, Star, TrendingUp, Target, Zap, Award as AwardIcon, Medal, Calendar, BarChart3, Flame, Shield, Users, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";

const AWARD_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  MVP:           { label: "Club MVP",       icon: Trophy,    color: "text-afrocat-gold",   bg: "bg-afrocat-gold-soft border-afrocat-gold/30" },
  MATCH_MVP:     { label: "Match MVP",      icon: Star,      color: "text-afrocat-gold",   bg: "bg-afrocat-gold-soft border-afrocat-gold/30" },
  MOST_IMPROVED: { label: "Most Improved",  icon: TrendingUp, color: "text-afrocat-teal",  bg: "bg-afrocat-teal-soft border-afrocat-teal/30" },
  BEST_SERVER:   { label: "Best Server",    icon: Zap,       color: "text-blue-400",       bg: "bg-blue-950 border-blue-500/30" },
  BEST_BLOCKER:  { label: "Best Blocker",   icon: Target,    color: "text-purple-400",     bg: "bg-purple-950 border-purple-500/30" },
  COACH_AWARD:   { label: "Coach's Award",  icon: Medal,     color: "text-afrocat-green",  bg: "bg-afrocat-green-soft border-afrocat-green/30" },
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function PlayerAvatar({ name, photoUrl, size = "md", highlight = "gold" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg"; highlight?: string }) {
  const dims = size === "sm" ? "w-8 h-8 text-[10px]" : size === "lg" ? "w-14 h-14 text-base" : "w-11 h-11 text-xs";
  const ring = highlight === "gold" ? "ring-2 ring-afrocat-gold" : highlight === "teal" ? "ring-2 ring-afrocat-teal" : "";
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${dims} rounded-full object-cover ${ring}`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-afrocat-white-10 flex items-center justify-center font-black text-afrocat-muted ${ring}`}>
      {getInitials(name || "?")}
    </div>
  );
}

type AwardTab = "match-mvps" | "leaders" | "club-awards" | "team-of-week" | "mvp-cards";

const STAT_CATEGORIES = [
  { key: "topScorers",  label: "Top Scorers",   icon: Flame,     statKey: "pointsTotal",   unit: "pts",   color: "text-afrocat-gold",    desc: "Total points scored" },
  { key: "topAcers",   label: "Best Servers",   icon: Zap,       statKey: "servesAce",     unit: "aces",  color: "text-blue-400",        desc: "Service aces" },
  { key: "topKillers", label: "Attack Leaders", icon: Target,    statKey: "spikesKill",    unit: "kills", color: "text-afrocat-red",     desc: "Spike kills" },
  { key: "topBlockers",label: "Best Blockers",  icon: Shield,    statKey: "blocksTotal",   unit: "blks",  color: "text-purple-400",      desc: "Total blocks" },
  { key: "topDiggers", label: "Best Liberos",   icon: TrendingUp,statKey: "digs",          unit: "digs",  color: "text-afrocat-teal",    desc: "Defensive digs" },
  { key: "topSetters", label: "Best Setters",   icon: BarChart3, statKey: "settingAssist", unit: "sets",  color: "text-afrocat-green",   desc: "Setting assists" },
];

export default function Awards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AwardTab>("match-mvps");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ playerId: "", awardType: "MVP", awardMonth: "", notes: "" });

  const { data: matchMvps = [], isLoading: mvpLoading } = useQuery({
    queryKey: ["/api/awards/match-mvps"],
    queryFn: api.getMatchMvps,
  });
  const { data: awards = [], isLoading: awardsLoading } = useQuery({
    queryKey: ["/api/awards"],
    queryFn: api.getAwards,
  });
  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ["/api/awards/leaderboard"],
    queryFn: api.getAwardsLeaderboard,
  });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: teamOfWeek, isLoading: towLoading } = useQuery({
    queryKey: ["/api/awards/team-of-week"],
    queryFn: api.getTeamOfWeek,
    enabled: tab === "team-of-week" || tab === "mvp-cards",
  });

  const clubAwards = (awards as any[]).filter((a: any) => a.awardType !== "MATCH_MVP");
  const sortedPlayers = [...players].sort((a: any, b: any) =>
    (a.fullName || `${a.firstName} ${a.lastName}`).localeCompare(b.fullName || `${b.firstName} ${b.lastName}`)
  );

  const createMut = useMutation({
    mutationFn: () => api.createAward(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/awards"] });
      setOpen(false);
      setForm({ playerId: "", awardType: "MVP", awardMonth: "", notes: "" });
      toast({ title: "Award granted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalMvps = (matchMvps as any[]).length;
  const uniqueMvpPlayers = new Set((matchMvps as any[]).map((m: any) => m.playerId)).size;
  const mostMvps = (() => {
    const counts: Record<string, { name: string; count: number; photo?: string }> = {};
    (matchMvps as any[]).forEach((m: any) => {
      if (!counts[m.playerId]) counts[m.playerId] = { name: m.playerName, count: 0, photo: m.playerPhotoUrl };
      counts[m.playerId].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count)[0] || null;
  })();

  const totalStats = (leaderboard?.allStats || []).reduce((acc: any, s: any) => ({
    matches: acc.matches + s.matchesPlayed,
    points: acc.points + s.pointsTotal,
    aces:   acc.aces   + s.servesAce,
    kills:  acc.kills  + s.spikesKill,
  }), { matches: 0, points: 0, aces: 0, kills: 0 });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-afrocat-gold-soft flex items-center justify-center">
              <Trophy className="h-5 w-5 text-afrocat-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-awards-title">
                Awards & Honours
              </h1>
              <p className="text-afrocat-muted text-sm">Recognising outstanding performance at Afrocat</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-award" className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white">
                <Plus className="mr-2 h-4 w-4" /> Grant Award
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-afrocat-card border-afrocat-border">
              <DialogHeader>
                <DialogTitle className="text-afrocat-text flex items-center gap-2">
                  <AwardIcon size={18} className="text-afrocat-gold" /> Grant Club Award
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Player</Label>
                  <Select value={form.playerId} onValueChange={v => setForm({ ...form, playerId: v })}>
                    <SelectTrigger className="bg-afrocat-bg border-afrocat-border text-afrocat-text" data-testid="select-award-player">
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {sortedPlayers.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.fullName || `${p.firstName} ${p.lastName}`}
                          {p.position ? ` — ${p.position}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Award Type</Label>
                  <Select value={form.awardType} onValueChange={v => setForm({ ...form, awardType: v })}>
                    <SelectTrigger className="bg-afrocat-bg border-afrocat-border text-afrocat-text" data-testid="select-award-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AWARD_LABELS).filter(([k]) => k !== "MATCH_MVP").map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Month</Label>
                  <Input
                    type="month"
                    value={form.awardMonth}
                    onChange={e => setForm({ ...form, awardMonth: e.target.value })}
                    required
                    className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                    data-testid="input-award-month"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Notes (optional)</Label>
                  <Input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Reason for award..."
                    className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                    data-testid="input-award-notes"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createMut.isPending || !form.playerId || !form.awardMonth}
                  className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
                  data-testid="button-submit-award"
                >
                  {createMut.isPending ? "Granting..." : "Grant Award"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary stat bar — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="afrocat-card p-4 text-center" data-testid="stat-total-mvps">
            <div className="text-2xl font-black text-afrocat-gold">{totalMvps}</div>
            <div className="text-xs text-afrocat-muted mt-0.5">Match MVPs</div>
          </div>
          <div className="afrocat-card p-4 text-center" data-testid="stat-club-awards">
            <div className="text-2xl font-black text-afrocat-teal">{clubAwards.length}</div>
            <div className="text-xs text-afrocat-muted mt-0.5">Club Awards</div>
          </div>
          <div className="afrocat-card p-4 text-center" data-testid="stat-matches-played">
            <div className="text-2xl font-black text-afrocat-text">{totalStats.matches}</div>
            <div className="text-xs text-afrocat-muted mt-0.5">Matches Tracked</div>
          </div>
          <div className="afrocat-card p-4 text-center" data-testid="stat-total-points">
            <div className="text-2xl font-black text-blue-400">{totalStats.points}</div>
            <div className="text-xs text-afrocat-muted mt-0.5">Points Scored</div>
          </div>
        </div>

        {/* Top MVP highlight — show when there's a clear leader */}
        {mostMvps && mostMvps.count > 1 && (
          <div className="afrocat-card p-4 flex items-center gap-4 border border-afrocat-gold/30 bg-afrocat-gold-soft">
            <PlayerAvatar name={mostMvps.name} photoUrl={mostMvps.photo} size="lg" highlight="gold" />
            <div>
              <div className="text-[10px] font-bold text-afrocat-gold uppercase tracking-widest mb-0.5">Most Valuable Player</div>
              <div className="font-black text-lg text-afrocat-text">{mostMvps.name}</div>
              <div className="text-xs text-afrocat-muted">{mostMvps.count} Match MVP {mostMvps.count === 1 ? "award" : "awards"} · {uniqueMvpPlayers} players honoured</div>
            </div>
            <Trophy className="ml-auto h-8 w-8 text-afrocat-gold opacity-60 shrink-0" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-afrocat-border overflow-x-auto">
          {[
            { key: "match-mvps"   as AwardTab, label: `Match MVPs (${totalMvps})`,         icon: Star },
            { key: "leaders"      as AwardTab, label: "Stats Leaders",                      icon: BarChart3 },
            { key: "club-awards"  as AwardTab, label: `Club Awards (${clubAwards.length})`, icon: Trophy },
            { key: "team-of-week" as AwardTab, label: "Team of the Week",                   icon: Users },
            { key: "mvp-cards"    as AwardTab, label: "MVP Cards",                          icon: Medal },
          ].map(t => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                tab === t.key
                  ? "border-afrocat-gold text-afrocat-gold"
                  : "border-transparent text-afrocat-muted hover:text-afrocat-text"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── MATCH MVPs ── */}
        {tab === "match-mvps" && (
          <>
            {mvpLoading ? (
              <div className="text-center py-10 text-afrocat-muted">Loading MVPs…</div>
            ) : (matchMvps as any[]).length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Star className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="font-semibold text-afrocat-text">No Match MVPs yet</p>
                <p className="text-xs text-afrocat-muted max-w-sm mx-auto">
                  MVPs are auto-awarded when a match is finalised in the Touch Stats system, or when a coach selects the Player of the Match.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(matchMvps as any[]).map((mvp: any) => (
                  <div
                    key={mvp.id}
                    className="afrocat-card p-5 border-l-4 border-l-afrocat-gold relative overflow-hidden"
                    data-testid={`card-mvp-${mvp.id}`}
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      {mvp.derived && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border">
                          POTM
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-afrocat-gold text-black">
                        <Star size={9} className="fill-black" /> MVP
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <PlayerAvatar name={mvp.playerName || "?"} photoUrl={mvp.playerPhotoUrl} size="md" highlight="gold" />
                      <div>
                        <div className="font-bold text-afrocat-text" data-testid={`text-mvp-name-${mvp.id}`}>
                          {mvp.playerName}
                        </div>
                        <div className="text-xs text-afrocat-muted">
                          #{mvp.playerJersey} &bull; {mvp.playerPosition}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {mvp.matchOpponent && (
                        <div className="flex items-center gap-2 text-afrocat-text">
                          <Trophy size={12} className="text-afrocat-gold shrink-0" />
                          <span className="font-medium">vs {mvp.matchOpponent}</span>
                          {mvp.matchResult && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${mvp.matchResult === "W" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                              {mvp.matchResult === "W" ? "WIN" : "LOSS"}
                              {mvp.matchSets && mvp.matchSets !== "0-0" ? ` ${mvp.matchSets}` : ""}
                            </Badge>
                          )}
                        </div>
                      )}
                      {mvp.matchDate && (
                        <div className="flex items-center gap-2 text-afrocat-muted text-xs">
                          <Calendar size={11} className="shrink-0" />
                          {mvp.matchDate}
                          {mvp.matchCompetition && ` — ${mvp.matchCompetition}`}
                        </div>
                      )}
                      {mvp.notes && mvp.notes !== "Player of the Match" && (
                        <p className="text-xs text-afrocat-muted italic mt-1">{mvp.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STATS LEADERS ── */}
        {tab === "leaders" && (
          <>
            {lbLoading ? (
              <div className="text-center py-10 text-afrocat-muted">Loading stats…</div>
            ) : !leaderboard || (leaderboard.allStats || []).length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <BarChart3 className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="font-semibold text-afrocat-text">No match stats recorded yet</p>
                <p className="text-xs text-afrocat-muted max-w-sm mx-auto">
                  Stats are captured during matches via the Touch Stats system. Play and record matches to populate the leaderboard.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Category leader cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {STAT_CATEGORIES.map(cat => {
                    const list: any[] = leaderboard[cat.key] || [];
                    const leader = list[0];
                    if (!leader || leader[cat.statKey] === 0) return null;
                    const Icon = cat.icon;
                    return (
                      <div
                        key={cat.key}
                        className="afrocat-card p-5 space-y-4"
                        data-testid={`card-leader-${cat.key}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={cat.color} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${cat.color}`}>{cat.label}</span>
                        </div>

                        {/* Top player highlight */}
                        <div className="flex items-center gap-3">
                          <PlayerAvatar name={leader.playerName} photoUrl={leader.playerPhotoUrl} size="lg" highlight={cat.color.includes("gold") ? "gold" : "teal"} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-afrocat-text truncate" data-testid={`text-leader-name-${cat.key}`}>
                              {leader.playerName}
                            </div>
                            <div className="text-xs text-afrocat-muted">#{leader.playerJersey} · {leader.playerPosition}</div>
                            <div className={`text-lg font-black ${cat.color}`}>
                              {leader[cat.statKey]} <span className="text-xs font-normal text-afrocat-muted">{cat.unit}</span>
                            </div>
                          </div>
                          <Trophy size={20} className={`${cat.color} opacity-50 shrink-0`} />
                        </div>

                        {/* Runner-up list */}
                        {list.slice(1).filter((p: any) => p[cat.statKey] > 0).map((p: any, i: number) => (
                          <div key={p.playerId} className="flex items-center gap-2 text-sm" data-testid={`row-leader-${cat.key}-${i + 2}`}>
                            <span className="text-xs text-afrocat-muted w-4 text-right shrink-0">{i + 2}.</span>
                            <PlayerAvatar name={p.playerName} photoUrl={p.playerPhotoUrl} size="sm" highlight="none" />
                            <span className="text-afrocat-text flex-1 truncate text-xs">{p.playerName}</span>
                            <span className={`text-xs font-bold ${cat.color}`}>{p[cat.statKey]} {cat.unit}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }).filter(Boolean)}
                </div>

                {/* Full stats table */}
                {leaderboard.allStats?.length > 0 && (
                  <div className="afrocat-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-afrocat-border">
                      <h3 className="font-bold text-afrocat-text text-sm flex items-center gap-2">
                        <BarChart3 size={14} className="text-afrocat-teal" /> Full Player Stats
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-afrocat-border">
                            <th className="text-left px-4 py-2.5 text-afrocat-muted font-semibold">Player</th>
                            <th className="text-center px-3 py-2.5 text-afrocat-muted font-semibold">MP</th>
                            <th className="text-center px-3 py-2.5 text-afrocat-gold font-semibold">PTS</th>
                            <th className="text-center px-3 py-2.5 text-blue-400 font-semibold">ACE</th>
                            <th className="text-center px-3 py-2.5 text-afrocat-red font-semibold">KIL</th>
                            <th className="text-center px-3 py-2.5 text-purple-400 font-semibold">BLK</th>
                            <th className="text-center px-3 py-2.5 text-afrocat-teal font-semibold">DIG</th>
                            <th className="text-center px-3 py-2.5 text-afrocat-green font-semibold">AST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.allStats.map((s: any, i: number) => (
                            <tr key={s.playerId} className={`border-b border-afrocat-border/50 hover:bg-afrocat-white-3 ${i === 0 ? "bg-afrocat-gold-soft/30" : ""}`} data-testid={`row-stats-${s.playerId}`}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {i === 0 && <Trophy size={10} className="text-afrocat-gold shrink-0" />}
                                  <PlayerAvatar name={s.playerName} photoUrl={s.playerPhotoUrl} size="sm" highlight="none" />
                                  <div>
                                    <div className="font-medium text-afrocat-text">{s.playerName}</div>
                                    <div className="text-afrocat-muted">#{s.playerJersey} · {s.playerPosition}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center px-3 py-2.5 text-afrocat-muted">{s.matchesPlayed}</td>
                              <td className="text-center px-3 py-2.5 font-bold text-afrocat-gold">{s.pointsTotal}</td>
                              <td className="text-center px-3 py-2.5 text-blue-400">{s.servesAce}</td>
                              <td className="text-center px-3 py-2.5 text-afrocat-red">{s.spikesKill}</td>
                              <td className="text-center px-3 py-2.5 text-purple-400">{s.blocksTotal}</td>
                              <td className="text-center px-3 py-2.5 text-afrocat-teal">{s.digs}</td>
                              <td className="text-center px-3 py-2.5 text-afrocat-green">{s.settingAssist}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── CLUB AWARDS ── */}
        {tab === "club-awards" && (
          <>
            {awardsLoading ? (
              <div className="text-center py-10 text-afrocat-muted">Loading awards…</div>
            ) : clubAwards.length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Trophy className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="font-semibold text-afrocat-text">No club awards granted yet</p>
                <p className="text-xs text-afrocat-muted">
                  Use the "Grant Award" button to recognise outstanding players with Club MVP, Coach's Award, Most Improved, and more.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {clubAwards.map((a: any) => {
                  const player = (players as any[]).find((p: any) => p.id === a.playerId);
                  const awardMeta = AWARD_LABELS[a.awardType] || AWARD_LABELS["MVP"];
                  const Icon = awardMeta.icon;
                  const playerName = player?.fullName || `${player?.firstName || ""} ${player?.lastName || ""}`.trim() || "Unknown Player";
                  return (
                    <div
                      key={a.id}
                      className={`afrocat-card p-5 border ${awardMeta.bg} relative overflow-hidden`}
                      data-testid={`card-award-${a.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${awardMeta.bg} flex items-center justify-center shrink-0 border ${awardMeta.bg}`}>
                          <Icon className={`h-5 w-5 ${awardMeta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-afrocat-text" data-testid={`text-award-player-${a.id}`}>
                              {playerName}
                            </h3>
                          </div>
                          <p className={`text-xs font-bold ${awardMeta.color} mt-0.5`} data-testid={`text-award-type-${a.id}`}>
                            {awardMeta.label}
                          </p>
                          <p className="text-xs text-afrocat-muted mt-1">{a.awardMonth}</p>
                          {a.notes && (
                            <p className="text-xs text-afrocat-muted mt-1 italic">{a.notes}</p>
                          )}
                        </div>
                        <PlayerAvatar name={playerName} photoUrl={player?.photoUrl} size="sm" highlight="none" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {/* ── TEAM OF THE WEEK ── */}
        {tab === "team-of-week" && (
          <div className="space-y-5">
            {towLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-afrocat-muted">
                <Loader2 className="animate-spin h-5 w-5" /> Building Team of the Week…
              </div>
            ) : !teamOfWeek || (teamOfWeek.players || []).length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Users className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="font-semibold text-afrocat-text">No match stats yet</p>
                <p className="text-xs text-afrocat-muted max-w-sm mx-auto">
                  Record match stats via Touch Stats to auto-generate the Team of the Week.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-display font-bold text-afrocat-text" data-testid="text-tow-title">
                      🏆 Team of the Week
                    </h2>
                    <p className="text-xs text-afrocat-muted mt-0.5">
                      {teamOfWeek.weekLabel} · {teamOfWeek.matchCount} match{teamOfWeek.matchCount !== 1 ? "es" : ""} analysed
                    </p>
                  </div>
                  <Badge className="bg-afrocat-teal/10 text-afrocat-teal border-afrocat-teal/30 text-xs">
                    {teamOfWeek.players.length} players selected
                  </Badge>
                </div>

                {/* Position formation display */}
                <div className="flex flex-wrap gap-5 justify-center" data-testid="grid-team-of-week">
                  {(teamOfWeek.players as any[]).map((p: any, i: number) => (
                    <div key={p.playerId} className="flex flex-col items-center" data-testid={`card-tow-player-${p.playerId}`}>
                      <PlayerCard
                        size="sm"
                        showDownload
                        data={{
                          playerName: p.playerName,
                          position: p.position || p.slot,
                          jerseyNo: p.jerseyNo,
                          photoUrl: p.photoUrl,
                          teamName: p.teamName || "Afrocat VC",
                          badge: p.slot === "L" ? "LIBERO" : p.slot === "S" ? "SETTER" : p.slot === "MB" ? "BLOCKER" : p.slot === "OPP" ? "OPPOSITE" : "TEAM OF WEEK",
                          badgeColor: i === 0 ? "gold" : i < 3 ? "teal" : "gold",
                          matchLabel: teamOfWeek.weekLabel,
                          stats: p.stats,
                          stars: p.stars,
                        }}
                      />
                      <div className="mt-2 text-[10px] font-bold text-afrocat-muted uppercase tracking-wider">
                        {p.slot === "OH" ? "Outside Hitter" : p.slot === "MB" ? "Middle Blocker" : p.slot === "OPP" ? "Opposite" : p.slot === "S" ? "Setter" : p.slot === "L" ? "Libero" : p.slot}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Download all button */}
                <div className="flex justify-center pt-2">
                  <p className="text-xs text-afrocat-muted">Click "Download Card" under each player to save their FIFA-style card as JPEG.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MVP CARDS ── */}
        {tab === "mvp-cards" && (
          <div className="space-y-5">
            {(mvpLoading || towLoading) ? (
              <div className="flex items-center justify-center py-20 gap-3 text-afrocat-muted">
                <Loader2 className="animate-spin h-5 w-5" /> Loading MVP cards…
              </div>
            ) : (matchMvps as any[]).length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Medal className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="font-semibold text-afrocat-text">No Match MVPs yet</p>
                <p className="text-xs text-afrocat-muted max-w-sm mx-auto">
                  Complete matches in Touch Stats to generate MVP cards.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-display font-bold text-afrocat-text">
                      🥇 MVP Player Cards
                    </h2>
                    <p className="text-xs text-afrocat-muted mt-0.5">
                      Download FIFA-style cards for each Match MVP
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 justify-center" data-testid="grid-mvp-cards">
                  {(matchMvps as any[]).map((mvp: any) => (
                    <div key={mvp.id} className="flex flex-col items-center gap-1" data-testid={`card-mvp-card-${mvp.id}`}>
                      <PlayerCard
                        size="sm"
                        showDownload
                        data={{
                          playerName: mvp.playerName || "Player",
                          position: mvp.playerPosition || "",
                          jerseyNo: mvp.playerJersey,
                          photoUrl: mvp.playerPhotoUrl,
                          teamName: mvp.teamName || "Afrocat VC",
                          badge: "MATCH MVP",
                          badgeColor: "gold",
                          matchLabel: mvp.matchOpponent ? `vs ${mvp.matchOpponent}` : undefined,
                          matchDate: mvp.matchDateFormatted || mvp.matchDate || undefined,
                          stats: mvp.matchStats || { kills: 0, aces: 0, blocks: 0, digs: 0, assists: 0, matches: 1 },
                          stars: mvp.stars || { atk: 3, srv: 3, def: 3, blk: 3 },
                        }}
                      />
                      <div className="text-[10px] text-afrocat-muted text-center">
                        {mvp.matchDateFormatted || mvp.matchDate || ""}
                        {mvp.matchOpponent ? ` · vs ${mvp.matchOpponent}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
