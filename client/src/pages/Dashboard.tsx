import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Trophy, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  Target, AlertTriangle, Zap, TrendingUp, Calendar, Award,
  User, Shield, Heart, CheckCircle, Clock, XCircle, AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

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

  const totalIncome = financeTxns.filter((f: any) => f.type === "INCOME").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const totalExpense = financeTxns.filter((f: any) => f.type === "EXPENSE").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const openInjuries = injuries.filter((i: any) => i.status === "OPEN").length;
  const wins = matches.filter((m: any) => m.result === "W").length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Dashboard</h1>
          <p className="text-afrocat-muted mt-1">Welcome back, {user?.fullName}</p>
        </div>

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
              <div className="text-2xl font-bold font-display text-afrocat-text" data-testid="text-match-record">{wins} - {matches.length - wins}</div>
              <p className="text-xs text-afrocat-teal font-medium mt-1">{matches.length > 0 ? (wins / matches.length * 100).toFixed(0) : 0}% Win Rate</p>
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

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && matches.length > 0 && (
          <div className="afrocat-card p-5">
            <h3 className="font-bold text-afrocat-text mb-4">Recent Matches</h3>
            <div className="space-y-4">
              {matches.slice(0, 5).map((match: any) => {
                const team = teams.find((t: any) => t.id === match.teamId);
                return (
                  <div key={match.id} className="flex items-center justify-between border-b border-afrocat-border last:border-0 pb-4 last:pb-0" data-testid={`row-recent-match-${match.id}`}>
                    <div>
                      <p className="font-semibold text-afrocat-text">{team?.name || "Team"} vs {match.opponent}</p>
                      <p className="text-sm text-afrocat-muted">{match.matchDate} &bull; {match.competition}</p>
                    </div>
                    {match.result && (
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`}>
                        {match.result} ({match.setsFor} - {match.setsAgainst})
                      </div>
                    )}
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
                  <h2 className="text-xl font-display font-bold text-afrocat-text">{playerDash.player?.fullName}</h2>
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
                  </div>
                </div>
              </div>
            </div>

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
