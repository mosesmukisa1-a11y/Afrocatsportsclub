import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Zap, Target, Shield, Hand, ArrowUpCircle, CircleDot,
  Undo2, Lock, Unlock, FileText, AlertTriangle, CheckCircle2
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

const SKILL_ICONS: Record<string, any> = {
  SERVE: Target, RECEIVE: Hand, SET: ArrowUpCircle,
  ATTACK: Zap, BLOCK: Shield, DIG: Hand, FREEBALL: CircleDot,
};

const SKILL_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  SERVE: { color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  RECEIVE: { color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft", border: "border-afrocat-gold/30" },
  SET: { color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  ATTACK: { color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft", border: "border-afrocat-gold/30" },
  BLOCK: { color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft", border: "border-afrocat-teal/30" },
  DIG: { color: "text-afrocat-green", bg: "bg-afrocat-green-soft", border: "border-afrocat-green/30" },
  FREEBALL: { color: "text-afrocat-muted", bg: "bg-afrocat-white-5", border: "border-afrocat-border" },
};

const OUTCOMES = [
  { key: "PLUS", label: "+", hint: "Point / Success", bg: "bg-afrocat-green-soft", border: "border-afrocat-green/40", text: "text-afrocat-green" },
  { key: "ZERO", label: "0", hint: "Neutral", bg: "bg-afrocat-white-5", border: "border-afrocat-border", text: "text-afrocat-muted" },
  { key: "MINUS", label: "−", hint: "Error / Lost", bg: "bg-afrocat-red-soft", border: "border-afrocat-red/40", text: "text-afrocat-red" },
];

function getInitials(f: string, l: string) {
  return `${(f || "")[0] || ""}${(l || "")[0] || ""}`.toUpperCase();
}

function getSkillConfig(skillType: string, enums: any) {
  if (!enums) return { subTypes: [], outcomeDetails: [], errorTypes: [], tactical: [] };
  switch (skillType) {
    case "SERVE":
      return { subTypes: enums.SERVE_TYPES, outcomeDetails: enums.SERVE_OUTCOME_DETAIL, errorTypes: enums.TECHNICAL_ERRORS, tactical: enums.SERVE_TACTICAL_INTENTION };
    case "RECEIVE":
      return { subTypes: enums.RECEIVE_TYPES, outcomeDetails: enums.RECEIVE_RATING_DETAIL, errorTypes: enums.RECEIVE_ERROR_TYPES, tactical: [] };
    case "SET":
      return { subTypes: enums.SET_TYPES, outcomeDetails: enums.SET_QUALITY_DETAIL, errorTypes: enums.SET_ERROR_TYPES, tactical: [] };
    case "ATTACK":
      return { subTypes: enums.ATTACK_TYPES, outcomeDetails: enums.ATTACK_OUTCOME_DETAIL, errorTypes: enums.ATTACK_ERROR_TYPES, tactical: [] };
    case "BLOCK":
      return { subTypes: enums.BLOCK_TYPES, outcomeDetails: enums.BLOCK_OUTCOME_DETAIL, errorTypes: enums.BLOCK_ERROR_TYPES, tactical: [] };
    case "DIG":
      return { subTypes: enums.DIG_TYPES, outcomeDetails: enums.DIG_OUTCOME_DETAIL, errorTypes: enums.DIG_ERROR_TYPES, tactical: [] };
    default:
      return { subTypes: [], outcomeDetails: [], errorTypes: [], tactical: [] };
  }
}

export default function DevStats() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [skillType, setSkillType] = useState("SERVE");
  const [subType, setSubType] = useState("");
  const [zone, setZone] = useState("");
  const [outcome, setOutcome] = useState("PLUS");
  const [outcomeDetail, setOutcomeDetail] = useState("");
  const [errorCategory, setErrorCategory] = useState("NONE");
  const [errorType, setErrorType] = useState("");
  const [pressureFlag, setPressureFlag] = useState(false);
  const [fatigueFlag, setFatigueFlag] = useState(false);
  const [tacticalIntention, setTacticalIntention] = useState("");
  const [notes, setNotes] = useState("");
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);

  const handleMatchChange = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    setSelectedPlayerId(null);
    setRecentEvents([]);
    const match = matches.find((m: any) => m.id === matchId);
    if (match?.teamId) setSelectedTeamId(match.teamId);
  }, [matches]);

  const { data: devInit, isLoading: initLoading } = useQuery({
    queryKey: ["/api/devstats/init", selectedMatchId, selectedTeamId],
    queryFn: () => api.getDevStatsInit(selectedMatchId, selectedTeamId),
    enabled: !!selectedMatchId && !!selectedTeamId,
  });

  const players = devInit?.players || [];
  const enums = devInit?.enums || {};
  const isLocked = !!devInit?.locked;
  const serverEvents = devInit?.events || [];

  const selectedPlayer = useMemo(() => players.find((p: any) => p.id === selectedPlayerId), [players, selectedPlayerId]);

  const cfg = useMemo(() => getSkillConfig(skillType, enums), [skillType, enums]);

  useEffect(() => {
    setSubType(cfg.subTypes?.[0] || "");
    setOutcomeDetail(cfg.outcomeDetails?.[0] || "");
    setErrorType("");
    setErrorCategory("NONE");
    setTacticalIntention(cfg.tactical?.[0] || "");
  }, [skillType, cfg.subTypes?.length]);

  const allEvents = useMemo(() => {
    const serverIds = new Set(serverEvents.map((e: any) => e.id));
    return [
      ...recentEvents.filter((e: any) => e.id.startsWith("temp_")),
      ...serverEvents
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [serverEvents, recentEvents]);

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

  const eventMut = useMutation({
    mutationFn: (data: any & { _tempId: string }) => api.createDevStatsEvent(selectedMatchId, data),
    onSuccess: (result: any, variables: any) => {
      setRecentEvents(prev => prev.map(e => e.id === variables._tempId ? { ...e, id: result.event.id } : e));
      queryClient.invalidateQueries({ queryKey: ["/api/devstats/init", selectedMatchId, selectedTeamId] });
    },
    onError: (err: any, variables: any) => {
      setRecentEvents(prev => prev.filter(e => e.id !== variables._tempId));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const undoMut = useMutation({
    mutationFn: (eventId: string) => api.deleteDevStatsEvent(selectedMatchId, eventId),
    onSuccess: (_: any, eventId: string) => {
      setRecentEvents(prev => prev.filter(e => e.id !== eventId));
      queryClient.invalidateQueries({ queryKey: ["/api/devstats/init", selectedMatchId, selectedTeamId] });
      toast({ title: "Undone", description: "Last event removed." });
    },
    onError: (err: any) => toast({ title: "Undo Failed", description: err.message, variant: "destructive" }),
  });

  const reportMut = useMutation({
    mutationFn: () => api.generateDevStatsReport(selectedMatchId, selectedTeamId),
    onSuccess: () => toast({ title: "Report Generated", description: "Development report created. Check Coach Dashboard for alerts." }),
    onError: (err: any) => toast({ title: "Report Failed", description: err.message, variant: "destructive" }),
  });

  const handleSaveEvent = useCallback(() => {
    if (!selectedPlayerId || isLocked) return;

    if (outcome === "MINUS") {
      if (!outcomeDetail) { toast({ title: "Required", description: "Outcome detail required for MINUS.", variant: "destructive" }); return; }
      if (!errorCategory || errorCategory === "NONE") { toast({ title: "Required", description: "Error category required for MINUS.", variant: "destructive" }); return; }
    }

    const tempId = `temp_${Date.now()}`;
    const newEvent = {
      id: tempId,
      matchId: selectedMatchId, teamId: selectedTeamId,
      playerId: selectedPlayerId, action: skillType,
      outcome, outcomeDetail, subType,
      createdAt: new Date().toISOString(),
      playerName: `${selectedPlayer?.firstName || ""} ${selectedPlayer?.lastName || ""}`.trim(),
      jerseyNo: selectedPlayer?.jerseyNo ?? "",
    };
    setRecentEvents(prev => [newEvent, ...prev].slice(0, 30));

    eventMut.mutate({
      _tempId: tempId,
      teamId: selectedTeamId, playerId: selectedPlayerId,
      skillType, subType: subType || null, zone: zone || null,
      outcome, outcomeDetail: outcomeDetail || null,
      errorCategory: errorCategory || "NONE", errorType: errorType || null,
      pressureFlag, fatigueFlag, tacticalIntention: tacticalIntention || null,
      notes: notes || null,
    });

    setNotes("");
    if (outcome === "MINUS") {
      setOutcome("PLUS");
      setErrorCategory("NONE");
      setErrorType("");
    }
  }, [selectedPlayerId, isLocked, selectedMatchId, selectedTeamId, selectedPlayer, skillType, subType, zone, outcome, outcomeDetail, errorCategory, errorType, pressureFlag, fatigueFlag, tacticalIntention, notes, eventMut, toast]);

  const handleUndo = useCallback(() => {
    const lastEvent = recentEvents[0] || allEvents[0];
    if (!lastEvent || lastEvent.id.startsWith("temp_") || isLocked) return;
    undoMut.mutate(lastEvent.id);
  }, [recentEvents, allEvents, isLocked, undoMut]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Afrocat" className="w-14 h-14 object-contain" data-testid="img-devstats-logo" />
              <div>
                <h1 className="text-2xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-devstats-title">
                  Advanced Development Stats
                </h1>
                <p className="text-sm text-afrocat-muted mt-0.5">
                  Track every touch: technique, decisions, errors, and development metrics
                </p>
              </div>
            </div>
            {selectedMatchId && allEvents.length > 0 && (
              <button
                onClick={() => reportMut.mutate()}
                disabled={reportMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer disabled:opacity-50"
                data-testid="button-generate-report"
              >
                <FileText className="w-4 h-4" />
                {reportMut.isPending ? "Generating..." : "Generate Report"}
              </button>
            )}
          </div>
        </div>

        <div className="afrocat-card">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border p-4 rounded-t-[18px]">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Match</label>
                <Select value={selectedMatchId} onValueChange={handleMatchChange}>
                  <SelectTrigger data-testid="select-devstats-match">
                    <SelectValue placeholder="Select a match" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((m: any) => {
                      const team = teams.find((t: any) => t.id === m.teamId);
                      return (
                        <SelectItem key={m.id} value={m.id} data-testid={`select-devstats-match-${m.id}`}>
                          {m.matchDate} — {team?.name || "?"} vs {m.opponent}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {selectedMatch && (
                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 bg-afrocat-white-5 rounded-md text-sm font-medium text-afrocat-text" data-testid="text-devstats-opponent">
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
            {/* Player Grid */}
            <div>
              <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3">1. Select Player</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {players.map((p: any) => {
                  const active = p.id === selectedPlayerId;
                  const pStats = playerStats[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayerId(p.id)}
                      disabled={isLocked}
                      className={`afrocat-card p-3 text-left transition-all duration-150 cursor-pointer ${active ? "ring-2 ring-afrocat-teal border-afrocat-teal/50" : "hover:border-afrocat-teal/20"} ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                      data-testid={`button-player-${p.id}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={`${p.firstName} ${p.lastName}`} className="w-12 h-12 rounded-full object-cover border-2 border-afrocat-teal/20" />
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
                          <div className="font-bold text-xs text-afrocat-text truncate uppercase">{p.firstName} {p.lastName}</div>
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

            {/* Detailed Touch Pad */}
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
                    <span className="font-display font-bold text-afrocat-text text-sm">{selectedPlayer?.firstName} {selectedPlayer?.lastName}</span>
                    <span className="ml-2 text-xs text-afrocat-teal font-bold">#{selectedPlayer?.jerseyNo}</span>
                  </div>
                </div>

                {/* 2) Skill Type */}
                <div>
                  <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3">2. Skill Type</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {(enums.SKILL_TYPES || []).map((s: string) => {
                      const active = skillType === s;
                      const sc = SKILL_COLORS[s] || SKILL_COLORS.FREEBALL;
                      const Icon = SKILL_ICONS[s] || CircleDot;
                      return (
                        <button
                          key={s} onClick={() => setSkillType(s)} disabled={isLocked}
                          className={`p-3 rounded-xl border-2 font-bold text-sm transition-all duration-150 cursor-pointer ${active ? `${sc.bg} ${sc.border} ${sc.color} ring-1 ring-current` : `bg-afrocat-white-3 border-afrocat-border text-afrocat-text`} ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                          data-testid={`button-skill-${s}`}
                        >
                          <Icon className={`w-5 h-5 mx-auto mb-1 ${active ? sc.color : "text-afrocat-muted"}`} />
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3) Sub Type + Zone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">3. Sub Type</label>
                    <select
                      value={subType} onChange={e => setSubType(e.target.value)} disabled={isLocked}
                      className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                      data-testid="select-subtype"
                    >
                      {(cfg.subTypes || []).map((x: string) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">Zone</label>
                    <select
                      value={zone} onChange={e => setZone(e.target.value)} disabled={isLocked}
                      className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                      data-testid="select-zone"
                    >
                      <option value="">(none)</option>
                      {(enums.ZONES || []).map((z: string) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>

                {/* 4) Outcome (Quality) */}
                <div>
                  <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider mb-3">4. Outcome (Quality)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {OUTCOMES.map(o => (
                      <button
                        key={o.key} onClick={() => setOutcome(o.key)} disabled={isLocked}
                        className={`p-4 rounded-xl border-2 ${o.border} transition-all duration-100 cursor-pointer hover:scale-[1.02] active:scale-95 ${outcome === o.key ? `${o.bg} ring-2 ring-current` : "bg-afrocat-white-3"} ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        data-testid={`button-outcome-${o.key}`}
                      >
                        <div className={`text-2xl font-black ${o.text}`}>{o.label}</div>
                        <div className="text-xs text-afrocat-muted mt-1">{o.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5) Outcome Detail + Tactical Intention */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">5. Outcome Detail</label>
                    <select
                      value={outcomeDetail} onChange={e => setOutcomeDetail(e.target.value)} disabled={isLocked}
                      className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                      data-testid="select-outcome-detail"
                    >
                      <option value="">(none)</option>
                      {(cfg.outcomeDetails || []).map((x: string) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  {skillType === "SERVE" && (
                    <div>
                      <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">Tactical Intention</label>
                      <select
                        value={tacticalIntention} onChange={e => setTacticalIntention(e.target.value)} disabled={isLocked}
                        className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                        data-testid="select-tactical"
                      >
                        {(cfg.tactical || []).map((x: string) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* 6) Error Classification (shown when MINUS) */}
                {outcome === "MINUS" && (
                  <div className="p-4 rounded-xl bg-afrocat-red-soft/30 border border-afrocat-red/20 space-y-4">
                    <div className="flex items-center gap-2 text-afrocat-red font-bold text-sm">
                      <AlertTriangle className="w-4 h-4" /> Error Classification (Required for MINUS)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">Error Category</label>
                        <select
                          value={errorCategory} onChange={e => setErrorCategory(e.target.value)} disabled={isLocked}
                          className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                          data-testid="select-error-category"
                        >
                          {(enums.ERROR_CATEGORY || []).map((x: string) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">Error Type</label>
                        <select
                          value={errorType} onChange={e => setErrorType(e.target.value)} disabled={isLocked || errorCategory === "NONE"}
                          className="w-full p-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                          data-testid="select-error-type"
                        >
                          <option value="">(none)</option>
                          {(cfg.errorTypes || []).map((x: string) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7) Flags */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm font-bold text-afrocat-text cursor-pointer">
                    <input type="checkbox" checked={pressureFlag} onChange={e => setPressureFlag(e.target.checked)} disabled={isLocked}
                      className="w-4 h-4 rounded border-afrocat-border" data-testid="checkbox-pressure" />
                    Pressure Situation
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-afrocat-text cursor-pointer">
                    <input type="checkbox" checked={fatigueFlag} onChange={e => setFatigueFlag(e.target.checked)} disabled={isLocked}
                      className="w-4 h-4 rounded border-afrocat-border" data-testid="checkbox-fatigue" />
                    Fatigue Factor
                  </label>
                </div>

                {/* 8) Notes */}
                <div>
                  <label className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-1 block">Notes (optional)</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)} disabled={isLocked}
                    placeholder="Quick note about this event..."
                    className="w-full p-3 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm min-h-[60px] resize-none"
                    data-testid="textarea-notes"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveEvent}
                  disabled={isLocked || eventMut.isPending}
                  className="w-full p-4 rounded-xl bg-afrocat-teal text-white font-display font-bold text-base hover:bg-afrocat-teal/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-save-event"
                >
                  {eventMut.isPending ? "Saving..." : "SAVE EVENT"}
                </button>
              </div>
            )}

            {/* Recent Events */}
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
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {allEvents.length === 0 ? (
                  <p className="text-sm text-afrocat-muted text-center py-6" data-testid="text-no-events">
                    No events recorded yet. Select a player and start tracking!
                  </p>
                ) : (
                  allEvents.slice(0, 30).map((e: any) => {
                    const player = players.find((p: any) => p.id === e.playerId);
                    const pName = e.playerName || (player ? `${player.firstName} ${player.lastName}` : "Unknown");
                    const jersey = e.jerseyNo ?? player?.jerseyNo ?? "";
                    const outBadge = e.outcome === "PLUS"
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-green-soft text-afrocat-green">+</span>
                      : e.outcome === "MINUS"
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-red-soft text-afrocat-red">−</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-white-5 text-afrocat-muted">0</span>;

                    return (
                      <div
                        key={e.id}
                        className={`flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border ${e.id.startsWith("temp_") ? "opacity-60" : ""}`}
                        data-testid={`event-${e.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-afrocat-white-5 flex items-center justify-center text-xs font-bold text-afrocat-teal border border-afrocat-teal/20">
                            {jersey}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-afrocat-text">{pName}</div>
                            <div className="text-[10px] text-afrocat-muted">
                              {e.action || e.skillType} • {e.outcomeDetail || e.outcome} {e.subType ? `• ${e.subType}` : ""} • {new Date(e.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {outBadge}
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
            No players found for this team.
          </div>
        )}

        {selectedMatchId && initLoading && (
          <div className="afrocat-card p-6 text-center text-afrocat-muted">Loading players...</div>
        )}
      </div>
    </Layout>
  );
}
