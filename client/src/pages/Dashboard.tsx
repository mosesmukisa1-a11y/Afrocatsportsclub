import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Trophy, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  Target, AlertTriangle, Zap, TrendingUp, Calendar, Award,
  User, Shield, Heart, CheckCircle, Clock, XCircle, AlertCircle,
  FileText, Bell, ChevronRight, MessageCircle, Cake, PartyPopper, Gift, Scale
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const isCoachView = !!user && ["ADMIN","MANAGER","COACH"].includes(user.role);
  const isPlayerView = user?.role === "PLAYER";

  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers, enabled: !!user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams, enabled: !!user && user.role !== "PLAYER" });
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches, enabled: !!user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) });
  const { data: injuries = [] } = useQuery({ queryKey: ["/api/injuries"], queryFn: api.getInjuries, enabled: !!user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) });
  const { data: financeTxns = [] } = useQuery({ queryKey: ["/api/finance"], queryFn: api.getFinanceTxns, enabled: !!user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) });

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const teamIdForCoach = selectedTeamId || (teams.length > 0 ? teams[0].id : "");

  const { data: coachDash } = useQuery({
    queryKey: ["/api/dashboard/coach/summary", teamIdForCoach],
    queryFn: () => api.getCoachDashboard(teamIdForCoach),
    enabled: isCoachView && !!teamIdForCoach,
  });

  const playerDashId = user?.playerId || "";
  const { data: playerDash } = useQuery({
    queryKey: ["/api/players/dashboard", playerDashId],
    queryFn: () => api.getPlayerDashboard(playerDashId),
    enabled: isPlayerView && !!playerDashId,
  });

  const { data: birthdays = [] } = useQuery({
    queryKey: ["/api/birthdays"],
    queryFn: api.getBirthdays,
    enabled: !!user,
  });

  const { data: trainingSchedule } = useQuery({
    queryKey: ["/api/training/my-schedule"],
    queryFn: api.getMyTrainingSchedule,
    enabled: isPlayerView && !!user,
  });

  const { data: attendanceReport } = useQuery({
    queryKey: ["/api/training/attendance-report"],
    queryFn: () => api.getAttendanceReport(),
    enabled: isPlayerView && !!user,
  });

  const { data: coachTrainingSummary = [] } = useQuery({
    queryKey: ["/api/training/coach-summary", teamIdForCoach],
    queryFn: () => api.getCoachTrainingSummary(teamIdForCoach),
    enabled: isCoachView && !!teamIdForCoach,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: api.getNotifications,
    enabled: !!user,
  });

  const { data: clubContractStatus } = useQuery({
    queryKey: ["/api/contract/status"],
    queryFn: api.getClubContractStatus,
    enabled: !!user,
  });

  const { data: weightStatus } = useQuery({
    queryKey: ["/api/players/me/weight-status"],
    queryFn: api.getWeightStatus,
    enabled: isPlayerView && !!user,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const checkinMut = useMutation({
    mutationFn: (sessionId: string) => api.attendanceCheckIn(sessionId),
    onSuccess: () => {
      toast({ title: "Checked In!", description: "Your attendance has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/training/my-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/attendance-report"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const autoGenMut = useMutation({
    mutationFn: api.autoGenerateTraining,
    onSuccess: (data: any) => {
      toast({ title: "Training Sessions Generated", description: `${data.generated} sessions created for this week.` });
      queryClient.invalidateQueries({ queryKey: ["/api/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unreadNotifs = notifications.filter((n: any) => !n.read);

  const totalIncome = financeTxns.filter((f: any) => f.type === "INCOME").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const totalExpense = financeTxns.filter((f: any) => f.type === "EXPENSE").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const openInjuries = injuries.filter((i: any) => i.status === "OPEN").length;
  const playedMatches = matches.filter((m: any) => m.status === "PLAYED");
  const wins = playedMatches.filter((m: any) => m.result === "W").length;

  const recentPlayedMatches = [...playedMatches]
    .sort((a: any, b: any) => new Date(b.startTime || b.matchDate).getTime() - new Date(a.startTime || a.matchDate).getTime())
    .slice(0, 5);

  const upcomingMatches = matches
    .filter((m: any) => m.status === "UPCOMING")
    .sort((a: any, b: any) => new Date(a.startTime || a.matchDate).getTime() - new Date(b.startTime || b.matchDate).getTime())
    .slice(0, 5);

  const getCountdownLabel = (dateStr: string) => {
    const now = new Date();
    const target = new Date(dateStr);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `in ${diffDays} days`;
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Dashboard</h1>
          <p className="text-afrocat-muted mt-1">Welcome back, {user?.fullName}</p>
        </div>

        {clubContractStatus && !clubContractStatus.accepted && (
          <div className="afrocat-card border border-afrocat-gold/30 overflow-hidden" data-testid="card-contract-warning">
            <div className="bg-afrocat-gold-soft px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-afrocat-gold shrink-0" />
                <div>
                  <p className="font-bold text-sm text-afrocat-text">Club Contract Not Confirmed</p>
                  <p className="text-xs text-afrocat-muted">Please read and confirm the official Afrocat Volleyball Club contract.</p>
                </div>
              </div>
              <Link href="/club-contract">
                <span className="px-4 py-2 rounded-lg bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/80 transition-colors cursor-pointer" data-testid="link-confirm-contract">
                  Confirm Contract
                </span>
              </Link>
            </div>
          </div>
        )}

        {isPlayerView && weightStatus?.isOverdue && (
          <div className="afrocat-card border border-afrocat-gold/30 overflow-hidden" data-testid="card-weight-update-warning">
            <div className="bg-afrocat-gold-soft px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-afrocat-gold shrink-0" />
                <div>
                  <p className="font-bold text-sm text-afrocat-text" data-testid="text-weight-update-title">Weight Update Required</p>
                  <p className="text-xs text-afrocat-muted" data-testid="text-weight-update-message">Please update your weight for {weightStatus.quarterKey}</p>
                </div>
              </div>
              <Link href="/profile-setup">
                <span className="px-4 py-2 rounded-lg bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/80 transition-colors cursor-pointer" data-testid="link-update-weight">
                  Update Weight
                </span>
              </Link>
            </div>
          </div>
        )}

        {birthdays.length > 0 && (
          <div className="afrocat-card overflow-hidden" data-testid="card-birthdays">
            <div className="bg-gradient-to-r from-afrocat-gold-soft via-afrocat-teal-soft to-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold" data-testid="text-birthdays-title">
                <Cake className="h-5 w-5" /> Birthday Celebrations
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {birthdays.filter((b: any) => b.isToday).length > 0 && (
                <div className="space-y-3">
                  {birthdays.filter((b: any) => b.isToday).map((b: any) => (
                    <div key={b.playerId} className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-afrocat-gold-soft to-afrocat-teal-soft border border-afrocat-gold/30 animate-in fade-in slide-in-from-left-4 duration-500" data-testid={`card-birthday-today-${b.playerId}`}>
                      <div className="relative shrink-0">
                        {b.photoUrl ? (
                          <img src={b.photoUrl} alt={`${b.firstName} ${b.lastName}`} className="w-14 h-14 rounded-full object-cover border-2 border-afrocat-gold" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-afrocat-gold-soft flex items-center justify-center border-2 border-afrocat-gold text-lg font-bold text-afrocat-gold">
                            {(b.firstName?.[0] || "")}{(b.lastName?.[0] || "")}
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1 text-lg">🎂</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-afrocat-text text-lg">{b.firstName} {b.lastName}</span>
                          <PartyPopper className="h-5 w-5 text-afrocat-gold" />
                        </div>
                        <p className="text-sm text-afrocat-gold font-semibold mt-0.5">
                          Happy Birthday! Turning {b.turningAge} today! 🎉
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-afrocat-muted">
                          {b.jerseyNo && <span>#{b.jerseyNo}</span>}
                          {b.position && <span>{b.position}</span>}
                          {b.teamName && <span>{b.teamName}</span>}
                        </div>
                      </div>
                      <Gift className="h-8 w-8 text-afrocat-gold shrink-0 opacity-60" />
                    </div>
                  ))}
                </div>
              )}
              {birthdays.filter((b: any) => !b.isToday).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-2">Upcoming This Week</p>
                  <div className="space-y-2">
                    {birthdays.filter((b: any) => !b.isToday).map((b: any) => (
                      <div key={b.playerId} className="flex items-center gap-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`card-birthday-upcoming-${b.playerId}`}>
                        <div className="shrink-0">
                          {b.photoUrl ? (
                            <img src={b.photoUrl} alt={`${b.firstName} ${b.lastName}`} className="w-10 h-10 rounded-full object-cover border border-afrocat-border" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-afrocat-white-5 flex items-center justify-center border border-afrocat-border text-sm font-bold text-afrocat-muted">
                              {(b.firstName?.[0] || "")}{(b.lastName?.[0] || "")}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm text-afrocat-text">{b.firstName} {b.lastName}</span>
                          <div className="flex items-center gap-2 text-xs text-afrocat-muted">
                            {b.teamName && <span>{b.teamName}</span>}
                            {b.position && <span>{b.position}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge className="bg-afrocat-teal-soft text-afrocat-teal border-0 text-xs" data-testid={`badge-birthday-days-${b.playerId}`}>
                            {b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                          </Badge>
                          <p className="text-[10px] text-afrocat-muted mt-0.5">Turning {b.turningAge}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-afrocat-muted">Total Players</span>
                <Users className="h-4 w-4 text-afrocat-muted" />
              </div>
              <div className="text-2xl font-bold font-display text-afrocat-text" data-testid="text-total-players">{players.length}</div>
              <p className="text-xs text-afrocat-muted mt-1">Across {teams.length} teams</p>
            </div>
          )}

          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-afrocat-muted">Match Record</span>
                <Trophy className="h-4 w-4 text-afrocat-teal" />
              </div>
              <div className="text-2xl font-bold font-display text-afrocat-text" data-testid="text-match-record">{wins} - {playedMatches.length - wins}</div>
              <p className="text-xs text-afrocat-teal font-medium mt-1" data-testid="text-win-rate">{playedMatches.length > 0 ? (wins / playedMatches.length * 100).toFixed(0) : 0}% Win Rate</p>
            </div>
          )}

          {user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-afrocat-muted">Net Finance</span>
                <DollarSign className="h-4 w-4 text-afrocat-muted" />
              </div>
              <div className="text-2xl font-bold font-display text-afrocat-text" data-testid="text-net-finance">${totalIncome - totalExpense}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center text-xs text-afrocat-green font-medium"><ArrowUpRight className="h-3 w-3 mr-1" />${totalIncome}</span>
                <span className="flex items-center text-xs text-afrocat-red font-medium"><ArrowDownRight className="h-3 w-3 mr-1" />${totalExpense}</span>
              </div>
            </div>
          )}

          {user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-afrocat-muted">Open Injuries</span>
                <Activity className={`h-4 w-4 ${openInjuries > 0 ? 'text-afrocat-red' : 'text-afrocat-muted'}`} />
              </div>
              <div className="text-2xl font-bold font-display text-afrocat-text" data-testid="text-open-injuries">{openInjuries}</div>
              <p className="text-xs text-afrocat-muted mt-1">Players needing clearance</p>
            </div>
          )}
        </div>

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && recentPlayedMatches.length > 0 && (
          <div className="afrocat-card p-5" data-testid="card-recent-matches">
            <h3 className="font-bold text-afrocat-text mb-4" data-testid="text-recent-matches-title">Recent Matches</h3>
            <div className="space-y-4">
              {recentPlayedMatches.map((match: any) => {
                const team = teams.find((t: any) => t.id === match.teamId);
                return (
                  <div key={match.id} className="flex items-center justify-between border-b border-afrocat-border last:border-0 pb-4 last:pb-0" data-testid={`row-recent-match-${match.id}`}>
                    <div>
                      <p className="font-semibold text-afrocat-text" data-testid={`text-recent-match-opponent-${match.id}`}>{team?.name || "Team"} vs {match.opponent}</p>
                      <p className="text-sm text-afrocat-muted" data-testid={`text-recent-match-date-${match.id}`}>{match.matchDate} &bull; {match.competition}</p>
                    </div>
                    {match.result && (
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`} data-testid={`badge-recent-match-result-${match.id}`}>
                        {match.result} ({match.setsFor} - {match.setsAgainst})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && upcomingMatches.length > 0 && (
          <div className="afrocat-card p-5" data-testid="card-upcoming-matches">
            <h3 className="flex items-center gap-2 font-bold text-afrocat-teal mb-4" data-testid="text-upcoming-matches-title">
              <Calendar className="h-5 w-5 text-afrocat-teal" /> Upcoming Matches
            </h3>
            <div className="space-y-4">
              {upcomingMatches.map((match: any) => {
                const team = teams.find((t: any) => t.id === match.teamId);
                const matchDateTime = new Date(match.startTime || match.matchDate);
                const dateStr = matchDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = match.startTime ? matchDateTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : "";
                const countdown = getCountdownLabel(match.startTime || match.matchDate);
                return (
                  <div key={match.id} className="flex items-center justify-between border-b border-afrocat-teal/10 last:border-0 pb-4 last:pb-0" data-testid={`row-upcoming-match-${match.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-afrocat-teal-soft flex items-center justify-center shrink-0" data-testid={`icon-upcoming-match-${match.id}`}>
                        <Calendar className="h-5 w-5 text-afrocat-teal" />
                      </div>
                      <div>
                        <p className="font-semibold text-afrocat-text" data-testid={`text-upcoming-match-opponent-${match.id}`}>{team?.name || "Team"} vs {match.opponent}</p>
                        <p className="text-sm text-afrocat-muted" data-testid={`text-upcoming-match-details-${match.id}`}>
                          {dateStr}{timeStr ? ` • ${timeStr}` : ""} • {match.venue}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-afrocat-teal-soft text-afrocat-teal border-0 font-bold text-xs" data-testid={`badge-upcoming-match-countdown-${match.id}`}>
                      {countdown}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCoachView && teams.length > 0 && (
          <>
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-bold text-afrocat-text">Performance Insights</h2>
              {teams.length > 1 && (
                <Select value={teamIdForCoach} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-[200px] bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-dashboard-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {coachDash && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="afrocat-card p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-3">
                    <Trophy className="h-4 w-4 text-afrocat-gold" /> Top Performers
                  </h3>
                  {(coachDash.topPerformers || []).length === 0 ? (
                    <p className="text-sm text-afrocat-muted">No stats recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.topPerformers.map((p: any, i: number) => (
                        <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-top-performer-${i}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-afrocat-gold-soft text-afrocat-gold text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="font-medium text-sm text-afrocat-text">{p.name}</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold">{p.pointsTotal} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-3">
                    <AlertTriangle className="h-4 w-4 text-afrocat-red" /> Error Leaders
                  </h3>
                  {(coachDash.errorLeaders || []).length === 0 ? (
                    <p className="text-sm text-afrocat-muted">No error data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.errorLeaders.map((p: any, i: number) => (
                        <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-error-leader-${i}`}>
                          <span className="font-medium text-sm text-afrocat-text">{p.name}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-afrocat-red-soft text-afrocat-red">{p.totalErrors} errors</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-3">
                    <Target className="h-4 w-4 text-afrocat-teal" /> Smart Focus Highlights
                  </h3>
                  {(coachDash.smartFocusHighlights || []).length === 0 ? (
                    <p className="text-sm text-afrocat-muted">No focus areas identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.smartFocusHighlights.map((f: any, i: number) => (
                        <div key={i} className="flex items-center justify-between" data-testid={`row-focus-area-${i}`}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-afrocat-teal" />
                            <span className="font-medium text-sm text-afrocat-text">{f.area}</span>
                          </div>
                          <span className="text-xs text-afrocat-muted">{f.count} player{f.count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {coachDash.latestMatchTotals && Object.keys(coachDash.latestMatchTotals).length > 0 && (
                  <div className="afrocat-card p-5 md:col-span-2 lg:col-span-3">
                    <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-4">
                      <TrendingUp className="h-4 w-4 text-afrocat-teal" /> Latest Match Team Totals
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                      {[
                        { label: "Points", value: coachDash.latestMatchTotals.pointsTotal, icon: Trophy, cls: "text-afrocat-gold" },
                        { label: "Kills", value: coachDash.latestMatchTotals.spikesKill, icon: Zap, cls: "text-afrocat-teal" },
                        { label: "Aces", value: coachDash.latestMatchTotals.servesAce, icon: Target, cls: "text-afrocat-teal" },
                        { label: "Blocks", value: (coachDash.latestMatchTotals.blocksSolo || 0) + (coachDash.latestMatchTotals.blocksAssist || 0), icon: Activity, cls: "text-afrocat-gold" },
                        { label: "Digs", value: coachDash.latestMatchTotals.digs, icon: Award, cls: "text-afrocat-teal" },
                        { label: "Errors", value: (coachDash.latestMatchTotals.spikesError || 0) + (coachDash.latestMatchTotals.servesError || 0) + (coachDash.latestMatchTotals.receiveError || 0) + (coachDash.latestMatchTotals.settingError || 0), icon: AlertTriangle, cls: "text-afrocat-red" },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-3 rounded-xl bg-afrocat-white-3" data-testid={`stat-team-${item.label.toLowerCase()}`}>
                          <item.icon className={`h-4 w-4 mx-auto mb-1 ${item.cls}`} />
                          <div className={`text-xl font-bold font-display ${item.cls}`}>{item.value || 0}</div>
                          <div className="text-xs text-afrocat-muted">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isCoachView && matches.length > 0 && (
          <div className="afrocat-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text">
                <Bell className="h-4 w-4 text-afrocat-gold" /> Timely Reports
              </h3>
              <a href="/reports" className="flex items-center gap-1 text-xs text-afrocat-teal hover:underline cursor-pointer" data-testid="link-all-reports">
                View All Reports <ChevronRight className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-3">
              {matches.slice(0, 5).map((match: any) => {
                const team = teams.find((t: any) => t.id === match.teamId);
                const daysAgo = Math.floor((Date.now() - new Date(match.matchDate).getTime()) / (1000 * 60 * 60 * 24));
                const isRecent = daysAgo <= 7;
                return (
                  <div key={match.id} className="flex items-center justify-between border-b border-afrocat-border last:border-0 pb-3 last:pb-0" data-testid={`row-report-${match.id}`}>
                    <div className="flex items-center gap-3">
                      <FileText className={`h-4 w-4 shrink-0 ${isRecent ? 'text-afrocat-gold' : 'text-afrocat-muted'}`} />
                      <div>
                        <p className="font-medium text-sm text-afrocat-text">{team?.name || "Team"} vs {match.opponent}</p>
                        <p className="text-xs text-afrocat-muted">{match.matchDate} &bull; {match.competition}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {match.result && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${match.result === 'W' ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`}>
                          {match.result}
                        </span>
                      )}
                      {isRecent && (
                        <Badge className="bg-afrocat-gold-soft text-afrocat-gold border-0 text-[10px]">New</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCoachView && (
          <div className="afrocat-card overflow-hidden" data-testid="card-coach-training">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
                  <Calendar className="h-5 w-5 text-afrocat-teal" /> Today's Training
                </h3>
                <button
                  onClick={() => autoGenMut.mutate()}
                  disabled={autoGenMut.isPending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-afrocat-teal-soft text-afrocat-teal hover:bg-afrocat-teal/20 transition-colors"
                  data-testid="button-auto-generate-training"
                >
                  {autoGenMut.isPending ? "Generating..." : "Auto-Generate Week"}
                </button>
              </div>
            </div>
            <div className="p-5">
              {coachTrainingSummary.length === 0 ? (
                <p className="text-sm text-afrocat-muted text-center py-4">No training sessions scheduled for today. Use "Auto-Generate Week" to create sessions based on the training schedule.</p>
              ) : (
                <div className="space-y-4">
                  {coachTrainingSummary.map((s: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`card-training-summary-${i}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-sm text-afrocat-text">{s.session?.teamName}</h4>
                          <p className="text-xs text-afrocat-muted">{s.session?.sessionType} — {s.session?.sessionDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-green-soft text-afrocat-green" data-testid={`text-present-count-${i}`}>
                            {s.present + s.late} / {s.totalPlayers} checked in
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-afrocat-green-soft">
                          <div className="text-lg font-bold text-afrocat-green">{s.present}</div>
                          <div className="text-[10px] text-afrocat-muted">Present</div>
                        </div>
                        <div className="p-2 rounded-lg bg-afrocat-gold-soft">
                          <div className="text-lg font-bold text-afrocat-gold">{s.late}</div>
                          <div className="text-[10px] text-afrocat-muted">Late</div>
                        </div>
                        <div className="p-2 rounded-lg bg-afrocat-red-soft">
                          <div className="text-lg font-bold text-afrocat-red">{s.absent}</div>
                          <div className="text-[10px] text-afrocat-muted">Absent</div>
                        </div>
                        <div className="p-2 rounded-lg bg-afrocat-white-5">
                          <div className="text-lg font-bold text-afrocat-text">{s.totalPlayers}</div>
                          <div className="text-[10px] text-afrocat-muted">Total</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isPlayerView && trainingSchedule && (
          <div className="afrocat-card overflow-hidden" data-testid="card-player-training">
            <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal">
                <Calendar className="h-5 w-5" /> Training Schedule
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {trainingSchedule.trainingDays && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-afrocat-muted font-semibold uppercase">Your days:</span>
                  {trainingSchedule.trainingDays.map((d: string) => (
                    <Badge key={d} className="bg-afrocat-teal-soft text-afrocat-teal border-0 text-xs">{d}</Badge>
                  ))}
                </div>
              )}

              {trainingSchedule.todaySession && (
                <div className={`p-4 rounded-xl border ${trainingSchedule.todaySession.alreadyCheckedIn ? 'bg-afrocat-green-soft border-afrocat-green/30' : 'bg-afrocat-gold-soft border-afrocat-gold/30'}`} data-testid="card-today-training">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-afrocat-text flex items-center gap-2">
                        {trainingSchedule.todaySession.alreadyCheckedIn ? (
                          <CheckCircle className="h-4 w-4 text-afrocat-green" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-afrocat-gold" />
                        )}
                        Today's Training
                      </h4>
                      <p className="text-xs text-afrocat-muted mt-0.5">
                        {trainingSchedule.todaySession.teamName} — {trainingSchedule.todaySession.sessionDate}
                      </p>
                      {trainingSchedule.todaySession.alreadyCheckedIn && (
                        <p className="text-xs text-afrocat-green font-semibold mt-1">
                          Status: {trainingSchedule.todaySession.checkinStatus}
                        </p>
                      )}
                    </div>
                    {!trainingSchedule.todaySession.alreadyCheckedIn && (
                      <button
                        onClick={() => checkinMut.mutate(trainingSchedule.todaySession.id)}
                        disabled={checkinMut.isPending}
                        className="px-4 py-2 rounded-lg bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/80 transition-colors"
                        data-testid="button-checkin-today"
                      >
                        {checkinMut.isPending ? "Checking in..." : "Check In"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!trainingSchedule.todaySession && trainingSchedule.isTrainingDay && (
                <div className="p-4 rounded-xl bg-afrocat-gold-soft border border-afrocat-gold/30">
                  <p className="text-sm text-afrocat-gold font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    It's a training day but no session has been created yet. Contact your coach.
                  </p>
                </div>
              )}

              {trainingSchedule.pendingCheckin?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-2">Pending Check-in</p>
                  <div className="space-y-2">
                    {trainingSchedule.pendingCheckin.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-afrocat-red-soft border border-afrocat-red/20" data-testid={`card-pending-checkin-${s.id}`}>
                        <div>
                          <p className="text-sm font-medium text-afrocat-text">{s.teamName}</p>
                          <p className="text-xs text-afrocat-muted">{s.sessionDate}</p>
                        </div>
                        <button
                          onClick={() => checkinMut.mutate(s.id)}
                          disabled={checkinMut.isPending}
                          className="px-3 py-1.5 rounded-lg bg-afrocat-teal text-white font-bold text-xs"
                          data-testid={`button-checkin-${s.id}`}
                        >
                          Check In
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trainingSchedule.upcomingSessions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-2">Upcoming Sessions</p>
                  <div className="space-y-2">
                    {trainingSchedule.upcomingSessions.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-afrocat-teal" />
                          <div>
                            <p className="text-sm font-medium text-afrocat-text">{s.dayName}</p>
                            <p className="text-xs text-afrocat-muted">{s.date} — {s.teamName}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {attendanceReport && (
                <div>
                  <p className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-2">Attendance Report</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {attendanceReport.weekly && (
                      <div className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid="card-weekly-report">
                        <h5 className="text-xs font-bold text-afrocat-teal uppercase mb-2">This Week</h5>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div><div className="text-lg font-bold text-afrocat-green">{attendanceReport.weekly.present}</div><div className="text-[10px] text-afrocat-muted">Present</div></div>
                          <div><div className="text-lg font-bold text-afrocat-gold">{attendanceReport.weekly.late}</div><div className="text-[10px] text-afrocat-muted">Late</div></div>
                          <div><div className="text-lg font-bold text-afrocat-red">{attendanceReport.weekly.absent}</div><div className="text-[10px] text-afrocat-muted">Absent</div></div>
                          <div><div className="text-lg font-bold text-afrocat-teal">{attendanceReport.weekly.rate}%</div><div className="text-[10px] text-afrocat-muted">Rate</div></div>
                        </div>
                      </div>
                    )}
                    {attendanceReport.monthly && (
                      <div className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid="card-monthly-report">
                        <h5 className="text-xs font-bold text-afrocat-gold uppercase mb-2">This Month</h5>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div><div className="text-lg font-bold text-afrocat-green">{attendanceReport.monthly.present}</div><div className="text-[10px] text-afrocat-muted">Present</div></div>
                          <div><div className="text-lg font-bold text-afrocat-gold">{attendanceReport.monthly.late}</div><div className="text-[10px] text-afrocat-muted">Late</div></div>
                          <div><div className="text-lg font-bold text-afrocat-red">{attendanceReport.monthly.absent}</div><div className="text-[10px] text-afrocat-muted">Absent</div></div>
                          <div><div className="text-lg font-bold text-afrocat-teal">{attendanceReport.monthly.rate}%</div><div className="text-[10px] text-afrocat-muted">Rate</div></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isPlayerView && unreadNotifs.length > 0 && (
          <div className="afrocat-card overflow-hidden" data-testid="card-notifications">
            <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold">
                <Bell className="h-5 w-5" /> Notifications ({unreadNotifs.length})
              </h3>
            </div>
            <div className="p-5 space-y-2">
              {unreadNotifs.slice(0, 5).map((n: any) => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`card-notif-${n.id}`}>
                  <Bell className="h-4 w-4 text-afrocat-gold mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-afrocat-text">{n.title}</p>
                    <p className="text-xs text-afrocat-muted mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isPlayerView && playerDash && (
          <>
            <div className="afrocat-card p-5">
              <div className="flex items-center gap-4" data-testid="player-profile-header">
                <div className="w-16 h-16 rounded-full bg-afrocat-teal-soft flex items-center justify-center">
                  {playerDash.player?.photoUrl ? (
                    <img src={playerDash.player.photoUrl} alt={playerDash.player.fullName} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-afrocat-teal" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-display font-bold text-afrocat-text">{playerDash.player?.firstName} {playerDash.player?.lastName}</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {playerDash.player?.jerseyNo && (
                      <Badge className="bg-afrocat-gold-soft text-afrocat-gold border-0 font-bold" data-testid="badge-jersey">#{playerDash.player.jerseyNo}</Badge>
                    )}
                    {playerDash.player?.position && (
                      <Badge className="bg-afrocat-teal-soft text-afrocat-teal border-0" data-testid="badge-position">{playerDash.player.position}</Badge>
                    )}
                    {playerDash.player?.teamName && (
                      <Badge className="bg-afrocat-white-10 text-afrocat-text border-0" data-testid="badge-team">{playerDash.player.teamName}</Badge>
                    )}
                    {playerDash.player?.dob && (() => {
                      const birth = new Date(playerDash.player.dob);
                      const today = new Date();
                      let age = today.getFullYear() - birth.getFullYear();
                      const m = today.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                      return (
                        <Badge className="bg-afrocat-gold-soft text-afrocat-gold border-0" data-testid="badge-age">
                          Age: {age}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {(playerDash.motivationalMessages || []).length > 0 && (
              <div className="afrocat-card p-5" data-testid="player-motivational-messages">
                <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-3">
                  <MessageCircle className="h-4 w-4 text-afrocat-gold" /> Coach's Corner
                </h3>
                <div className="space-y-2">
                  {playerDash.motivationalMessages.map((msg: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-afrocat-white-3" data-testid={`motivational-msg-${i}`}>
                      <span className="text-sm text-afrocat-text" data-testid={`text-motivational-msg-${i}`}>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {playerDash.totals && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Points", value: playerDash.totals.pointsTotal || 0, icon: Trophy, cls: "text-afrocat-gold" },
                  { label: "Kills", value: playerDash.totals.spikesKill || 0, icon: Zap, cls: "text-afrocat-teal" },
                  { label: "Aces", value: playerDash.totals.servesAce || 0, icon: Target, cls: "text-afrocat-teal" },
                  { label: "Digs", value: playerDash.totals.digs || 0, icon: Shield, cls: "text-afrocat-gold" },
                ].map((item) => (
                  <div key={item.label} className="afrocat-card p-4 text-center" data-testid={`stat-player-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                    <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.cls}`} />
                    <div className={`text-2xl font-bold font-display ${item.cls}`}>{item.value}</div>
                    <div className="text-xs text-afrocat-muted">{item.label}</div>
                  </div>
                ))}
              </div>
            )}

            {(playerDash.recentStats || []).length > 0 && (
              <div className="afrocat-card p-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-4">
                  <TrendingUp className="h-4 w-4 text-afrocat-teal" /> Recent Match Stats
                </h3>
                <div className="space-y-3">
                  {playerDash.recentStats.slice(0, 5).map((stat: any, i: number) => (
                    <div key={stat.id || i} className="flex items-center justify-between border-b border-afrocat-border last:border-0 pb-3 last:pb-0" data-testid={`row-player-stat-${i}`}>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-afrocat-text">{stat.opponent || stat.matchDate || "Match"}</p>
                        <p className="text-xs text-afrocat-muted">{stat.matchDate}</p>
                      </div>
                      {stat.result && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold mr-3 ${stat.result === 'W' ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`}>
                          {stat.result}
                        </span>
                      )}
                      <div className="flex gap-3 text-xs text-afrocat-muted">
                        <span className="text-afrocat-gold font-bold">{stat.pointsTotal || 0} pts</span>
                        <span>K:{stat.spikesKill || 0}</span>
                        <span>A:{stat.servesAce || 0}</span>
                        <span>B:{(stat.blocksSolo || 0) + (stat.blocksAssist || 0)}</span>
                        <span>D:{stat.digs || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(playerDash.smartFocusHistory || []).length > 0 && (
              <div className="afrocat-card p-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-4">
                  <Target className="h-4 w-4 text-afrocat-teal" /> SmartFocus Recommendations
                </h3>
                <div className="space-y-3">
                  {playerDash.smartFocusHistory.slice(0, 5).map((focus: any, i: number) => (
                    <div key={focus.id || i} className="flex items-start gap-3 border-b border-afrocat-border last:border-0 pb-3 last:pb-0" data-testid={`row-smart-focus-${i}`}>
                      <Zap className="h-4 w-4 text-afrocat-teal mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-afrocat-text">{focus.focusArea || focus.area}</p>
                        {focus.recommendation && <p className="text-xs text-afrocat-muted mt-0.5">{focus.recommendation}</p>}
                        {focus.matchDate && <p className="text-xs text-afrocat-muted mt-0.5">{focus.matchDate}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {playerDash.attendanceSummary && (
                <div className="afrocat-card p-5" data-testid="player-attendance-summary">
                  <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-4">
                    <Calendar className="h-4 w-4 text-afrocat-teal" /> Attendance Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Present", value: playerDash.attendanceSummary.present || 0, icon: CheckCircle, cls: "text-afrocat-green", bg: "bg-afrocat-green-soft" },
                      { label: "Late", value: playerDash.attendanceSummary.late || 0, icon: Clock, cls: "text-afrocat-gold", bg: "bg-afrocat-gold-soft" },
                      { label: "Absent", value: playerDash.attendanceSummary.absent || 0, icon: XCircle, cls: "text-afrocat-red", bg: "bg-afrocat-red-soft" },
                      { label: "Excused", value: playerDash.attendanceSummary.excused || 0, icon: AlertCircle, cls: "text-afrocat-muted", bg: "bg-afrocat-white-5" },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-2 p-3 rounded-xl ${item.bg}`} data-testid={`attendance-${item.label.toLowerCase()}`}>
                        <item.icon className={`h-4 w-4 ${item.cls}`} />
                        <div>
                          <div className={`text-lg font-bold font-display ${item.cls}`}>{item.value}</div>
                          <div className="text-xs text-afrocat-muted">{item.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {playerDash.injuryStatus && (
                <div className="afrocat-card p-5" data-testid="player-injury-status">
                  <h3 className="flex items-center gap-2 text-base font-bold text-afrocat-text mb-4">
                    <Heart className={`h-4 w-4 ${playerDash.injuryStatus.hasOpenInjury ? 'text-afrocat-red' : 'text-afrocat-green'}`} /> Injury Status
                  </h3>
                  {playerDash.injuryStatus.hasOpenInjury ? (
                    <div className="p-3 rounded-xl bg-afrocat-red-soft">
                      <p className="font-medium text-sm text-afrocat-red">Active Injury</p>
                      {playerDash.injuryStatus.currentInjury && (
                        <>
                          <p className="text-xs text-afrocat-muted mt-1">{playerDash.injuryStatus.currentInjury.type}: {playerDash.injuryStatus.currentInjury.description}</p>
                          <p className="text-xs text-afrocat-muted mt-0.5">Since: {playerDash.injuryStatus.currentInjury.injuryDate}</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-afrocat-green-soft">
                      <p className="font-medium text-sm text-afrocat-green flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Fully Fit
                      </p>
                      <p className="text-xs text-afrocat-muted mt-1">No current injuries reported</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {isPlayerView && !playerDash && !playerDashId && (
          <div className="afrocat-card p-5">
            <h3 className="flex items-center gap-2 font-bold text-afrocat-text mb-2">
              <Calendar className="h-5 w-5 text-afrocat-teal" /> Your Portal
            </h3>
            <p className="text-afrocat-muted">Welcome to your player dashboard. Your stats, attendance records, and awards are accessible from the sidebar.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
