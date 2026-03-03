import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
import {
  Zap, Target, Shield, Hand, ArrowUpCircle, CircleDot,
  Undo2, Lock, Unlock, User, Trophy
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

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);

  const handleMatchChange = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    setSelectedPlayerId(null);
    setSelectedAction(null);
    setRecentEvents([]);
    const match = matches.find((m: any) => m.id === matchId);
    if (match?.teamId) setSelectedTeamId(match.teamId);
  }, [matches]);

  const { data: touchInit, isLoading: initLoading } = useQuery({
    queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId],
    queryFn: () => api.getTouchStatsInit(selectedMatchId, selectedTeamId),
    enabled: !!selectedMatchId && !!selectedTeamId,
  });

  const players = touchInit?.players || [];
  const matchData = touchInit?.match;
  const isLocked = !!matchData?.isLocked;

  const selectedPlayer = useMemo(
    () => players.find((p: any) => p.id === selectedPlayerId),
    [players, selectedPlayerId]
  );

  const serverEvents = touchInit?.events || [];
  const allEvents = useMemo(() => {
    const serverIds = new Set(serverEvents.map((e: any) => e.id));
    const newLocal = recentEvents.filter((e: any) => !serverIds.has(e.id) && !e.id.startsWith("temp_"));
    return [...recentEvents.filter((e: any) => e.id.startsWith("temp_")), ...serverEvents].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [serverEvents, recentEvents]);

  const eventMut = useMutation({
    mutationFn: (data: { playerId: string; action: string; outcome: string }) =>
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

  const handleOutcome = useCallback((outcome: string) => {
    if (!selectedPlayerId || !selectedAction || isLocked) return;

    const tempId = `temp_${Date.now()}`;
    const newEvent = {
      id: tempId,
      matchId: selectedMatchId,
      teamId: selectedTeamId,
      playerId: selectedPlayerId,
      action: selectedAction,
      outcome,
      createdAt: new Date().toISOString(),
      playerName: `${selectedPlayer?.firstName || ""} ${selectedPlayer?.lastName || ""}`.trim(),
      jerseyNo: selectedPlayer?.jerseyNo ?? "",
    };

    setRecentEvents((prev) => [newEvent, ...prev].slice(0, 20));
    eventMut.mutate({ playerId: selectedPlayerId, action: selectedAction, outcome });
    setSelectedAction(null);
  }, [selectedPlayerId, selectedAction, isLocked, selectedMatchId, selectedTeamId, selectedPlayer, eventMut]);

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

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Afrocat Logo" className="w-14 h-14 object-contain" data-testid="img-touch-logo" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-touch-title">
                Touch Stats Entry
              </h1>
              <p className="text-sm text-afrocat-muted mt-0.5">
                Tap Player → Action → Outcome. Fast during rallies.
              </p>
            </div>
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
                      onClick={() => { setSelectedPlayerId(p.id); setSelectedAction(null); }}
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
                          onClick={() => setSelectedAction(a.key)}
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

                {selectedAction && (
                  <div>
                    <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3" data-testid="text-step-outcome">
                      3. Tap Outcome
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {OUTCOMES.map((o) => (
                        <button
                          key={o.key}
                          onClick={() => handleOutcome(o.key)}
                          disabled={isLocked || eventMut.isPending}
                          className={`p-5 rounded-xl border-2 ${o.border} ${o.bg} transition-all duration-100 cursor-pointer hover:scale-[1.02] active:scale-95 ${
                            isLocked ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          data-testid={`button-outcome-${o.key}`}
                        >
                          <div className={`text-3xl font-black ${o.text}`}>{o.label}</div>
                          <div className="text-xs text-afrocat-muted mt-1">{o.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                              {e.action} • {new Date(e.createdAt).toLocaleTimeString()}
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
