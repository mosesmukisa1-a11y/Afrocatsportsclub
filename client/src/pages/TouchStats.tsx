import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Zap, Target, Shield, Hand, ArrowUpCircle, CircleDot,
  Undo2, Lock, Unlock, User, Trophy, Upload, CheckCircle2,
  Plus, Minus, Maximize, Minimize, Clock,
  FileText, ChevronDown, ChevronUp, Printer, Star,
  RotateCw, Users as UsersIcon, UserCheck, Radio
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
  if (outcome === "MINUS") return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-red-soft text-afrocat-red">-</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-afrocat-white-5 text-afrocat-muted">0</span>;
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
  const [showReport, setShowReport] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");

  const [subsUsedPerSet, setSubsUsedPerSet] = useState<Record<number, number>>({});
  const [timeoutsUsedPerSet, setTimeoutsUsedPerSet] = useState<Record<number, number>>({});
  const [rotationOrder, setRotationOrder] = useState<string[]>([]);
  const [showFivbPanel, setShowFivbPanel] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [subOutId, setSubOutId] = useState<string>("");
  const [subInId, setSubInId] = useState<string>("");
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  const [lineupDraft, setLineupDraft] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [activePos, setActivePos] = useState<number | null>(1);
  const [servingTeam, setServingTeam] = useState<"home" | "away">("home");

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);
  const [syncResetKey, setSyncResetKey] = useState(0);

  const eligibleMatches = useMemo(() => {
    const ACTIVE_STATUSES = ["SCHEDULED", "UPCOMING", "LIVE"];
    return matches
      .filter((m: any) => ACTIVE_STATUSES.includes(m.status))
      .sort((a: any, b: any) =>
        new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
      );
  }, [matches]);

  const handleMatchChange = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
    setSelectedPlayerId(null);
    setSelectedAction(null);
    setRecentEvents([]);
    setSyncResetKey(k => k + 1);
    setShowReport(false);
    setLineupConfirmed(false);
    setLineupDraft([null, null, null, null, null, null]);
    setActivePos(1);
    setServingTeam("home");
    setRotationOrder([]);
    const match = matches.find((m: any) => m.id === matchId);
    if (match?.teamId) setSelectedTeamId(match.teamId);
  }, [matches]);

  const { data: touchInit, isLoading: initLoading } = useQuery({
    queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId],
    queryFn: () => api.getTouchStatsInit(selectedMatchId, selectedTeamId),
    enabled: !!selectedMatchId && !!selectedTeamId,
    refetchInterval: 15000,
    placeholderData: (prev: any) => prev,
    refetchOnWindowFocus: false,
  });

  const { data: matchReport } = useQuery({
    queryKey: ["/api/matches/report", selectedMatchId],
    queryFn: () => api.getMatchReport(selectedMatchId),
    enabled: !!selectedMatchId && showReport,
  });

  const players = touchInit?.players || [];
  const matchData = touchInit?.match;
  const isLocked = !!matchData?.isLocked;
  const teamName = touchInit?.teamName || "Afrocat";
  const scorerName = touchInit?.scorerName || "-";
  const playerOfMatchPlayerId = matchData?.playerOfMatchPlayerId;
  const scoringStarted = !!matchData?.scoringStartedAt;
  const assignedHeadCoach = touchInit?.staff?.headCoach || null;
  const assignedAsstCoach = touchInit?.staff?.assistantCoach || null;

  const [inlineCoachId, setInlineCoachId] = useState<string>("");
  const { data: staffUsers = [] } = useQuery({
    queryKey: ["/api/staff-eligible-users"],
    queryFn: api.getStaffEligibleUsers,
    enabled: !!selectedMatchId && !assignedHeadCoach,
  });
  const saveCoachMut = useMutation({
    mutationFn: (headCoachUserId: string) =>
      api.saveMatchStaff(selectedMatchId!, { headCoachUserId, assistantCoachUserId: "", medicUserId: "", teamManagerUserId: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      toast({ title: "Head coach saved" });
    },
  });

  const [optimisticHome, setOptimisticHome] = useState<number | null>(null);
  const [optimisticAway, setOptimisticAway] = useState<number | null>(null);

  useEffect(() => {
    setOptimisticHome(null);
    setOptimisticAway(null);
  }, [matchData?.liveHomePoints, matchData?.liveAwayPoints]);

  const homePoints = optimisticHome ?? (matchData?.liveHomePoints || 0);
  const awayPoints = optimisticAway ?? (matchData?.liveAwayPoints || 0);
  const homeSets = matchData?.homeSetsWon || 0;
  const awaySets = matchData?.awaySetsWon || 0;
  const currentSet = matchData?.currentSetNumber || 1;
  const bestOf = matchData?.bestOf || 5;

  useEffect(() => {
    if (!matchData?.scoringStartedAt) { setElapsedTime(""); return; }
    const start = new Date(matchData.scoringStartedAt).getTime();
    if (matchData?.scoringEndedAt) {
      const end = new Date(matchData.scoringEndedAt).getTime();
      const mins = Math.round((end - start) / 60000);
      setElapsedTime(formatDuration(mins));
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const mins = Math.round((now - start) / 60000);
      setElapsedTime(formatDuration(mins));
    }, 30000);
    const now = Date.now();
    setElapsedTime(formatDuration(Math.round((now - start) / 60000)));
    return () => clearInterval(interval);
  }, [matchData?.scoringStartedAt, matchData?.scoringEndedAt]);

  const selectedPlayer = useMemo(
    () => players.find((p: any) => p.id === selectedPlayerId),
    [players, selectedPlayerId]
  );

  const pomPlayer = useMemo(
    () => playerOfMatchPlayerId ? players.find((p: any) => p.id === playerOfMatchPlayerId) : null,
    [players, playerOfMatchPlayerId]
  );

  const serverEvents = touchInit?.events || [];
  const allEvents = useMemo(() => {
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
      if (result.setResult?.setEnded) {
        toast({
          title: `Set ${result.setResult.setNumber} Complete!`,
          description: `${result.setResult.winner === "AFROCAT" ? teamName : (selectedMatch?.opponent || "OPP")} wins ${result.setResult.homePoints}-${result.setResult.awayPoints}${result.setResult.matchComplete ? " — MATCH OVER!" : ""}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/player"] });
      toast({ title: "Stats Synced!", description: `${data.synced} player stats saved. Match duration recorded.` });
    },
    onError: (err: any) => toast({ title: "Sync Failed", description: err.message, variant: "destructive" }),
  });

  const pointMut = useMutation({
    mutationFn: ({ side }: { side: "AFROCAT" | "OPP" }) => {
      if (side === "AFROCAT") setOptimisticHome(homePoints + 1);
      else setOptimisticAway(awayPoints + 1);
      return api.scoreboardPoint(selectedMatchId, side);
    },
    onSuccess: (result: any, { side }) => {
      if (side === "AFROCAT" && servingTeam === "away") {
        setRotationOrder(prev => prev.length >= 6 ? [...prev.slice(1), prev[0]] : prev);
        setServingTeam("home");
        toast({ title: "Side Out — Rotated!", description: "Lineup rotated. P1 is now serving." });
      } else if (side === "OPP" && servingTeam === "home") {
        setServingTeam("away");
      }
      if (result.setResult?.setEnded) {
        setServingTeam("home");
        toast({
          title: `Set ${result.setResult.setNumber} Complete!`,
          description: `${result.setResult.winner === "AFROCAT" ? teamName : (selectedMatch?.opponent || "OPP")} wins ${result.setResult.homePoints}-${result.setResult.awayPoints}${result.setResult.matchComplete ? " — MATCH OVER!" : ""}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: () => { setOptimisticHome(null); setOptimisticAway(null); },
  });

  const decrementMut = useMutation({
    mutationFn: ({ side }: { side: "home" | "away" }) => {
      if (side === "home") setOptimisticHome(Math.max(0, homePoints - 1));
      else setOptimisticAway(Math.max(0, awayPoints - 1));
      return api.scoreboardDecrement(selectedMatchId, side);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
    },
    onError: () => { setOptimisticHome(null); setOptimisticAway(null); },
  });

  const undoPointMut = useMutation({
    mutationFn: () => {
      if (homePoints > 0 || awayPoints > 0) {
        setOptimisticHome(Math.max(0, homePoints - (homePoints >= awayPoints ? 1 : 0)));
        setOptimisticAway(Math.max(0, awayPoints - (awayPoints > homePoints ? 1 : 0)));
      }
      return api.scoreboardUndoLast(selectedMatchId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] }),
    onError: () => { setOptimisticHome(null); setOptimisticAway(null); },
  });

  const formatMut = useMutation({
    mutationFn: (bo: 3 | 5) => api.setMatchFormat(selectedMatchId, bo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const finalizeMut = useMutation({
    mutationFn: () => api.finalizeMatch(selectedMatchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/stats-touch/init", selectedMatchId, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: "Match Finalized!", description: "Stats synced, Player of Match computed, notifications sent." });
    },
    onError: (err: any) => toast({ title: "Finalize Failed", description: err.message, variant: "destructive" }),
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

    if (selectedAction === "SERVE" && detail.value === "ACE") {
      try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch (_) {}
      toast({
        title: "🎆 ACE! 🎆",
        description: `${selectedPlayer?.firstName || ""} ${selectedPlayer?.lastName || ""} served an ace!`,
      });
      const scoreboard = document.querySelector('[data-testid="scoreboard-area"]');
      if (scoreboard) {
        scoreboard.classList.add("ace-flash");
        setTimeout(() => scoreboard.classList.remove("ace-flash"), 1200);
      }
    }

    eventMut.mutate({
      playerId: selectedPlayerId,
      action: selectedAction,
      outcome: detail.outcome,
      outcomeDetail: detail.value,
      combinationType: combo,
      pointSide,
    });

    if (pointSide === "home" && servingTeam === "away") {
      setRotationOrder(prev => prev.length >= 6 ? [...prev.slice(1), prev[0]] : prev);
      setServingTeam("home");
    } else if (pointSide === "away" && servingTeam === "home") {
      setServingTeam("away");
    }

    setSelectedAction(null);
    setShowCombo(false);
    setPendingSetEvent(null);
  }, [selectedPlayerId, selectedAction, selectedMatchId, selectedTeamId, selectedPlayer, eventMut, servingTeam]);

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

  useEffect(() => {
    if (players.length > 0 && selectedMatchId) {
      setSubsUsedPerSet({});
      setTimeoutsUsedPerSet({});
      setShowSubForm(false);
      setSubOutId("");
      setSubInId("");
    }
  }, [selectedMatchId, players.length]);

  useEffect(() => {
    setShowSubForm(false);
    setSubOutId("");
    setSubInId("");
  }, [currentSet]);

  function makeSubstitution() {
    if (!subOutId || !subInId) return;
    const outPlayer = players.find((p: any) => p.id === subOutId);
    const inPlayer = players.find((p: any) => p.id === subInId);
    const currSubs = subsUsedPerSet[currentSet] || 0;
    const isLiberoSwap = outPlayer?.isLibero || inPlayer?.isLibero;
    if (!isLiberoSwap && currSubs >= 6) {
      toast({ title: "Substitution limit reached", description: "FIVB allows max 6 substitutions per set (libero swaps excluded).", variant: "destructive" });
      return;
    }
    setRotationOrder(prev => prev.map(id => id === subOutId ? subInId : id));
    if (!isLiberoSwap) {
      setSubsUsedPerSet(prev => ({ ...prev, [currentSet]: (prev[currentSet] || 0) + 1 }));
    }
    setShowSubForm(false);
    setSubOutId("");
    setSubInId("");
    toast({
      title: isLiberoSwap ? "Libero swap done" : `Substitution ${(subsUsedPerSet[currentSet] || 0) + 1}/6`,
      description: `#${outPlayer?.jerseyNo} ${outPlayer?.firstName} → #${inPlayer?.jerseyNo} ${inPlayer?.firstName}`,
    });
  }

  function callTimeout() {
    const currTimeouts = timeoutsUsedPerSet[currentSet] || 0;
    if (currTimeouts >= 2) {
      toast({ title: "Timeout limit reached", description: "FIVB allows max 2 timeouts per set per team.", variant: "destructive" });
      return;
    }
    setTimeoutsUsedPerSet(prev => ({ ...prev, [currentSet]: (prev[currentSet] || 0) + 1 }));
    toast({ title: `Timeout called — Set ${currentSet}`, description: `${currTimeouts + 1}/2 timeouts used this set.` });
  }

  function rotateClockwise() {
    setRotationOrder(prev => prev.length >= 6 ? [...prev.slice(1), prev[0]] : prev);
  }

  const currentActionDetails = selectedAction ? (OUTCOME_DETAILS[selectedAction] || []) : [];

  const neededToWin = bestOf === 5 ? 3 : 2;
  const matchComplete = homeSets >= neededToWin || awaySets >= neededToWin;

  const Wrapper = fullscreen ? ({ children }: { children: React.ReactNode }) => <div className="min-h-screen bg-afrocat-bg p-4 pb-48">{children}</div> : Layout;

  return (
    <Wrapper>
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Afrocat Logo" className="w-10 h-10 object-contain" data-testid="img-touch-logo" />
              <div>
                <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-touch-title">
                  Enter Stats
                </h1>
                <p className="text-xs text-afrocat-muted">Player &rarr; Action &rarr; Detail</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {elapsedTime && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-afrocat-white-5 text-afrocat-muted text-[10px] font-bold" data-testid="text-elapsed-time">
                  <Clock className="w-3 h-3" /> {elapsedTime}
                </div>
              )}
              <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid="button-fullscreen">
                {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
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
                    {eligibleMatches.map((m: any) => {
                      const team = teams.find((t: any) => t.id === m.teamId);
                      const locked = !!(m.scoreLocked || m.statsEntered);
                      return (
                        <SelectItem key={m.id} value={m.id} data-testid={`select-touch-match-${m.id}`}>
                          {m.matchDate} - {team?.name || "?"} vs {m.opponent} {locked ? "(Finalized)" : ""}
                        </SelectItem>
                      );
                    })}
                    {eligibleMatches.length === 0 && (
                      <div className="px-3 py-2 text-xs text-afrocat-muted">No available matches.</div>
                    )}
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

        {selectedMatchId && matchData && !isLocked && (
          <div className="afrocat-card p-5" data-testid="format-selector">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-afrocat-muted uppercase tracking-wider">Match Format</h3>
              {scoringStarted && (
                <span className="text-[10px] text-afrocat-muted">Format locked after scoring starts</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => formatMut.mutate(3)}
                disabled={formatMut.isPending || scoringStarted}
                className={`p-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                  bestOf === 3
                    ? "border-afrocat-teal bg-afrocat-teal-soft text-afrocat-teal ring-1 ring-afrocat-teal"
                    : "border-afrocat-border bg-afrocat-white-3 text-afrocat-text hover:border-afrocat-teal/30"
                } ${scoringStarted ? "opacity-60 cursor-not-allowed" : ""}`}
                data-testid="button-format-bo3"
              >
                <div className="text-lg">Best of 3</div>
                <div className="text-[10px] opacity-70 mt-1">2 sets to win &bull; 25pt sets &bull; 15pt decider</div>
              </button>
              <button
                onClick={() => formatMut.mutate(5)}
                disabled={formatMut.isPending || scoringStarted}
                className={`p-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                  bestOf === 5
                    ? "border-afrocat-gold bg-afrocat-gold-soft text-afrocat-gold ring-1 ring-afrocat-gold"
                    : "border-afrocat-border bg-afrocat-white-3 text-afrocat-text hover:border-afrocat-gold/30"
                } ${scoringStarted ? "opacity-60 cursor-not-allowed" : ""}`}
                data-testid="button-format-bo5"
              >
                <div className="text-lg">Best of 5</div>
                <div className="text-[10px] opacity-70 mt-1">3 sets to win &bull; 25pt sets &bull; 15pt decider</div>
              </button>
            </div>
          </div>
        )}

        {selectedMatchId && matchData && (
          <div className="afrocat-card overflow-hidden" data-testid="scoreboard-area">
            <div className="bg-gradient-to-r from-afrocat-bg via-afrocat-card to-afrocat-bg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-gold">Live Scoreboard</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-afrocat-muted">Best of {bestOf}</span>
                  {matchData?.matchDurationMinutes && (
                    <span className="text-[10px] font-bold text-afrocat-muted" data-testid="text-match-duration">
                      Duration: {formatDuration(matchData.matchDurationMinutes)}
                    </span>
                  )}
                  {!matchComplete && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-teal" data-testid="text-current-set">Set {currentSet}</span>
                  )}
                  {matchComplete && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-green" data-testid="text-match-complete">MATCH COMPLETE</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="text-right">
                  <p className="font-display font-bold text-sm text-afrocat-text truncate" data-testid="text-home-team">{teamName}</p>
                  <div className="flex items-center justify-end gap-3 mt-1">
                    <span className="text-xs text-afrocat-muted">S</span>
                    <span className="text-lg font-black text-afrocat-teal" data-testid="text-home-sets">{homeSets}</span>
                    {!matchComplete && (
                      <>
                        <span className="text-xs text-afrocat-muted">P</span>
                        <span className="text-3xl font-black text-afrocat-text" data-testid="text-home-points">{homePoints}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-center px-3">
                  <span className="text-xs font-bold text-afrocat-muted">VS</span>
                </div>

                <div className="text-left">
                  <p className="font-display font-bold text-sm text-afrocat-text truncate" data-testid="text-away-team">{selectedMatch?.opponent || "Away"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {!matchComplete && (
                      <>
                        <span className="text-3xl font-black text-afrocat-text" data-testid="text-away-points">{awayPoints}</span>
                        <span className="text-xs text-afrocat-muted">P</span>
                      </>
                    )}
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
              </div>
            </div>
          </div>
        )}

        {selectedMatchId && matchData && isLocked && pomPlayer && (
          <div className="afrocat-card p-5 border-afrocat-gold/30" data-testid="player-of-match">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-afrocat-gold/30 to-afrocat-teal/30 flex items-center justify-center border-2 border-afrocat-gold/50">
                  {pomPlayer.photoUrl ? (
                    <img src={pomPlayer.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-afrocat-gold">{getInitials(pomPlayer.firstName, pomPlayer.lastName)}</span>
                  )}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-afrocat-gold flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-afrocat-gold mb-1">Player of the Match</div>
                <div className="font-display font-bold text-lg text-afrocat-text">
                  {pomPlayer.firstName} {pomPlayer.lastName}
                </div>
                <div className="text-xs text-afrocat-muted">
                  #{pomPlayer.jerseyNo} &bull; {pomPlayer.position || "-"}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMatchId && matchData && !matchComplete && (
          <div className="afrocat-card p-4" data-testid="fivb-compliance-panel">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-afrocat-teal">FIVB Match Tools — Set {currentSet}</span>
              <button
                onClick={() => setShowFivbPanel(v => !v)}
                className="text-[10px] text-afrocat-muted hover:text-afrocat-text flex items-center gap-1 cursor-pointer"
                data-testid="button-toggle-fivb-panel"
              >
                {showFivbPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showFivbPanel ? "Hide Rotation" : "Show Rotation"}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
                (subsUsedPerSet[currentSet] || 0) >= 6
                  ? "bg-afrocat-red-soft border-afrocat-red/30 text-afrocat-red"
                  : (subsUsedPerSet[currentSet] || 0) >= 5
                    ? "bg-afrocat-gold-soft border-afrocat-gold/30 text-afrocat-gold"
                    : "bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
              }`} data-testid="badge-subs-used">
                <UsersIcon size={13} className="shrink-0" />
                Subs: {subsUsedPerSet[currentSet] || 0}/6
                {!isLocked && (subsUsedPerSet[currentSet] || 0) < 6 && (
                  <button
                    onClick={() => setShowSubForm(v => !v)}
                    className="ml-1.5 underline text-afrocat-teal cursor-pointer"
                    data-testid="button-open-sub-form"
                  >{showSubForm ? "cancel" : "sub"}</button>
                )}
              </div>

              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
                (timeoutsUsedPerSet[currentSet] || 0) >= 2
                  ? "bg-afrocat-red-soft border-afrocat-red/30 text-afrocat-red"
                  : "bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
              }`} data-testid="badge-timeouts-used">
                <Clock size={13} className="shrink-0" />
                Timeouts: {timeoutsUsedPerSet[currentSet] || 0}/2
                {!isLocked && (timeoutsUsedPerSet[currentSet] || 0) < 2 && (
                  <button
                    onClick={callTimeout}
                    className="ml-1.5 underline text-afrocat-teal cursor-pointer"
                    data-testid="button-call-timeout"
                  >call</button>
                )}
              </div>
            </div>

            {showSubForm && !isLocked && (
              <div className="mt-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border space-y-3">
                <div className="text-xs font-bold text-afrocat-muted uppercase tracking-wider">Make Substitution</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-afrocat-muted block mb-1">Player Out (in rotation)</label>
                    <select
                      value={subOutId}
                      onChange={e => setSubOutId(e.target.value)}
                      className="w-full bg-afrocat-bg border border-afrocat-border text-afrocat-text text-xs rounded-lg px-2 py-1.5"
                      data-testid="select-sub-out"
                    >
                      <option value="">Select…</option>
                      {rotationOrder.filter(Boolean).map(pid => {
                        const p = players.find((pl: any) => pl.id === pid);
                        return p ? (
                          <option key={pid} value={pid}>
                            #{p.jerseyNo} {p.firstName} {p.lastName}{p.isLibero ? " (L)" : ""}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-afrocat-muted block mb-1">Player In (from bench)</label>
                    <select
                      value={subInId}
                      onChange={e => setSubInId(e.target.value)}
                      className="w-full bg-afrocat-bg border border-afrocat-border text-afrocat-text text-xs rounded-lg px-2 py-1.5"
                      data-testid="select-sub-in"
                    >
                      <option value="">Select…</option>
                      {players.filter((p: any) => !rotationOrder.includes(p.id)).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNo} {p.firstName} {p.lastName}{p.isLibero ? " (L)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={makeSubstitution}
                    disabled={!subOutId || !subInId}
                    className="bg-afrocat-teal text-white text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer hover:bg-afrocat-teal/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="button-confirm-sub"
                  >Confirm Sub</button>
                  <button
                    onClick={() => { setShowSubForm(false); setSubOutId(""); setSubInId(""); }}
                    className="text-xs text-afrocat-muted px-3 py-1.5 rounded-lg cursor-pointer hover:text-afrocat-text border border-afrocat-border"
                  >Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                servingTeam === "home"
                  ? "bg-afrocat-teal-soft border-afrocat-teal/30 text-afrocat-teal"
                  : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted"
              }`} data-testid="badge-serving-team">
                <span>⟳</span>
                {servingTeam === "home" ? `${teamName} Serving` : `${selectedMatch?.opponent || "OPP"} Serving`}
              </div>
              {!isLocked && (
                <button
                  onClick={() => setServingTeam(s => s === "home" ? "away" : "home")}
                  className="text-[10px] text-afrocat-muted hover:text-afrocat-teal cursor-pointer underline"
                  data-testid="button-toggle-serve"
                >
                  toggle serve
                </button>
              )}
            </div>

            {showFivbPanel && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-afrocat-muted uppercase tracking-wider">Court Rotation (P1 = Server)</span>
                  {!isLocked && (
                    <button
                      onClick={rotateClockwise}
                      className="flex items-center gap-1 text-[10px] font-bold text-afrocat-teal hover:text-afrocat-teal/80 cursor-pointer px-2 py-1 rounded bg-afrocat-teal-soft"
                      data-testid="button-rotate-clockwise"
                    >
                      <RotateCw size={11} /> Rotate (side-out)
                    </button>
                  )}
                </div>
                <div className="text-[9px] text-center text-afrocat-muted tracking-widest opacity-50">— NET —</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[4, 3, 2].map(pos => {
                    const pid = rotationOrder[pos - 1];
                    const p = players.find((pl: any) => pl.id === pid);
                    return (
                      <div key={pos} className="p-2 rounded-lg border bg-afrocat-teal-soft border-afrocat-teal/20 text-center" data-testid={`rotation-pos-${pos}`}>
                        <div className="text-[9px] font-bold text-afrocat-teal">P{pos}</div>
                        {p ? (
                          <>
                            <div className="text-sm font-black text-afrocat-text leading-none mt-0.5">#{p.jerseyNo}</div>
                            <div className="text-[9px] text-afrocat-muted truncate mt-0.5">{p.firstName}</div>
                            {p.isLibero && <div className="text-[8px] font-bold text-afrocat-gold">LIB</div>}
                          </>
                        ) : (
                          <div className="text-[10px] text-afrocat-muted mt-1">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[5, 6, 1].map(pos => {
                    const pid = rotationOrder[pos - 1];
                    const p = players.find((pl: any) => pl.id === pid);
                    const isServer = pos === 1;
                    return (
                      <div key={pos} className={`p-2 rounded-lg border text-center ${isServer ? "bg-afrocat-gold-soft border-afrocat-gold/40" : "bg-afrocat-white-5 border-afrocat-border"}`} data-testid={`rotation-pos-${pos}`}>
                        <div className={`text-[9px] font-bold ${isServer ? "text-afrocat-gold" : "text-afrocat-muted"}`}>{isServer ? "P1 ⟳" : `P${pos}`}</div>
                        {p ? (
                          <>
                            <div className="text-sm font-black text-afrocat-text leading-none mt-0.5">#{p.jerseyNo}</div>
                            <div className="text-[9px] text-afrocat-muted truncate mt-0.5">{p.firstName}</div>
                            {p.isLibero && <div className="text-[8px] font-bold text-afrocat-gold">LIB</div>}
                          </>
                        ) : (
                          <div className="text-[10px] text-afrocat-muted mt-1">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[9px] text-center text-afrocat-muted tracking-widest opacity-50">— SERVICE ZONE —</div>
                {!isLocked && players.length >= 6 && rotationOrder.length < 6 && (
                  <button
                    onClick={() => {
                      const nonLibero = [...players].filter((p: any) => !p.isLibero).slice(0, 6);
                      setRotationOrder(nonLibero.map((p: any) => p.id));
                    }}
                    className="w-full text-xs text-afrocat-muted border border-dashed border-afrocat-border rounded-lg py-2 hover:text-afrocat-teal cursor-pointer"
                    data-testid="button-auto-fill-rotation"
                  >Auto-fill rotation from squad</button>
                )}
              </div>
            )}
          </div>
        )}

        {selectedMatchId && !initLoading && players.length > 0 && !isLocked && !lineupConfirmed && (
          <div className="afrocat-card p-5 space-y-4" data-testid="lineup-picker">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-afrocat-text uppercase tracking-wider">Set Starting Lineup</h3>
                <p className="text-[11px] text-afrocat-muted mt-0.5">
                  {activePos !== null
                    ? `Tap a player below to fill Position ${activePos}${activePos === 1 ? " (first server)" : ""}`
                    : "Tap a position on the court to edit it"}
                </p>
              </div>
              <span className={`text-2xl font-black ${lineupDraft.filter(Boolean).length === 6 ? "text-afrocat-teal" : "text-afrocat-muted"}`}>
                {lineupDraft.filter(Boolean).length}/6
              </span>
            </div>

            {/* Court diagram — always visible */}
            <div className="rounded-2xl border border-afrocat-border bg-afrocat-white-3 p-3 space-y-1.5">
              <div className="text-[9px] text-center font-bold text-afrocat-muted tracking-widest opacity-60 mb-1">— NET (OPPONENT SIDE) —</div>
              {/* Front row: P4, P3, P2 */}
              <div className="grid grid-cols-3 gap-2">
                {[4, 3, 2].map(pos => {
                  const pid = lineupDraft[pos - 1];
                  const p = pid ? players.find((pl: any) => pl.id === pid) : null;
                  const isActive = activePos === pos;
                  return (
                    <button
                      key={pos}
                      onClick={() => {
                        if (pid) {
                          setLineupDraft(prev => { const d = [...prev]; d[pos - 1] = null; return d; });
                          setActivePos(pos);
                        } else {
                          setActivePos(pos);
                        }
                      }}
                      className={`relative rounded-xl border-2 p-2 text-center transition-all cursor-pointer min-h-[72px] flex flex-col items-center justify-center ${
                        isActive
                          ? "border-afrocat-teal ring-2 ring-afrocat-teal/40 bg-afrocat-teal-soft"
                          : pid
                            ? "border-afrocat-teal/40 bg-afrocat-white-5 hover:border-afrocat-teal/60"
                            : "border-dashed border-afrocat-border bg-afrocat-white-3 hover:border-afrocat-teal/40"
                      }`}
                      data-testid={`court-pos-${pos}`}
                    >
                      <div className="text-[9px] font-bold text-afrocat-teal mb-1">P{pos}</div>
                      {p ? (
                        <>
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-afrocat-teal/30 mb-1" />
                            : <div className="w-8 h-8 rounded-full bg-afrocat-white-5 border border-afrocat-teal/30 flex items-center justify-center text-[10px] font-bold text-afrocat-muted mb-1">{getInitials(p.firstName, p.lastName)}</div>
                          }
                          <div className="text-[10px] font-bold text-afrocat-text leading-tight">#{p.jerseyNo}</div>
                          <div className="text-[9px] text-afrocat-muted truncate w-full text-center">{p.firstName}</div>
                        </>
                      ) : (
                        <div className={`text-xl font-black ${isActive ? "text-afrocat-teal" : "text-afrocat-border"}`}>+</div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Back row: P5, P6, P1 */}
              <div className="grid grid-cols-3 gap-2">
                {[5, 6, 1].map(pos => {
                  const pid = lineupDraft[pos - 1];
                  const p = pid ? players.find((pl: any) => pl.id === pid) : null;
                  const isActive = activePos === pos;
                  const isServer = pos === 1;
                  return (
                    <button
                      key={pos}
                      onClick={() => {
                        if (pid) {
                          setLineupDraft(prev => { const d = [...prev]; d[pos - 1] = null; return d; });
                          setActivePos(pos);
                        } else {
                          setActivePos(pos);
                        }
                      }}
                      className={`relative rounded-xl border-2 p-2 text-center transition-all cursor-pointer min-h-[72px] flex flex-col items-center justify-center ${
                        isActive
                          ? isServer
                            ? "border-afrocat-gold ring-2 ring-afrocat-gold/40 bg-afrocat-gold-soft"
                            : "border-afrocat-teal ring-2 ring-afrocat-teal/40 bg-afrocat-teal-soft"
                          : isServer
                            ? pid ? "border-afrocat-gold/60 bg-afrocat-gold-soft hover:border-afrocat-gold" : "border-dashed border-afrocat-gold/40 bg-afrocat-gold-soft/30 hover:border-afrocat-gold/60"
                            : pid ? "border-afrocat-teal/40 bg-afrocat-white-5 hover:border-afrocat-teal/60" : "border-dashed border-afrocat-border bg-afrocat-white-3 hover:border-afrocat-teal/40"
                      }`}
                      data-testid={`court-pos-${pos}`}
                    >
                      <div className={`text-[9px] font-bold mb-1 ${isServer ? "text-afrocat-gold" : "text-afrocat-teal"}`}>
                        {isServer ? "P1 ⟳ SERVE" : `P${pos}`}
                      </div>
                      {p ? (
                        <>
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt="" className={`w-8 h-8 rounded-full object-cover border mb-1 ${isServer ? "border-afrocat-gold/50" : "border-afrocat-teal/30"}`} />
                            : <div className={`w-8 h-8 rounded-full bg-afrocat-white-5 border flex items-center justify-center text-[10px] font-bold mb-1 ${isServer ? "border-afrocat-gold/50 text-afrocat-gold" : "border-afrocat-teal/30 text-afrocat-muted"}`}>{getInitials(p.firstName, p.lastName)}</div>
                          }
                          <div className="text-[10px] font-bold text-afrocat-text leading-tight">#{p.jerseyNo}</div>
                          <div className="text-[9px] text-afrocat-muted truncate w-full text-center">{p.firstName}</div>
                        </>
                      ) : (
                        <div className={`text-xl font-black ${isActive ? (isServer ? "text-afrocat-gold" : "text-afrocat-teal") : "text-afrocat-border"}`}>+</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] text-center font-bold text-afrocat-muted tracking-widest opacity-60 mt-1">— SERVICE ZONE (YOUR SIDE) —</div>
            </div>

            {/* Player pool — shows when a position is active */}
            {activePos !== null && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-afrocat-muted uppercase tracking-wider">
                  {lineupDraft.filter(Boolean).length === 6 ? "All positions filled" : `Assign to P${activePos} — tap a player:`}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {[...players]
                    .filter((p: any) => !lineupDraft.includes(p.id))
                    .sort((a: any, b: any) => (a.jerseyNo ?? 99) - (b.jerseyNo ?? 99))
                    .map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setLineupDraft(prev => {
                            const d = [...prev];
                            d[activePos - 1] = p.id;
                            return d;
                          });
                          const nextEmpty = [1, 2, 3, 4, 5, 6].find(pos => {
                            if (pos === activePos) return false;
                            const afterDraft = [...lineupDraft];
                            afterDraft[activePos - 1] = p.id;
                            return !afterDraft[pos - 1];
                          });
                          setActivePos(nextEmpty ?? null);
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl border border-afrocat-border bg-afrocat-white-3 hover:border-afrocat-teal hover:bg-afrocat-teal-soft transition-all cursor-pointer text-left"
                        data-testid={`pool-player-${p.id}`}
                      >
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-afrocat-teal/20" />
                          : <div className="w-9 h-9 rounded-full bg-afrocat-white-5 border border-afrocat-teal/20 flex items-center justify-center text-xs font-bold text-afrocat-muted shrink-0">{getInitials(p.firstName, p.lastName)}</div>
                        }
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-afrocat-text truncate">#{p.jerseyNo} {p.firstName}</div>
                          <div className="text-[9px] text-afrocat-muted truncate">{p.isLibero ? "Libero" : (p.position || "—")}</div>
                        </div>
                      </button>
                    ))
                  }
                  {lineupDraft.filter(Boolean).length === 6 && (
                    <div className="col-span-full text-center text-xs text-afrocat-muted py-2">
                      All 6 players assigned. Confirm or tap a position to swap.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Head Coach ── */}
            <div className="rounded-xl border border-afrocat-border bg-afrocat-white-3 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-afrocat-muted uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5" /> Head Coach
              </div>
              {assignedHeadCoach ? (
                <div className="flex items-center gap-2" data-testid="text-assigned-headcoach">
                  <div className="w-6 h-6 rounded-full bg-afrocat-teal-soft border border-afrocat-teal/30 flex items-center justify-center text-[9px] font-bold text-afrocat-teal">
                    {assignedHeadCoach.fullName.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-afrocat-text">{assignedHeadCoach.fullName}</span>
                  {assignedAsstCoach && (
                    <span className="text-[10px] text-afrocat-muted ml-2">+ {assignedAsstCoach.fullName} (asst.)</span>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <select
                    value={inlineCoachId}
                    onChange={e => setInlineCoachId(e.target.value)}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-afrocat-border bg-afrocat-white-5 text-afrocat-text"
                    data-testid="select-inline-headcoach"
                  >
                    <option value="">No coach assigned — select one</option>
                    {(staffUsers as any[]).filter((u: any) => u.isCoach).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!inlineCoachId || saveCoachMut.isPending}
                    onClick={() => inlineCoachId && saveCoachMut.mutate(inlineCoachId)}
                    className="px-3 py-1.5 rounded-lg bg-afrocat-teal text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-afrocat-teal/80 transition-colors"
                    data-testid="button-save-inline-coach"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* ── Who serves first? ── */}
            <div className="rounded-xl border border-afrocat-border bg-afrocat-white-3 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-afrocat-muted uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" /> Who Serves First?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServingTeam("home")}
                  className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    servingTeam === "home"
                      ? "border-afrocat-teal bg-afrocat-teal-soft text-afrocat-teal"
                      : "border-afrocat-border bg-afrocat-white-5 text-afrocat-muted hover:border-afrocat-teal/40"
                  }`}
                  data-testid="button-we-serve"
                >
                  🏐 {teamName} serves
                </button>
                <button
                  type="button"
                  onClick={() => setServingTeam("away")}
                  className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    servingTeam === "away"
                      ? "border-afrocat-gold bg-afrocat-gold-soft text-afrocat-gold"
                      : "border-afrocat-border bg-afrocat-white-5 text-afrocat-muted hover:border-afrocat-gold/40"
                  }`}
                  data-testid="button-they-serve"
                >
                  🛡️ {selectedMatch?.opponent || "Opponent"} serves (we receive)
                </button>
              </div>
              <p className="text-[10px] text-afrocat-muted">
                {servingTeam === "home"
                  ? `P1 (back-right) is your first server.`
                  : `${selectedMatch?.opponent || "Opponent"} serves first — your team receives to start.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => {
                  const draft = lineupDraft as (string | null)[];
                  if (draft.some(id => !id)) return;
                  const order = draft as string[];
                  setRotationOrder(order);
                  setLineupConfirmed(true);
                  setShowFivbPanel(true);
                  toast({
                    title: "Lineup Confirmed!",
                    description: servingTeam === "home"
                      ? `${teamName} serves first. P1 is your server.`
                      : `${selectedMatch?.opponent || "Opponent"} serves first — rotate after your first side-out.`,
                  });
                }}
                disabled={lineupDraft.filter(Boolean).length !== 6}
                className="flex-1 bg-afrocat-teal text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-afrocat-teal/80 transition-colors"
                data-testid="button-confirm-lineup"
              >
                Confirm Starting Lineup & Begin
              </button>
              <button
                onClick={() => {
                  const nonLibero = [...players].filter((p: any) => !p.isLibero).slice(0, 6);
                  const draft: (string | null)[] = [null, null, null, null, null, null];
                  nonLibero.forEach((p: any, i: number) => { draft[i] = p.id; });
                  setLineupDraft(draft);
                  setRotationOrder(draft.filter(Boolean) as string[]);
                  setLineupConfirmed(true);
                  setShowFivbPanel(true);
                  setActivePos(null);
                  toast({ title: "Auto-filled Lineup", description: "First 6 non-libero players set as starters." });
                }}
                className="px-4 py-2.5 rounded-xl border border-afrocat-border text-xs text-afrocat-muted hover:text-afrocat-teal cursor-pointer"
                data-testid="button-autofill-lineup"
              >
                Auto-fill
              </button>
            </div>
          </div>
        )}

        {selectedMatchId && !initLoading && players.length > 0 && !isLocked && lineupConfirmed && (
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
                          <div className="text-[10px] text-afrocat-muted">{p.position || "-"}</div>
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
                              {d.outcome === "PLUS" ? "+" : d.outcome === "MINUS" ? "-" : "0"}
                              {d.pointTo ? ` -> ${d.pointTo === "home" ? "us" : "opp"}` : ""}
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

            {allEvents.length > 0 && !isLocked && !matchComplete && (
              <div className="afrocat-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-afrocat-text text-sm" data-testid="text-sync-title">
                      Manual Finalize
                    </h3>
                    <p className="text-xs text-afrocat-muted mt-1">
                      If the match ended without reaching FIVB auto-end, you can manually finalize stats ({allEvents.length} events).
                    </p>
                  </div>
                  <button
                    onClick={() => finalizeMut.mutate()}
                    disabled={finalizeMut.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    data-testid="button-finalize-stats"
                  >
                    {finalizeMut.isPending ? (
                      <><Upload className="w-4 h-4 animate-spin" /> Finalizing...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Finalize Match</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {isLocked && allEvents.length > 0 && (
          <div className="space-y-3">
            <div className="afrocat-card p-4 flex items-center gap-3 border-afrocat-green/30">
              <CheckCircle2 className="w-5 h-5 text-afrocat-green shrink-0" />
              <p className="text-sm text-afrocat-green font-medium" data-testid="text-stats-synced">
                Stats have been synced to player records. Match is finalized.
                {matchData?.matchDurationMinutes && ` Duration: ${formatDuration(matchData.matchDurationMinutes)}`}
              </p>
            </div>
            <button
              onClick={() => setShowReport(!showReport)}
              className="w-full afrocat-card p-4 flex items-center justify-between hover:border-afrocat-teal/30 transition-all cursor-pointer"
              data-testid="button-toggle-report"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-afrocat-teal" />
                <span className="text-sm font-bold text-afrocat-text">Match Report</span>
              </div>
              {showReport ? <ChevronUp className="w-4 h-4 text-afrocat-muted" /> : <ChevronDown className="w-4 h-4 text-afrocat-muted" />}
            </button>

            {showReport && matchReport && (
              <div className="afrocat-card p-5 space-y-5" data-testid="match-report" id="match-report-printable">
                <div className="flex items-center justify-between pb-3 border-b border-afrocat-border">
                  <div>
                    <h2 className="font-display font-bold text-lg text-afrocat-text">
                      {matchReport.team?.name} vs {matchReport.match.opponent}
                    </h2>
                    <p className="text-xs text-afrocat-muted mt-1">
                      {matchReport.match.matchDate} | {matchReport.match.venue} | {matchReport.match.competition}
                      {matchReport.match.round ? ` - ${matchReport.match.round}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-afrocat-text">
                      {matchReport.match.homeSetsWon} - {matchReport.match.awaySetsWon}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      matchReport.match.result === "W" ? "bg-afrocat-green-soft text-afrocat-green" :
                      matchReport.match.result === "L" ? "bg-afrocat-red-soft text-afrocat-red" :
                      "bg-afrocat-white-5 text-afrocat-muted"
                    }`}>{matchReport.match.result === "W" ? "WIN" : matchReport.match.result === "L" ? "LOSS" : "N/A"}</span>
                  </div>
                </div>

                {matchReport.match.matchDurationMinutes && (
                  <div className="flex items-center gap-2 text-xs text-afrocat-muted">
                    <Clock className="w-3.5 h-3.5" /> Match Duration: {formatDuration(matchReport.match.matchDurationMinutes)}
                  </div>
                )}

                {Object.keys(matchReport.setBreakdown || {}).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-2">Set Breakdown</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(matchReport.setBreakdown).map(([setNum, data]: any) => (
                        <div key={setNum} className="afrocat-card p-2 text-center">
                          <div className="text-[10px] text-afrocat-muted">Set {setNum}</div>
                          <div className="font-bold text-sm text-afrocat-text">{data.homePoints} - {data.awayPoints}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(matchReport.staff || {}).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-2">Match Staff</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {matchReport.staff.headCoach && (
                        <div className="bg-afrocat-white-5 rounded-lg p-2">
                          <div className="text-afrocat-muted">Head Coach</div>
                          <div className="font-bold text-afrocat-text">{matchReport.staff.headCoach.firstName} {matchReport.staff.headCoach.lastName}</div>
                        </div>
                      )}
                      {matchReport.staff.assistantCoach && (
                        <div className="bg-afrocat-white-5 rounded-lg p-2">
                          <div className="text-afrocat-muted">Assistant Coach</div>
                          <div className="font-bold text-afrocat-text">{matchReport.staff.assistantCoach.firstName} {matchReport.staff.assistantCoach.lastName}</div>
                        </div>
                      )}
                      {matchReport.staff.medic && (
                        <div className="bg-afrocat-white-5 rounded-lg p-2">
                          <div className="text-afrocat-muted">Medic</div>
                          <div className="font-bold text-afrocat-text">{matchReport.staff.medic.firstName} {matchReport.staff.medic.lastName}</div>
                        </div>
                      )}
                      {matchReport.staff.teamManager && (
                        <div className="bg-afrocat-white-5 rounded-lg p-2">
                          <div className="text-afrocat-muted">Team Manager</div>
                          <div className="font-bold text-afrocat-text">{matchReport.staff.teamManager.firstName} {matchReport.staff.teamManager.lastName}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-afrocat-muted uppercase tracking-wider mb-3">Player Performance</h4>
                  <div className="space-y-2">
                    {matchReport.players.map((p: any) => (
                      <div key={p.id} className="bg-afrocat-white-3 rounded-xl border border-afrocat-border p-3" data-testid={`report-player-${p.id}`}>
                        <div className="flex items-center gap-3">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-afrocat-teal/20" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-afrocat-white-5 flex items-center justify-center text-sm font-bold text-afrocat-muted border border-afrocat-teal/20">
                              {getInitials(p.firstName, p.lastName)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-afrocat-text">#{p.jerseyNo} {p.firstName} {p.lastName}</span>
                              <span className="text-[10px] text-afrocat-muted">{p.position}</span>
                              {p.isLibero && <span className="text-[10px] px-1.5 py-0.5 rounded bg-afrocat-gold-soft text-afrocat-gold font-bold">L</span>}
                              {p.id === playerOfMatchPlayerId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-afrocat-gold text-white font-bold flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-white" /> POM</span>}
                            </div>
                            {p.stats ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px]">
                                <span className="text-afrocat-green font-bold">K:{p.stats.spikesKill}</span>
                                <span className="text-afrocat-teal font-bold">A:{p.stats.servesAce}</span>
                                <span className="text-afrocat-gold font-bold">B:{p.stats.blocksSolo + p.stats.blocksAssist}</span>
                                <span className="text-afrocat-green font-bold">D:{p.stats.digs}</span>
                                <span className="text-afrocat-teal font-bold">SA:{p.stats.settingAssist}</span>
                                <span className="text-afrocat-red">E:{(p.stats.spikesError || 0) + (p.stats.servesError || 0) + (p.stats.receiveError || 0) + (p.stats.settingError || 0)}</span>
                                <span className="font-black text-afrocat-text">Pts:{p.stats.pointsTotal}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-afrocat-muted mt-1">No stats recorded</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-afrocat-border flex items-center justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-white-10 text-afrocat-text border border-afrocat-border font-bold text-xs hover:bg-afrocat-white-5 cursor-pointer"
                    data-testid="button-print-report"
                  >
                    <Printer className="w-4 h-4" /> Print Screen
                  </button>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("token") || "";
                      window.open(`/api/matches/${selectedMatchId}/stats-report/print?token=${token}`, "_blank");
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-teal text-white font-bold text-xs hover:bg-afrocat-teal/90 cursor-pointer"
                    data-testid="button-download-pdf"
                  >
                    <FileText className="w-4 h-4" /> Download Stats PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedMatchId && !isLocked && (
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
                            {e.action}{e.outcomeDetail ? ` - ${e.outcomeDetail}` : ""} | {new Date(e.createdAt).toLocaleTimeString()}
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

        <div className="h-48" />
      </div>

      {selectedMatchId && matchData && !isLocked && !matchComplete && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-afrocat-bg/95 backdrop-blur-md border-t-2 border-afrocat-teal/30 p-3 safe-area-bottom" data-testid="point-pad">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <button
                onClick={() => pointMut.mutate({ side: "AFROCAT" })}
                className="min-h-[70px] rounded-xl bg-afrocat-teal text-white font-black text-lg tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer shadow-lg shadow-afrocat-teal/30"
                data-testid="button-point-afrocat"
              >
                <Plus className="w-6 h-6" />
                +1 {teamName.length > 12 ? "AFROCAT" : teamName.toUpperCase()}
              </button>
              <button
                onClick={() => pointMut.mutate({ side: "OPP" })}
                className="min-h-[70px] rounded-xl bg-afrocat-gold text-white font-black text-lg tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer shadow-lg shadow-afrocat-gold/30"
                data-testid="button-point-opp"
              >
                <Plus className="w-6 h-6" />
                +1 OPP
              </button>
              <button
                onClick={() => undoPointMut.mutate()}
                disabled={homePoints + awayPoints <= 0}
                className="min-h-[70px] w-16 rounded-xl bg-afrocat-white-10 text-afrocat-muted font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer disabled:opacity-30 border border-afrocat-border"
                data-testid="button-undo-point"
              >
                <Undo2 className="w-5 h-5" />
                UNDO
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => decrementMut.mutate({ side: "home" })}
                disabled={homePoints <= 0}
                className="h-10 rounded-lg bg-afrocat-white-5 border border-afrocat-teal/30 text-afrocat-teal font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="button-decrement-home"
              >
                <Minus className="w-4 h-4" />
                -1 {teamName.length > 12 ? "AFROCAT" : teamName.toUpperCase()}
              </button>
              <button
                onClick={() => decrementMut.mutate({ side: "away" })}
                disabled={awayPoints <= 0}
                className="h-10 rounded-lg bg-afrocat-white-5 border border-afrocat-gold/30 text-afrocat-gold font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="button-decrement-away"
              >
                <Minus className="w-4 h-4" />
                -1 OPP
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrapper>
  );
}