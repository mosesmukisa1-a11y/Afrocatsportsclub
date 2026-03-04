import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
import {
  Zap, Target, Shield, Hand, ArrowUpCircle, CircleDot,
  Undo2, Lock, Unlock, User, Trophy, Upload, CheckCircle2,
  Plus, Minus, Maximize, Minimize
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

const ACTIONS = [
  { key: "SERVE", label: "Serve", icon: Target, color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  { key: "RECEIVE", label: "Receive", icon: Hand, color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft", border: "border-afrocat-gold/30" },
  { key: "SET", label: "Set", icon: ArrowUpCircle, color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  { key: "ATTACK", label: "Attack", icon: Zap, color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft", border: "border-afrocat-gold/30" },
  { key: "BLOCK", label: "Block", icon: Shield, color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  { key: "DIG", label: "Dig", icon: Hand, color: "text-afrocat-green", bg: "bg-afrocat-green-soft", border: "border-afrocat-green/30" },
  { key: "FREEBALL", label: "Free Ball", icon: CircleDot, color: "text-afrocat-muted", bg: "bg-afrocat-white-5", border: "border-afrocat-border" },
];

const OUTCOMES = [
  { key: "PLUS", label: "+", hint: "Point / Success", bg: "bg-afrocat-green-soft", border: "border-afrocat-green/40", text: "text-afrocat-green" },
  { key: "ZERO", label: "0", hint: "Neutral", bg: "bg-afrocat-white-5", border: "border-afrocat-border", text: "text-afrocat-muted" },
  { key: "MINUS", label: "−", hint: "Error / Lost", bg: "bg-afrocat-red-soft", border: "border-afrocat-red/40", text: "text-afrocat-red" },
];

type OutcomeDetailOption = { label: string; value: string; outcome: string; pointTo?: "home" | "away" };

const OUTCOME_DETAILS: Record<string, OutcomeDetailOption[]> = {
  SERVE: [
    { label: "ACE", value: "ACE", outcome: "PLUS", pointTo: "home" },
    { label: "In Play", value: "IN_PLAY", outcome: "ZERO" },
    { label: "Net", value: "NET", outcome: "MINUS", pointTo: "away" },
    { label: "Out", value: "OUT", outcome: "MINUS", pointTo: "away" },
  ],
  RECEIVE: [
    { label: "Perfect", value: "3_PERFECT", outcome: "PLUS" },
    { label: "Positive", value: "2_POSITIVE", outcome: "ZERO" },
    { label: "Off System", value: "1_OFF_SYSTEM", outcome: "ZERO" },
    { label: "Error", value: "0_ERROR", outcome: "MINUS", pointTo: "away" },
  ],
  SET: [
    { label: "Perfect", value: "PERFECT", outcome: "PLUS" },
    { label: "Slightly Off", value: "SLIGHTLY_OFF", outcome: "ZERO" },
    { label: "Out of System", value: "SET_OUT_OF_SYSTEM", outcome: "ZERO" },
    { label: "Out", value: "SET_OUT", outcome: "MINUS", pointTo: "away" },
    { label: "Net Touch", value: "NET_TOUCH", outcome: "MINUS", pointTo: "away" },
    { label: "Double Touch", value: "DOUBLE_TOUCH", outcome: "MINUS", pointTo: "away" },
    { label: "Lift", value: "LIFT", outcome: "MINUS", pointTo: "away" },
  ],
  ATTACK: [
    { label: "Kill", value: "KILL", outcome: "PLUS", pointTo: "home" },
    { label: "Tool Block", value: "TOOL_BLOCK", outcome: "PLUS", pointTo: "home" },
    { label: "Dug", value: "DUG", outcome: "ZERO" },
    { label: "Blocked", value: "BLOCKED", outcome: "MINUS", pointTo: "away" },
    { label: "Out", value: "OUT", outcome: "MINUS", pointTo: "away" },
    { label: "Net", value: "NET", outcome: "MINUS", pointTo: "away" },
  ],
  BLOCK: [
    { label: "Stuff Block", value: "STUFF", outcome: "PLUS", pointTo: "home" },
    { label: "Touch", value: "TOUCH", outcome: "ZERO" },
    { label: "Block Out", value: "BLOCK_OUT", outcome: "ZERO" },
    { label: "Net Touch", value: "NET_TOUCH", outcome: "MINUS", pointTo: "away" },
    { label: "Overreach", value: "OVERREACH", outcome: "MINUS", pointTo: "away" },
    { label: "Error", value: "ERROR", outcome: "MINUS", pointTo: "away" },
  ],
  DIG: [
    { label: "Controlled", value: "CONTROLLED", outcome: "PLUS" },
    { label: "Not Controlled", value: "NOT_CONTROLLED", outcome: "ZERO" },
    { label: "Error", value: "ERROR", outcome: "MINUS", pointTo: "away" },
  ],
  FREEBALL: [
    { label: "Good", value: "CONTROLLED", outcome: "PLUS" },
    { label: "OK", value: "OK", outcome: "ZERO" },
    { label: "Error", value: "ERROR", outcome: "MINUS", pointTo: "away" },
  ],
};

const SET_COMBOS = [
  { label: "ONE", value: "ONE" },
  { label: "ZERO", value: "ZERO" },
  { label: "FAST", value: "FAST_BALL" },
];

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

function outcomeBadge(outcome: string) {
  if (outcome === "PLUS") return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-green-soft text-afrocat-green">+</span>;
  if (outcome === "MINUS") return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-red-soft text-afrocat-red">−</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-white-5 text-afrocat-muted">0</span>;
}

export default function TouchStats() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [showCombo, setShowCombo] = useState(false);
  const [pendingSetEvent, setPendingSetEvent] = useState<any | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);
  const [syncResetKey, setSyncResetKey] = useState(0);

  const handleMatchChange = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    setSelectedPlayerId(null);
    setSelectedAction(null);
    setRecentEvents([]);
    setSyncResetKey(k => k + 1);
    const match = matches.find((m: any) => m.id === matchId);
    if (match?.teamId) setSelectedTeamId(match.teamId);
  }, [matches]);

  const { data: touchInit, isLoading: initLoading } = useQuery({
    queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId],
    queryFn: () => api.getTouchStatsInit(selectedMatchId, selectedTeamId),
    enabled: !!selectedMatchId && !!selectedTeamId,
    refetchInterval: 10000,
  });

  const players = touchInit?.players || [];
  const matchData = touchInit?.match;
  const isLocked = !!matchData?.isLocked;
  const teamName = touchInit?.teamName || "Home";
  const scorerName = touchInit?.scorerName || "—";
  const homePoints = matchData?.liveHomePoints || 0;
  const awayPoints = matchData?.liveAwayPoints || 0;
  const homeSets = matchData?.homeSetsWon || 0;
  const awaySets = matchData?.awaySetsWon || 0;
  const currentSet = matchData?.currentSetNumber || 1;

  const selectedPlayer = useMemo(
    () => players.find((p: any) => p.id === selectedPlayerId),
    [players, selectedPlayerId]
  );

  const serverEvents = touchInit?.events || [];
  const allEvents = useMemo(() => {
    const serverIds = new Set(serverEvents.map((e: any) => e.id));
    return [...recentEvents.filter((e: any) => e.id.startsWith("temp_")), ...serverEvents].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [serverEvents, recentEvents]);

  const eventMut = useMutation({
    mutationFn: (data: any) =>
      api.createMatchEvent(selectedMatchId, { ...data, teamId: selectedTeamId }),
    onSuccess: (result: any) => {
      setRecentEvents((prev) =>
        prev.map((e) => (e.id.startsWith("temp_") ? { ...e, id: result.event.id } : e))
      );
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
    },
    onError: (err: any) => {
      setRecentEvents((prev) => prev.filter((e) => !e.id.startsWith("temp_")));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const undoMut = useMutation({
    mutationFn: (eventId: string) => api.deleteMatchEvent(selectedMatchId, eventId),
    onSuccess: (_: any, eventId: string) => {
      setRecentEvents((prev) => prev.filter((e) => e.id !== eventId));
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      toast({ title: "Undone", description: "Last event removed." });
    },
    onError: (err: any) => toast({ title: "Undo Failed", description: err.message, variant: "destructive" }),
  });

  const syncMut = useMutation({
    mutationKey: ["sync-touch-stats", syncResetKey],
    mutationFn: () => api.syncTouchStats(selectedMatchId),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Stats Synced!", description: `${data.synced} player stats saved to database. Smart Focus generated.` });
    },
    onError: (err: any) => toast({ title: "Sync Failed", description: err.message, variant: "destructive" }),
  });

  const pointMut = useMutation({
    mutationFn: ({ side }: { side: "home" | "away" }) => api.scoreboardPoint(selectedMatchId, side),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] }),
  });

  const undoPointMut = useMutation({
    mutationFn: () => api.scoreboardUndoPoint(selectedMatchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] }),
  });

  const endSetMut = useMutation({
    mutationFn: ({ winner }: { winner: "home" | "away" }) => api.scoreboardEndSet(selectedMatchId, winner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      toast({ title: "Set ended" });
    },
  });

  const handleDetailedOutcome = useCallback((detail: OutcomeDetailOption) => {
    if (!selectedPlayerId || !selectedAction || isLocked) return;

    if (selectedAction === "SET" && (detail.outcome === "PLUS" || detail.outcome === "ZERO") && detail.value !== "SET_OUT_OF_SYSTEM") {
      setPendingSetEvent(detail);
      setShowCombo(true);
      return;
    }

    fireEvent(detail, null);
  }, [selectedPlayerId, selectedAction, isLocked, selectedMatchId, selectedTeamId, selectedPlayer]);

  const fireEvent = useCallback((detail: OutcomeDetailOption, combo: string | null) => {
    if (!selectedPlayerId || !selectedAction) return;

    const matchTeamId = matchData?.teamId || selectedTeamId;
    let pointSide: string | null = null;
    if (detail.pointTo === "home") pointSide = "home";
    else if (detail.pointTo === "away") pointSide = "away";

    const tempId = `temp_${Date.now()}`;
    const newEvent = {
      id: tempId,
      matchId: selectedMatchId,
      teamId: selectedTeamId,
      playerId: selectedPlayerId,
      action: selectedAction,
      outcome: detail.outcome,
      outcomeDetail: detail.value,
      createdAt: new Date().toISOString(),
      playerName: `${selectedPlayer?.firstName || ""} ${selectedPlayer?.lastName || ""}`.trim(),
      jerseyNo: selectedPlayer?.jerseyNo ?? "",
    };

    setRecentEvents((prev) => [newEvent, ...prev].slice(0, 30));
    eventMut.mutate({
      playerId: selectedPlayerId,
      action: selectedAction,
      outcome: detail.outcome,
      outcomeDetail: detail.value,
      combinationType: combo,
      pointSide,
    });
    setSelectedAction(null);
    setShowCombo(false);
    setPendingSetEvent(null);
  }, [selectedPlayerId, selectedAction, selectedMatchId, selectedTeamId, selectedPlayer, matchData, eventMut]);

  const handleCombo = useCallback((combo: string | null) => {
    if (!pendingSetEvent) return;
    fireEvent(pendingSetEvent, combo);
  }, [pendingSetEvent, fireEvent]);

  const handleUndo = useCallback(() => {
    const lastEvent = recentEvents[0] || allEvents[0];
    if (!lastEvent || lastEvent.id.startsWith("temp_") || isLocked) return;
    undoMut.mutate(lastEvent.id);
  }, [recentEvents, allEvents, isLocked, undoMut]);

  const playerStats = useMemo(() => {
    const stats: Record<string, { plus: number; zero: number; minus: number }> = {};
    const evts = [...recentEvents.filter((e: any) => !e.id.startsWith("temp_")), ...serverEvents];
    const seen = new Set<string>();
    for (const e of evts) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (!stats[e.playerId]) stats[e.playerId] = { plus: 0, zero: 0, minus: 0 };
      if (e.outcome === "PLUS") stats[e.playerId].plus++;
      else if (e.outcome === "MINUS") stats[e.playerId].minus++;
      else stats[e.playerId].zero++;
    }
    return stats;
  }, [serverEvents, recentEvents]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  const currentActionDetails = selectedAction ? (OUTCOME_DETAILS[selectedAction] || []) : [];

  return (
    <Layout>
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Afrocat Logo" className="w-10 h-10 object-contain" data-testid="img-touch-logo" />
              <div>
                <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-touch-title">
                  Touch Stats Entry
                </h1>
                <p className="text-xs text-afrocat-muted">Player → Action → Detail</p>
              </div>
            </div>
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid="button-fullscreen">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="afrocat-card">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border p-4 rounded-t-[18px]">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Match</label>
                <Select value={selectedMatchId} onValueChange={handleMatchChange}>
                  <SelectTrigger data-testid="select-touch-match">
                    <SelectValue placeholder="Select a match" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((m: any) => {
                      const team = teams.find((t: any) => t.id === m.teamId);
                      return (
                        <SelectItem key={m.id} value={m.id} data-testid={`select-touch-match-${m.id}`}>
                          {m.matchDate} — {team?.name || "?"} vs {m.opponent}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {selectedMatch && (
                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium text-afrocat-text" data-testid="text-touch-opponent">
                    vs {selectedMatch.opponent}
                  </div>
                  {isLocked ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-red-soft text-afrocat-red font-bold text-xs" data-testid="badge-locked">
                      <Lock className="w-3.5 h-3.5" /> LOCKED
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-green-soft text-afrocat-green font-bold text-xs" data-testid="badge-open">
                      <Unlock className="w-3.5 h-3.5" /> OPEN
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedMatchId && matchData && (
          <div className="afrocat-card overflow-hidden" data-testid="scoreboard">
            <div className="bg-gradient-to-r from-afrocat-bg via-afrocat-card to-afrocat-bg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-gold">Live Scoreboard</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-teal" data-testid="text-current-set">Set {currentSet}</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="text-right">
                  <p className="font-display font-bold text-sm text-afrocat-text truncate" data-testid="text-home-team">{teamName}</p>
                  <div className="flex items-center justify-end gap-3 mt-1">
                    <span className="text-xs text-afrocat-muted">S</span>
                    <span className="text-lg font-black text-afrocat-teal" data-testid="text-home-sets">{homeSets}</span>
                    <span className="text-xs text-afrocat-muted">P</span>
                    <span className="text-3xl font-black text-afrocat-text" data-testid="text-home-points">{homePoints}</span>
                  </div>
                </div>

                <div className="text-center px-3">
                  <span className="text-xs font-bold text-afrocat-muted">VS</span>
                </div>

                <div className="text-left">
                  <p className="font-display font-bold text-sm text-afrocat-text truncate" data-testid="text-away-team">{selectedMatch?.opponent || "Away"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-3xl font-black text-afrocat-text" data-testid="text-away-points">{awayPoints}</span>
                    <span className="text-xs text-afrocat-muted">P</span>
                    <span className="text-lg font-black text-afrocat-teal" data-testid="text-away-sets">{awaySets}</span>
                    <span className="text-xs text-afrocat-muted">S</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-afrocat-border">
                <div className="flex items-center gap-1.5 text-[10px] text-afrocat-muted">
                  <User className="w-3 h-3" />
                  <span data-testid="text-scorer-name">Scorer: {scorerName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => pointMut.mutate({ side: "home" })}
                    disabled={isLocked}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-afrocat-teal-soft text-afrocat-teal hover:bg-afrocat-teal/20 disabled:opacity-40 cursor-pointer"
                    data-testid="button-point-home"
                  >+1 Home</button>
                  <button
                    onClick={() => pointMut.mutate({ side: "away" })}
                    disabled={isLocked}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-afrocat-gold-soft text-afrocat-gold hover:bg-afrocat-gold/20 disabled:opacity-40 cursor-pointer"
                    data-testid="button-point-away"
                  >+1 Away</button>
                  <button
                    onClick={() => undoPointMut.mutate()}
                    disabled={isLocked}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-afrocat-white-5 text-afrocat-muted hover:bg-afrocat-white-10 disabled:opacity-40 cursor-pointer"
                    data-testid="button-undo-point"
                  >Undo Pt</button>
                </div>
              </div>

              {!isLocked && currentSet <= 5 && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => endSetMut.mutate({ winner: "home" })}
                    disabled={endSetMut.isPending}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-afrocat-teal text-white hover:bg-afrocat-teal/80 disabled:opacity-50 cursor-pointer"
                    data-testid="button-end-set-home"
                  >End Set — Home Wins</button>
                  <button
                    onClick={() => endSetMut.mutate({ winner: "away" })}
                    disabled={endSetMut.isPending}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-afrocat-gold text-white hover:bg-afrocat-gold/80 disabled:opacity-50 cursor-pointer"
                    data-testid="button-end-set-away"
                  >End Set — Away Wins</button>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedMatchId && !initLoading && players.length > 0 && (
          <>
            <div>
              <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3" data-testid="text-step-player">
                1. Select Player
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {players.map((p: any) => {
                  const active = p.id === selectedPlayerId;
                  const pStats = playerStats[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPlayerId(p.id); setSelectedAction(null); setShowCombo(false); setPendingSetEvent(null); }}
                      disabled={isLocked}
                      className={`afrocat-card p-3 text-left transition-all duration-150 cursor-pointer ${
                        active ? "ring-2 ring-afrocat-teal border-afrocat-teal/50" : "hover:border-afrocat-teal/20"
                      } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                      data-testid={`button-player-${p.id}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={`${p.firstName} ${p.lastName}`}
                              className="w-12 h-12 rounded-full object-cover border-2 border-afrocat-teal/20"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-afrocat-white-5 flex items-center justify-center border-2 border-afrocat-teal/20 text-sm font-bold text-afrocat-muted">
                              {getInitials(p.firstName, p.lastName)}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-afrocat-teal text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-afrocat-card">
                            {p.jerseyNo}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-afrocat-text truncate uppercase">
                            {p.firstName} {p.lastName}
                          </div>
                          <div className="text-[10px] text-afrocat-muted">{p.position || "—"}</div>
                          {pStats && (
                            <div className="flex gap-1 mt-1">
                              {pStats.plus > 0 && <span className="text-[9px] font-bold text-afrocat-green">+{pStats.plus}</span>}
                              {pStats.zero > 0 && <span className="text-[9px] font-bold text-afrocat-muted">0:{pStats.zero}</span>}
                              {pStats.minus > 0 && <span className="text-[9px] font-bold text-afrocat-red">-{pStats.minus}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPlayerId && (
              <div className="afrocat-card p-5 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-afrocat-border">
                  {selectedPlayer?.photoUrl ? (
                    <img src={selectedPlayer.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-afrocat-teal/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-afrocat-white-5 flex items-center justify-center text-sm font-bold text-afrocat-muted border border-afrocat-teal/30">
                      {getInitials(selectedPlayer?.firstName || "", selectedPlayer?.lastName || "")}
                    </div>
                  )}
                  <div>
                    <span className="font-display font-bold text-afrocat-text text-sm">
                      {selectedPlayer?.firstName} {selectedPlayer?.lastName}
                    </span>
                    <span className="ml-2 text-xs text-afrocat-teal font-bold">#{selectedPlayer?.jerseyNo}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3" data-testid="text-step-action">
                    2. Choose Action
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {ACTIONS.map((a) => {
                      const active = selectedAction === a.key;
                      return (
                        <button
                          key={a.key}
                          onClick={() => { setSelectedAction(a.key); setShowCombo(false); setPendingSetEvent(null); }}
                          disabled={isLocked}
                          className={`p-3 rounded-xl border-2 font-bold text-sm transition-all duration-150 cursor-pointer ${
                            active
                              ? `${a.bg} ${a.border} ${a.color} ring-1 ring-current`
                              : `bg-afrocat-white-3 border-afrocat-border text-afrocat-text hover:${a.bg}`
                          } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                          data-testid={`button-action-${a.key}`}
                        >
                          <a.icon className={`w-5 h-5 mx-auto mb-1 ${active ? a.color : "text-afrocat-muted"}`} />
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedAction && !showCombo && (
                  <div>
                    <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3" data-testid="text-step-outcome">
                      3. Tap Outcome
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {currentActionDetails.map((d) => {
                        const colorCls = d.outcome === "PLUS"
                          ? "bg-afrocat-green-soft border-afrocat-green/40 text-afrocat-green"
                          : d.outcome === "MINUS"
                            ? "bg-afrocat-red-soft border-afrocat-red/40 text-afrocat-red"
                            : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted";
                        return (
                          <button
                            key={d.value}
                            onClick={() => handleDetailedOutcome(d)}
                            disabled={isLocked || eventMut.isPending}
                            className={`p-4 rounded-xl border-2 ${colorCls} transition-all duration-100 cursor-pointer hover:scale-[1.02] active:scale-95 ${
                              isLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            data-testid={`button-detail-${d.value}`}
                          >
                            <div className="text-sm font-black">{d.label}</div>
                            <div className="text-[10px] mt-0.5 opacity-70">
                              {d.outcome === "PLUS" ? "+" : d.outcome === "MINUS" ? "−" : "0"}
                              {d.pointTo ? ` → ${d.pointTo === "home" ? "us" : "opp"}` : ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showCombo && pendingSetEvent && (
                  <div>
                    <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3" data-testid="text-step-combo">
                      Combination Type (Optional)
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {SET_COMBOS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => handleCombo(c.value)}
                          className="p-3 rounded-xl border-2 border-afrocat-teal/30 bg-afrocat-teal-soft text-afrocat-teal font-bold text-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                          data-testid={`button-combo-${c.value}`}
                        >
                          {c.label}
                        </button>
                      ))}
                      <button
                        onClick={() => handleCombo(null)}
                        className="p-3 rounded-xl border-2 border-afrocat-border bg-afrocat-white-5 text-afrocat-muted font-bold text-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                        data-testid="button-combo-skip"
                      >
                        SKIP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {allEvents.length > 0 && !isLocked && (
              <div className="afrocat-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-afrocat-text text-sm" data-testid="text-sync-title">
                      Sync Touch Stats to Player Stats
                    </h3>
                    <p className="text-xs text-afrocat-muted mt-1">
                      Aggregate all {allEvents.length} touch events into official player match statistics.
                    </p>
                  </div>
                  <button
                    onClick={() => syncMut.mutate()}
                    disabled={syncMut.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    data-testid="button-sync-stats"
                  >
                    {syncMut.isPending ? (
                      <><Upload className="w-4 h-4 animate-spin" /> Syncing...</>
                    ) : syncMut.isSuccess ? (
                      <><CheckCircle2 className="w-4 h-4" /> Synced!</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Sync to Stats</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isLocked && allEvents.length > 0 && (
              <div className="afrocat-card p-4 flex items-center gap-3 border-afrocat-green/30">
                <CheckCircle2 className="w-5 h-5 text-afrocat-green shrink-0" />
                <p className="text-sm text-afrocat-green font-medium" data-testid="text-stats-synced">
                  Stats have been synced to player records. Match is locked.
                </p>
              </div>
            )}

            <div className="afrocat-card overflow-hidden">
              <div className="bg-afrocat-white-5 border-b border-afrocat-border p-4 rounded-t-[18px] flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-afrocat-text" data-testid="text-recent-title">
                  Recent Events ({allEvents.length})
                </h3>
                <button
                  onClick={handleUndo}
                  disabled={allEvents.length === 0 || isLocked || undoMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-white-10 text-afrocat-text font-bold text-xs hover:bg-afrocat-white-5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  data-testid="button-undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {undoMut.isPending ? "Undoing..." : "Undo Last"}
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                {allEvents.length === 0 ? (
                  <p className="text-sm text-afrocat-muted text-center py-6" data-testid="text-no-events">
                    No events recorded yet. Select a player and start tapping!
                  </p>
                ) : (
                  allEvents.slice(0, 20).map((e: any) => {
                    const player = players.find((p: any) => p.id === e.playerId);
                    const pName = e.playerName || (player ? `${player.firstName} ${player.lastName}` : "Unknown");
                    const jersey = e.jerseyNo ?? player?.jerseyNo ?? "";
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border ${
                          e.id.startsWith("temp_") ? "opacity-60" : ""
                        }`}
                        data-testid={`event-${e.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-afrocat-white-5 flex items-center justify-center text-xs font-bold text-afrocat-teal border border-afrocat-teal/20">
                            {jersey}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-afrocat-text">{pName}</div>
                            <div className="text-[10px] text-afrocat-muted">
                              {e.action}{e.outcomeDetail ? ` · ${e.outcomeDetail}` : ""} • {new Date(e.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {outcomeBadge(e.outcome)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {selectedMatchId && !initLoading && players.length === 0 && (
          <div className="afrocat-card p-6 text-center text-afrocat-muted" data-testid="text-no-players">
            No players found for this team. Add players first.
          </div>
        )}

        {selectedMatchId && initLoading && (
          <div className="afrocat-card p-6 text-center text-afrocat-muted">
            Loading players...
          </div>
        )}
      </div>
    </Layout>
  );
}
