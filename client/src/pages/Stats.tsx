import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Minus, Trophy, AlertTriangle, CheckCircle2, Zap, Shield, Target, Hand, ArrowUpCircle, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import logo from "@assets/afrocate_logo_1772226294597.png";


type StatKey = "spikesKill" | "spikesError" | "servesAce" | "servesError" | "blocksSolo" | "blocksAssist" | "receivePerfect" | "receiveError" | "digs" | "settingAssist" | "settingError";

const statCategories = [
  {
    label: "Attack",
    icon: Zap,
    color: "text-afrocat-gold",
    bgColor: "bg-afrocat-gold-soft",
    borderColor: "border-afrocat-gold/20",
    fields: [
      { key: "spikesKill" as StatKey, label: "Kills" },
      { key: "spikesError" as StatKey, label: "Errors" },
    ],
  },
  {
    label: "Serve",
    icon: Target,
    color: "text-afrocat-teal",
    bgColor: "bg-afrocat-teal-soft",
    borderColor: "border-afrocat-teal/20",
    fields: [
      { key: "servesAce" as StatKey, label: "Aces" },
      { key: "servesError" as StatKey, label: "Errors" },
    ],
  },
  {
    label: "Block",
    icon: Shield,
    color: "text-afrocat-gold",
    bgColor: "bg-afrocat-gold-soft",
    borderColor: "border-afrocat-gold/20",
    fields: [
      { key: "blocksSolo" as StatKey, label: "Solo" },
      { key: "blocksAssist" as StatKey, label: "Assist" },
    ],
  },
  {
    label: "Receive",
    icon: Hand,
    color: "text-afrocat-green",
    bgColor: "bg-afrocat-green-soft",
    borderColor: "border-afrocat-green/20",
    fields: [
      { key: "receivePerfect" as StatKey, label: "Perfect" },
      { key: "receiveError" as StatKey, label: "Errors" },
    ],
  },
  {
    label: "Defense",
    icon: Shield,
    color: "text-afrocat-teal",
    bgColor: "bg-afrocat-teal-soft",
    borderColor: "border-afrocat-teal/20",
    fields: [
      { key: "digs" as StatKey, label: "Digs" },
    ],
  },
  {
    label: "Setting",
    icon: ArrowUpCircle,
    color: "text-afrocat-gold",
    bgColor: "bg-afrocat-gold-soft",
    borderColor: "border-afrocat-gold/20",
    fields: [
      { key: "settingAssist" as StatKey, label: "Assists" },
      { key: "settingError" as StatKey, label: "Errors" },
    ],
  },
];

const allStatKeys: StatKey[] = [
  "spikesKill", "spikesError", "servesAce", "servesError",
  "blocksSolo", "blocksAssist", "receivePerfect", "receiveError",
  "digs", "settingAssist", "settingError",
];

function computePoints(s: Record<string, number>): number {
  return (
    ((s.spikesKill || 0) * 2) +
    ((s.servesAce || 0) * 2) +
    ((s.blocksSolo || 0) * 2) +
    (s.blocksAssist || 0) +
    (s.digs || 0) +
    (s.settingAssist || 0) -
    ((s.spikesError || 0) * 2) -
    ((s.servesError || 0) * 2) -
    ((s.receiveError || 0) * 2) -
    ((s.settingError || 0) * 2)
  );
}

