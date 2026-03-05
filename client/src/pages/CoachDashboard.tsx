import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle2, AlertCircle, Target, Zap, Shield, Hand,
  TrendingDown, Brain, Activity, BarChart3, CalendarCheck, DollarSign,
  Plus, Trash2, ChevronDown, ChevronUp, Users, Calendar, MapPin, Clock
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

type Tab = "overview" | "stats" | "weakness" | "training" | "attendance" | "finance";

function StatusBadge({ status }: { status: string }) {
  if (status === "RED") return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-xs"><AlertTriangle className="w-3 h-3" /> RED</span>;
  if (status === "YELLOW") return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold text-xs"><AlertCircle className="w-3 h-3" /> YELLOW</span>;
  return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-bold text-xs"><CheckCircle2 className="w-3 h-3" /> GREEN</span>;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ dateTimeStart: "", dateTimeEnd: "", venue: "", notes: "", targetGender: "" });

  const { data: myTeams = [] } = useQuery({ queryKey: ["/api/coach/my-teams"], queryFn: api.getCoachMyTeams });
  const { data: allTeams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const teams = myTeams.length > 0 ? myTeams : allTeams;

  const teamMatches = (matches || []).filter((m: any) => m.teamId === selectedTeamId || m.homeTeamId === selectedTeamId);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["/api/coach/devstats/dashboard", selectedTeamId, selectedMatchId],
    queryFn: () => api.getCoachDevStatsDashboard(selectedTeamId, selectedMatchId),
    enabled: !!selectedMatchId && !!selectedTeamId,
  });

  const { data: performanceTrends = [] } = useQuery({
    queryKey: ["/api/coach/performance-trends", selectedTeamId],
    queryFn: () => api.getCoachPerformanceTrends(selectedTeamId),
    enabled: !!selectedTeamId,
  });

  const { data: attendanceTrends } = useQuery({
    queryKey: ["/api/coach/attendance-trends", selectedTeamId],
    queryFn: () => api.getCoachAttendanceTrends(selectedTeamId),
    enabled: !!selectedTeamId,
  });

  const { data: trainingSessions = [] } = useQuery({
    queryKey: ["/api/training/sessions", selectedTeamId],
    queryFn: () => api.getTrainingSessions(selectedTeamId),
    enabled: !!selectedTeamId,
  });

  const { data: financePayments = [] } = useQuery({
    queryKey: ["/api/finance/payments"],
    queryFn: () => api.getFinancePayments(),
    enabled: activeTab === "finance",
  });

  const alerts = dashboard?.dashboard || [];
  const teamSummary = dashboard?.teamSummary || null;
  const focusAreas = dashboard?.focus || [];

  const teamPlayers = (players || []).filter((p: any) => p.teamId === selectedTeamId);

  const createSessionMut = useMutation({
    mutationFn: (data: any) => api.createTrainingSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/sessions"] });
      toast({ title: "Session Scheduled" });
      setShowCreateSession(false);
      setSessionForm({ dateTimeStart: "", dateTimeEnd: "", venue: "", notes: "", targetGender: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSessionMut = useMutation({
    mutationFn: (id: string) => api.deleteTrainingSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/sessions"] });
      toast({ title: "Session Deleted" });
    },
  });

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedMatchId("");
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "stats", label: "Stats", icon: Target },
    { id: "weakness", label: "Player Weakness", icon: AlertTriangle },
    { id: "training", label: "Training", icon: Calendar },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "finance", label: "Finance", icon: DollarSign },
  ];

  return (
    <Layout>
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-5">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Afrocat" className="w-12 h-12 object-contain" />
            <div className="flex-1">
              <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-coach-dashboard-title">
                Coach Dashboard
              </h1>
              <p className="text-xs text-afrocat-muted">Multi-team performance, training, attendance & finance</p>
            </div>
          </div>
        </div>

        <div className="afrocat-card p-4">
          <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Select Team</label>
          <Select value={selectedTeamId} onValueChange={handleTeamChange}>
            <SelectTrigger data-testid="select-coach-team">
              <SelectValue placeholder="Choose a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTeamId && (
          <>
            <div className="afrocat-card p-1.5">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      activeTab === t.id
                        ? "bg-afrocat-teal text-white"
                        : "text-afrocat-muted hover:bg-afrocat-white-5"
                    }`}
                    data-testid={`tab-${t.id}`}
                  >
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="afrocat-card p-4 text-center">
                    <Users className="w-5 h-5 mx-auto text-afrocat-teal mb-1" />
                    <div className="text-2xl font-display font-bold text-afrocat-text">{teamPlayers.length}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase font-bold">Players</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <Calendar className="w-5 h-5 mx-auto text-afrocat-gold mb-1" />
                    <div className="text-2xl font-display font-bold text-afrocat-text">{teamMatches.length}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase font-bold">Matches</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <CalendarCheck className="w-5 h-5 mx-auto text-afrocat-green mb-1" />
                    <div className="text-2xl font-display font-bold text-afrocat-text">{trainingSessions.length}</div>
                    <div className="text-[10px] text-afrocat-muted uppercase font-bold">Sessions</div>
                  </div>
                  <div className="afrocat-card p-4 text-center">
                    <Activity className="w-5 h-5 mx-auto text-afrocat-teal mb-1" />
                    <div className="text-2xl font-display font-bold text-afrocat-text">
                      {(attendanceTrends?.monthlyTrends || []).length ? `${(attendanceTrends?.monthlyTrends || [])[((attendanceTrends?.monthlyTrends || []).length) - 1]?.percentage || 0}%` : "—"}
                    </div>
                    <div className="text-[10px] text-afrocat-muted uppercase font-bold">Attendance</div>
                  </div>
                </div>

                {performanceTrends.length > 0 && (
                  <div className="afrocat-card p-5">
                    <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Performance Trends (Last 5 Matches)</h3>
                    <div className="space-y-3">
                      {performanceTrends.map((t: any) => (
                        <div key={t.matchId} className="flex items-center gap-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-afrocat-text truncate">vs {t.opponent}</div>
                            <div className="text-[10px] text-afrocat-muted">{t.date}</div>
                          </div>
                          <div className="flex gap-3 text-center">
                            <div><div className="text-xs font-bold text-red-400">{t.serveErrorPct}%</div><div className="text-[9px] text-afrocat-muted">Srv Err</div></div>
                            <div><div className="text-xs font-bold text-green-400">{t.receivePerfectPct}%</div><div className="text-[9px] text-afrocat-muted">Recv+</div></div>
                            <div><div className="text-xs font-bold text-afrocat-teal">{t.attackEfficiency}%</div><div className="text-[9px] text-afrocat-muted">Atk Eff</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "stats" && (
              <div className="space-y-4">
                <div className="afrocat-card p-4">
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Select Match</label>
                  <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                    <SelectTrigger data-testid="select-dashboard-match">
                      <SelectValue placeholder="Select a match to analyze" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMatches.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.matchDate || m.date} — vs {m.opponent}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedMatchId && dashLoading && <div className="afrocat-card p-6 text-center text-afrocat-muted">Loading stats...</div>}

                {selectedMatchId && !dashLoading && teamSummary && (
                  <div className="afrocat-card p-5">
                    <h3 className="font-display font-bold text-afrocat-text text-sm mb-4">Team Performance Summary</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Target className="w-5 h-5 mx-auto text-afrocat-teal mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Serve</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.serve?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">Ace {teamSummary.serve?.acePct || 0}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Hand className="w-5 h-5 mx-auto text-afrocat-gold mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Receive</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.receive?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">Perfect {teamSummary.receive?.perfectPassPct || 0}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Zap className="w-5 h-5 mx-auto text-afrocat-gold mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Attack</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.attack?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">Eff {teamSummary.attack?.attackEfficiency || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Shield className="w-5 h-5 mx-auto text-afrocat-teal mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Block</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.block?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">+{teamSummary.block?.plusPct || 0}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Hand className="w-5 h-5 mx-auto text-afrocat-green mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Dig</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.dig?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">+{teamSummary.dig?.plusPct || 0}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
                        <Activity className="w-5 h-5 mx-auto text-afrocat-teal mb-1" />
                        <div className="text-xs font-bold text-afrocat-muted">Set</div>
                        <div className="text-sm font-bold text-afrocat-text">{teamSummary.set?.attempts || 0} att</div>
                        <div className="text-[10px] text-afrocat-green">+{teamSummary.set?.plusPct || 0}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "weakness" && (
              <div className="space-y-4">
                <div className="afrocat-card p-4">
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Select Match</label>
                  <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                    <SelectTrigger><SelectValue placeholder="Select a match" /></SelectTrigger>
                    <SelectContent>
                      {teamMatches.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.matchDate || m.date} — vs {m.opponent}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedMatchId && dashLoading && <div className="afrocat-card p-6 text-center text-afrocat-muted">Loading...</div>}

                {selectedMatchId && !dashLoading && alerts.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="afrocat-card p-3 text-center">
                        <div className="text-2xl font-display font-bold text-red-400">{alerts.filter((a: any) => a.status === "RED").length}</div>
                        <div className="text-[10px] font-bold text-afrocat-muted uppercase">Red</div>
                      </div>
                      <div className="afrocat-card p-3 text-center">
                        <div className="text-2xl font-display font-bold text-yellow-400">{alerts.filter((a: any) => a.status === "YELLOW").length}</div>
                        <div className="text-[10px] font-bold text-afrocat-muted uppercase">Yellow</div>
                      </div>
                      <div className="afrocat-card p-3 text-center">
                        <div className="text-2xl font-display font-bold text-green-400">{alerts.filter((a: any) => a.status === "GREEN").length}</div>
                        <div className="text-[10px] font-bold text-afrocat-muted uppercase">Green</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {alerts.map((a: any) => (
                        <div key={a.playerId} className="afrocat-card overflow-hidden" data-testid={`weakness-card-${a.playerId}`}>
                          <div
                            className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-afrocat-white-3 transition-all ${
                              a.status === "RED" ? "border-l-4 border-l-red-500" : a.status === "YELLOW" ? "border-l-4 border-l-yellow-500" : "border-l-4 border-l-green-500"
                            }`}
                            onClick={() => setExpandedPlayer(expandedPlayer === a.playerId ? null : a.playerId)}
                          >
                            <div className="flex-1">
                              <div className="font-bold text-sm text-afrocat-text">{a.playerName} <span className="text-afrocat-muted font-normal">#{a.jerseyNo}</span></div>
                              <div className="text-[10px] text-afrocat-muted mt-0.5">{(a.reasons || []).slice(0, 3).join(" • ") || "All clear"}</div>
                            </div>
                            <StatusBadge status={a.status} />
                            {expandedPlayer === a.playerId ? <ChevronUp className="w-4 h-4 text-afrocat-muted" /> : <ChevronDown className="w-4 h-4 text-afrocat-muted" />}
                          </div>
                          {expandedPlayer === a.playerId && (
                            <div className="border-t border-afrocat-border p-4 bg-afrocat-white-3 space-y-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-2 rounded-lg bg-afrocat-card border border-afrocat-border text-center">
                                  <div className="text-xs text-afrocat-muted">Serve Err%</div>
                                  <div className="text-sm font-bold text-afrocat-text">{a.keyMetrics?.serveErrorPct ?? "—"}</div>
                                </div>
                                <div className="p-2 rounded-lg bg-afrocat-card border border-afrocat-border text-center">
                                  <div className="text-xs text-afrocat-muted">Recv -%</div>
                                  <div className="text-sm font-bold text-afrocat-text">{a.keyMetrics?.receiveMinusPct ?? "—"}</div>
                                </div>
                                <div className="p-2 rounded-lg bg-afrocat-card border border-afrocat-border text-center">
                                  <div className="text-xs text-afrocat-muted">Atk Eff</div>
                                  <div className="text-sm font-bold text-afrocat-text">{a.keyMetrics?.attackEfficiency ?? "—"}</div>
                                </div>
                                <div className="p-2 rounded-lg bg-afrocat-card border border-afrocat-border text-center">
                                  <div className="text-xs text-afrocat-muted">Dec Err</div>
                                  <div className="text-sm font-bold text-afrocat-text">{a.keyMetrics?.decisionErrors ?? "—"}</div>
                                </div>
                              </div>
                              {focusAreas.find((f: any) => f.playerId === a.playerId) && (
                                <div>
                                  <div className="text-xs font-bold text-afrocat-teal uppercase mb-1.5 flex items-center gap-1"><Brain className="w-3 h-3" /> Training Focus</div>
                                  <ul className="space-y-1">
                                    {(focusAreas.find((f: any) => f.playerId === a.playerId)?.focusAreas || []).map((area: string, i: number) => (
                                      <li key={i} className="text-xs text-afrocat-muted flex items-start gap-1.5">
                                        <TrendingDown className="w-3 h-3 mt-0.5 text-afrocat-teal shrink-0" /> {area}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "training" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 cursor-pointer"
                    data-testid="button-new-training-session"
                  >
                    <Plus className="w-4 h-4" /> Schedule Session
                  </button>
                </div>

                {trainingSessions.length === 0 && (
                  <div className="afrocat-card p-8 text-center text-afrocat-muted text-sm">No training sessions scheduled yet.</div>
                )}

                {trainingSessions.map((s: any) => (
                  <div key={s.id} className="afrocat-card p-4" data-testid={`session-card-${s.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-afrocat-teal-soft flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-afrocat-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-afrocat-text">
                          {s.dateTimeStart ? new Date(s.dateTimeStart).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-afrocat-muted mt-0.5">
                          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {s.dateTimeStart ? new Date(s.dateTimeStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                          {s.venue && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {s.venue}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.targetGender === "FEMALE" ? "bg-pink-500/20 text-pink-400" :
                        s.targetGender === "MALE" ? "bg-blue-500/20 text-blue-400" :
                        "bg-afrocat-teal-soft text-afrocat-teal"
                      }`}>{s.targetGender}</span>
                      <button
                        onClick={() => { if (confirm("Delete session?")) deleteSessionMut.mutate(s.id); }}
                        className="p-2 rounded-lg hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {s.notes && <p className="text-xs text-afrocat-muted mt-2 ml-13">{s.notes}</p>}
                  </div>
                ))}

                {showCreateSession && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-md p-6 space-y-4">
                      <h3 className="font-display font-bold text-lg text-afrocat-text">Schedule Training Session</h3>
                      <div>
                        <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Date & Time</label>
                        <input type="datetime-local" value={sessionForm.dateTimeStart} onChange={(e) => setSessionForm({ ...sessionForm, dateTimeStart: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-session-datetime" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">End Time (optional)</label>
                        <input type="datetime-local" value={sessionForm.dateTimeEnd} onChange={(e) => setSessionForm({ ...sessionForm, dateTimeEnd: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Venue</label>
                        <input type="text" value={sessionForm.venue} onChange={(e) => setSessionForm({ ...sessionForm, venue: e.target.value })} placeholder="e.g. Main Hall"
                          className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Gender (auto-set by day)</label>
                        <Select value={sessionForm.targetGender} onValueChange={(v) => setSessionForm({ ...sessionForm, targetGender: v })}>
                          <SelectTrigger><SelectValue placeholder="Auto (by day rule)" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AUTO">Auto (by day rule)</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="ALL">All</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Notes</label>
                        <textarea value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} rows={2}
                          className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none" />
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowCreateSession(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
                        <button
                          onClick={() => {
                            if (!sessionForm.dateTimeStart) return toast({ title: "Date required", variant: "destructive" });
                            createSessionMut.mutate({
                              teamId: selectedTeamId,
                              dateTimeStart: sessionForm.dateTimeStart,
                              dateTimeEnd: sessionForm.dateTimeEnd || undefined,
                              venue: sessionForm.venue || undefined,
                              notes: sessionForm.notes || undefined,
                              targetGender: sessionForm.targetGender === "AUTO" ? undefined : sessionForm.targetGender || undefined,
                            });
                          }}
                          disabled={createSessionMut.isPending}
                          className="px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50"
                          data-testid="button-save-session"
                        >
                          {createSessionMut.isPending ? "Saving..." : "Schedule"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "attendance" && (
              <div className="space-y-4">
                {(attendanceTrends?.monthlyTrends || []).length > 0 ? (
                  <>
                    <div className="afrocat-card p-5">
                      <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Monthly Attendance %</h3>
                      <div className="space-y-2">
                        {(attendanceTrends?.monthlyTrends || []).map((t: any) => (
                          <div key={t.month} className="flex items-center gap-3">
                            <div className="w-16 text-xs text-afrocat-muted font-bold">{t.month}</div>
                            <div className="flex-1 h-6 bg-afrocat-white-5 rounded-full overflow-hidden">
                              <div className="h-full bg-afrocat-teal rounded-full transition-all" style={{ width: `${t.percentage}%` }} />
                            </div>
                            <div className="w-10 text-right text-xs font-bold text-afrocat-text">{t.percentage}%</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="afrocat-card p-5">
                        <h3 className="font-display font-bold text-sm text-afrocat-text mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" /> Top Attendees
                        </h3>
                        <div className="space-y-2">
                          {(attendanceTrends.topAttendees || []).map((p: any, i: number) => (
                            <div key={p.playerId} className="flex items-center gap-2 text-sm">
                              <span className="w-5 text-xs text-afrocat-muted font-bold">{i + 1}.</span>
                              <span className="flex-1 text-afrocat-text font-bold">{p.playerName}</span>
                              <span className="text-xs text-green-400 font-bold">{p.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="afrocat-card p-5">
                        <h3 className="font-display font-bold text-sm text-afrocat-text mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" /> Low Attendance
                        </h3>
                        <div className="space-y-2">
                          {(attendanceTrends.lowAttendees || []).map((p: any, i: number) => (
                            <div key={p.playerId} className="flex items-center gap-2 text-sm">
                              <span className="w-5 text-xs text-afrocat-muted font-bold">{i + 1}.</span>
                              <span className="flex-1 text-afrocat-text font-bold">{p.playerName}</span>
                              <span className="text-xs text-red-400 font-bold">{p.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="afrocat-card p-8 text-center text-afrocat-muted text-sm">No attendance data for this team yet.</div>
                )}
              </div>
            )}

            {activeTab === "finance" && (
              <div className="space-y-4">
                <div className="afrocat-card p-5">
                  <h3 className="font-display font-bold text-sm text-afrocat-text mb-3">Team Player Balances</h3>
                  {teamPlayers.length === 0 && <p className="text-sm text-afrocat-muted">No players in this team.</p>}
                  <div className="space-y-2">
                    {teamPlayers.map((p: any) => {
                      const playerPaymentsList = (financePayments || []).filter((pay: any) => pay.playerId === p.id);
                      const approved = playerPaymentsList.filter((pay: any) => pay.status === "APPROVED");
                      const totalPaid = approved.reduce((s: number, pay: any) => s + (pay.amount || 0), 0);
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-afrocat-text">{p.firstName} {p.lastName}</div>
                            <div className="text-[10px] text-afrocat-muted">#{p.jerseyNo} • {p.employmentClass || "NON_WORKING"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-afrocat-green">N${totalPaid}</div>
                            <div className="text-[10px] text-afrocat-muted">Paid</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}