function computeErrors(s: Record<string, number>): number {
  return (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0);
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

function PlayerStatCard({
  player,
  stats,
  onIncrement,
  onDecrement,
}: {
  player: any;
  stats: Record<string, number>;
  onIncrement: (key: StatKey) => void;
  onDecrement: (key: StatKey) => void;
}) {
  const points = computePoints(stats);
  const errors = computeErrors(stats);

  return (
    <div className="afrocat-card overflow-hidden hover:border-afrocat-teal/30 transition-all duration-200" data-testid={`card-player-${player.id}`}>
      <div className="bg-afrocat-white-3 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {player.photoUrl ? (
              <img
                src={player.photoUrl}
                alt={`${player.firstName} ${player.lastName}`}
                className="w-14 h-14 rounded-full object-cover border-2 border-afrocat-teal/20"
                data-testid={`img-player-photo-${player.id}`}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full bg-afrocat-white-5 flex items-center justify-center border-2 border-afrocat-teal/20 text-lg font-bold text-afrocat-muted"
                data-testid={`img-player-avatar-${player.id}`}
              >
                {getInitials(player.firstName, player.lastName)}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-afrocat-teal text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-afrocat-card" data-testid={`badge-jersey-${player.id}`}>
              {player.jerseyNo}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm truncate text-afrocat-text" data-testid={`text-player-name-${player.id}`}>
              {player.firstName} {player.lastName}
            </h3>
            <span className="inline-block text-[10px] mt-0.5 px-2 py-0.5 rounded-full bg-afrocat-white-10 text-afrocat-muted font-medium" data-testid={`badge-position-${player.id}`}>
              {player.position}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${points >= 0 ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`} data-testid={`text-points-${player.id}`}>
            <Trophy className="w-3 h-3" />
            {points} pts
          </div>
          {errors > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-afrocat-red-soft text-afrocat-red" data-testid={`text-errors-${player.id}`}>
              <AlertTriangle className="w-3 h-3" />
              {errors} err
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {statCategories.map((cat) => (
          <div key={cat.label} className={`rounded-lg p-2 ${cat.bgColor} border ${cat.borderColor}`}>
            <div className={`flex items-center gap-1 mb-1.5 ${cat.color}`}>
              <cat.icon className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-1 bg-afrocat-white-10 rounded-md px-1.5 py-0.5">
                  <button
                    onClick={() => onDecrement(f.key)}
                    className="w-5 h-5 rounded flex items-center justify-center text-afrocat-muted hover:bg-afrocat-white-10 transition-colors"
                    data-testid={`button-dec-${f.key}-${player.id}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <div className="text-center min-w-[28px]">
                    <span className="text-xs font-bold" data-testid={`text-stat-${f.key}-${player.id}`}>{stats[f.key] || 0}</span>
                    <div className="text-[8px] text-afrocat-muted leading-none">{f.label}</div>
                  </div>
                  <button
                    onClick={() => onIncrement(f.key)}
                    className="w-5 h-5 rounded flex items-center justify-center text-afrocat-teal hover:bg-afrocat-teal-soft transition-colors"
                    data-testid={`button-inc-${f.key}-${player.id}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Stats() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: coachAssignments = [] } = useQuery({ queryKey: ["/api/coach-assignments"], queryFn: api.getCoachAssignments });

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [statsData, setStatsData] = useState<Record<string, Record<string, number>>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);
  const selectedTeam = teams.find((t: any) => t.id === selectedMatch?.teamId);

  const coachName = useMemo(() => {
    if (!selectedMatch?.teamId) return "";
    const assignment = coachAssignments.find(
      (ca: any) => ca.teamId === selectedMatch.teamId && ca.active
    );
    if (!assignment) return "";
    return "Assigned";
  }, [selectedMatch?.teamId, coachAssignments]);

  const { data: matchPlayers = [] } = useQuery({
    queryKey: ["/api/players/team", selectedMatch?.teamId],
    queryFn: () => api.getPlayersByTeam(selectedMatch!.teamId),
    enabled: !!selectedMatch?.teamId,
  });

  const { data: existingStats = [] } = useQuery({
    queryKey: ["/api/stats/match", selectedMatchId],
    queryFn: () => api.getStatsByMatch(selectedMatchId),
    enabled: !!selectedMatchId,
  });

  useEffect(() => {
    if (existingStats.length > 0 && matchPlayers.length > 0) {
      const loaded: Record<string, Record<string, number>> = {};
      existingStats.forEach((s: any) => {
        loaded[s.playerId] = {};
        allStatKeys.forEach((k) => {
          loaded[s.playerId][k] = s[k] || 0;
        });
      });
      setStatsData(loaded);
    } else if (matchPlayers.length > 0 && existingStats.length === 0) {
      const empty: Record<string, Record<string, number>> = {};
      matchPlayers.forEach((p: any) => {
        empty[p.id] = {};
        allStatKeys.forEach((k) => { empty[p.id][k] = 0; });
      });
      setStatsData(empty);
    }
  }, [existingStats, matchPlayers]);

  const handleIncrement = useCallback((playerId: string, key: StatKey) => {
    hasUserEdited.current = true;
    setStatsData((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: (prev[playerId]?.[key] || 0) + 1 },
    }));
  }, []);

  const handleDecrement = useCallback((playerId: string, key: StatKey) => {
    hasUserEdited.current = true;
    setStatsData((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: Math.max(0, (prev[playerId]?.[key] || 0) - 1) },
    }));
  }, []);

  const handleReset = useCallback(() => {
    const empty: Record<string, Record<string, number>> = {};
    matchPlayers.forEach((p: any) => {
      empty[p.id] = {};
      allStatKeys.forEach((k) => { empty[p.id][k] = 0; });
    });
    setStatsData(empty);
    setShowSummary(false);
    setSummaryData(null);
  }, [matchPlayers]);

  const teamTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    allStatKeys.forEach((k) => { totals[k] = 0; });
    totals.pointsTotal = 0;
    totals.errorsTotal = 0;
    Object.values(statsData).forEach((s) => {
      allStatKeys.forEach((k) => { totals[k] += s[k] || 0; });
      totals.pointsTotal += computePoints(s);
      totals.errorsTotal += computeErrors(s);
    });
    return totals;
  }, [statsData]);

  const topPerformers = useMemo(() => {
    return matchPlayers
      .map((p: any) => ({
        ...p,
        points: computePoints(statsData[p.id] || {}),
        errors: computeErrors(statsData[p.id] || {}),
      }))
      .sort((a: any, b: any) => b.points - a.points)
      .slice(0, 5);
  }, [matchPlayers, statsData]);

  const buildPayload = useCallback(() => {
    return matchPlayers.map((p: any) => ({
      playerId: p.id,
      spikesKill: statsData[p.id]?.spikesKill || 0,
      spikesError: statsData[p.id]?.spikesError || 0,
      servesAce: statsData[p.id]?.servesAce || 0,
      servesError: statsData[p.id]?.servesError || 0,
      blocksSolo: statsData[p.id]?.blocksSolo || 0,
      blocksAssist: statsData[p.id]?.blocksAssist || 0,
      receivePerfect: statsData[p.id]?.receivePerfect || 0,
      receiveError: statsData[p.id]?.receiveError || 0,
      digs: statsData[p.id]?.digs || 0,
      settingAssist: statsData[p.id]?.settingAssist || 0,
      settingError: statsData[p.id]?.settingError || 0,
      minutesPlayed: statsData[p.id]?.minutesPlayed || 0,
    }));
  }, [matchPlayers, statsData]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUserEdited = useRef(false);

  const eligibleMatches = useMemo(() => {
    return matches.filter((m: any) => {
      if (m.status === "PLAYED" || m.status === "CANCELLED") return false;
      if (m.scoreLocked) return false;
      return true;
    });
  }, [matches]);

  useEffect(() => {
    if (!selectedMatchId || matchPlayers.length === 0 || !hasUserEdited.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus("idle");
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaveStatus("saving");
        await api.submitStats(selectedMatchId, buildPayload());
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [statsData, selectedMatchId, matchPlayers.length, buildPayload, queryClient]);

  const submitMut = useMutation({
    mutationFn: () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      return api.submitStats(selectedMatchId, buildPayload());
    },
    onSuccess: () => {
      toast({
        title: "Stats Saved Successfully!",
        description: "Smart Focus training recommendations have been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setAutoSaveStatus("saved");

      setSummaryData({
        teamTotals,
        topPerformers,
        smartFocusCount: matchPlayers.length,
      });
      setShowSummary(true);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const content = (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-afrocat-bg overflow-auto p-4 md:p-6" : ""}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Afrocat Logo" className="w-16 h-16 object-contain" data-testid="img-afrocat-logo" />
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-club-name">
                  AFROCAT VOLLEYBALL CLUB
                </h1>
                <p className="text-sm text-afrocat-muted italic mt-0.5" data-testid="text-motto">
                  One Team One Dream — Passion Discipline Victory
                </p>
                <p className="text-lg font-display font-semibold text-afrocat-teal mt-1" data-testid="text-page-title">
                  Enter Match Statistics
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-fullscreen-toggle"
            >
              {isFullscreen ? <><Minimize2 className="h-4 w-4 mr-1" /> Exit Fullscreen</> : <><Maximize2 className="h-4 w-4 mr-1" /> Fullscreen</>}
            </Button>
          </div>
        </div>

        <div className="afrocat-card">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border p-4 rounded-t-[18px]">
            <h3 className="text-base font-display font-bold text-afrocat-text">Match Selection</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Match</label>
                <Select value={selectedMatchId} onValueChange={(v) => { setSelectedMatchId(v); setShowSummary(false); setSummaryData(null); }}>
                  <SelectTrigger data-testid="select-match">
                    <SelectValue placeholder="Select a match" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMatches.length === 0 && (
                      <div className="px-3 py-2 text-xs text-afrocat-muted">No eligible matches available</div>
                    )}
                    {eligibleMatches.map((m: any) => {
                      const team = teams.find((t: any) => t.id === m.teamId);
                      const statusLabel = m.status === "UPCOMING" ? "Upcoming" : m.status === "LIVE" ? "Live" : m.status === "PAST_NO_SCORE" ? "Score Missing" : m.status;
                      return (
                        <SelectItem key={m.id} value={m.id} data-testid={`select-match-option-${m.id}`}>
                          {m.matchDate} — {team?.name || "?"} vs {m.opponent} ({statusLabel})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedMatch && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Team</label>
                    <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-team-name">
                      {selectedTeam?.name || "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Opponent</label>
                    <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-opponent">
                      {selectedMatch.opponent}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Competition</label>
                    <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-competition">
                      {selectedMatch.competition}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Venue</label>
                    <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-venue">
                      {selectedMatch.venue}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Date</label>
                    <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-match-date">
                      {selectedMatch.matchDate}
                    </div>
                  </div>
                  {coachName && (
                    <div>
                      <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Coach</label>
                      <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium" data-testid="text-coach-name">
                        {coachName}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {selectedMatchId && matchPlayers.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-bold" data-testid="text-player-count">
                  Player Stats ({matchPlayers.length} Players)
                </h2>
                <p className="text-xs text-afrocat-muted">
                  Use +/- buttons to record each stat. Points update live.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-afrocat-teal-soft font-bold text-afrocat-teal" data-testid="text-team-points-total">
                  <Trophy className="w-4 h-4" />
                  Team: {teamTotals.pointsTotal} pts
                </div>
                {teamTotals.errorsTotal > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-afrocat-red-soft font-bold text-afrocat-red" data-testid="text-team-errors-total">
                    <AlertTriangle className="w-4 h-4" />
                    {teamTotals.errorsTotal} errors
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {matchPlayers.map((player: any) => (
                <PlayerStatCard
                  key={player.id}
                  player={player}
                  stats={statsData[player.id] || {}}
                  onIncrement={(key) => handleIncrement(player.id, key)}
                  onDecrement={(key) => handleDecrement(player.id, key)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-afrocat-card rounded-xl border border-afrocat-border sticky bottom-4">
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-stats"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <div className="flex items-center gap-4">
                {autoSaveStatus === "saving" && (
                  <span className="flex items-center gap-1.5 text-xs text-afrocat-muted" data-testid="text-autosave-saving">
                    <Loader2 className="w-3 h-3 animate-spin" /> Auto-saving...
                  </span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-xs text-afrocat-green" data-testid="text-autosave-saved">
                    <CheckCircle2 className="w-3 h-3" /> Auto-saved
                  </span>
                )}
                <Button
                  onClick={() => submitMut.mutate()}
                  disabled={submitMut.isPending}
                  size="lg"
                  className="px-8"
                  data-testid="button-submit-stats"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {submitMut.isPending ? "Saving..." : "Save Match Stats"}
                </Button>
              </div>
            </div>
          </>
        )}

        {selectedMatchId && matchPlayers.length === 0 && (
          <div className="afrocat-card">
            <div className="py-10 text-center text-afrocat-muted" data-testid="text-no-players">
              No players found for this team. Add players first.
            </div>
          </div>
        )}

        {showSummary && summaryData && (
          <div className="afrocat-card border border-afrocat-green/30 bg-afrocat-green-soft" data-testid="card-summary">
            <div className="bg-afrocat-green-soft border-b border-afrocat-green/20 p-4 rounded-t-[18px]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-afrocat-green" />
                <h3 className="text-afrocat-green font-display font-bold">Match Stats Summary</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-afrocat-muted mb-3">Team Totals</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-teal" data-testid="text-summary-points">{summaryData.teamTotals.pointsTotal}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Points</div>
                  </div>
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-gold" data-testid="text-summary-kills">{summaryData.teamTotals.spikesKill}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Kills</div>
                  </div>
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-teal" data-testid="text-summary-aces">{summaryData.teamTotals.servesAce}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Aces</div>
                  </div>
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-gold" data-testid="text-summary-blocks">{(summaryData.teamTotals.blocksSolo || 0) + (summaryData.teamTotals.blocksAssist || 0)}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Blocks</div>
                  </div>
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-teal" data-testid="text-summary-digs">{summaryData.teamTotals.digs}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Digs</div>
                  </div>
                  <div className="bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border text-center">
                    <div className="text-2xl font-bold text-afrocat-red" data-testid="text-summary-errors">{summaryData.teamTotals.errorsTotal}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase">Errors</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-afrocat-muted mb-3">Top Performers</h4>
                <div className="space-y-2">
                  {summaryData.topPerformers.map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center gap-3 bg-afrocat-white-5 rounded-lg p-3 border border-afrocat-border" data-testid={`text-top-performer-${i}`}>
                      <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-sm font-bold text-afrocat-teal">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-sm">#{p.jerseyNo} {p.firstName} {p.lastName}</span>
                        <span className="text-xs text-afrocat-muted ml-2">{p.position}</span>
                      </div>
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${p.points >= 0 ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`} data-testid={`text-performer-points-${i}`}>
                        {p.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-afrocat-green flex items-center gap-2" data-testid="text-smartfocus-count">
                <CheckCircle2 className="w-4 h-4" />
                SmartFocus recommendations generated for {summaryData.smartFocusCount} players
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) return content;

  return (
    <Layout>
      {content}
    </Layout>
  );
}
