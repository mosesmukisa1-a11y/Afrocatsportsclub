import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Trophy, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  Target, AlertTriangle, Zap, TrendingUp, Calendar, Award
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

  const totalIncome = financeTxns.filter((f: any) => f.type === "INCOME").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const totalExpense = financeTxns.filter((f: any) => f.type === "EXPENSE").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const openInjuries = injuries.filter((i: any) => i.status === "OPEN").length;
  const wins = matches.filter((m: any) => m.result === "W").length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-ac-text tracking-tight">Dashboard</h1>
          <p className="text-ac-muted mt-1">Welcome back, {user?.fullName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-ac-muted">Total Players</span>
                <Users className="h-4 w-4 text-ac-muted" />
              </div>
              <div className="text-2xl font-bold font-display text-ac-text" data-testid="text-total-players">{players.length}</div>
              <p className="text-xs text-ac-muted mt-1">Across {teams.length} teams</p>
            </div>
          )}

          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-ac-muted">Match Record</span>
                <Trophy className="h-4 w-4 text-ac-teal" />
              </div>
              <div className="text-2xl font-bold font-display text-ac-text" data-testid="text-match-record">{wins} - {matches.length - wins}</div>
              <p className="text-xs text-ac-teal font-medium mt-1">{matches.length > 0 ? (wins / matches.length * 100).toFixed(0) : 0}% Win Rate</p>
            </div>
          )}

          {user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-ac-muted">Net Finance</span>
                <DollarSign className="h-4 w-4 text-ac-muted" />
              </div>
              <div className="text-2xl font-bold font-display text-ac-text" data-testid="text-net-finance">${totalIncome - totalExpense}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center text-xs text-ac-green font-medium"><ArrowUpRight className="h-3 w-3 mr-1" />${totalIncome}</span>
                <span className="flex items-center text-xs text-ac-red font-medium"><ArrowDownRight className="h-3 w-3 mr-1" />${totalExpense}</span>
              </div>
            </div>
          )}

          {user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) && (
            <div className="afrocat-card p-5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-ac-muted">Open Injuries</span>
                <Activity className={`h-4 w-4 ${openInjuries > 0 ? 'text-ac-red' : 'text-ac-muted'}`} />
              </div>
              <div className="text-2xl font-bold font-display text-ac-text" data-testid="text-open-injuries">{openInjuries}</div>
              <p className="text-xs text-ac-muted mt-1">Players needing clearance</p>
            </div>
          )}
        </div>

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && matches.length > 0 && (
          <div className="afrocat-card p-5">
            <h3 className="font-bold text-ac-text mb-4">Recent Matches</h3>
            <div className="space-y-4">
              {matches.slice(0, 5).map((match: any) => {
                const team = teams.find((t: any) => t.id === match.teamId);
                return (
                  <div key={match.id} className="flex items-center justify-between border-b border-ac-border last:border-0 pb-4 last:pb-0" data-testid={`row-recent-match-${match.id}`}>
                    <div>
                      <p className="font-semibold text-ac-text">{team?.name || "Team"} vs {match.opponent}</p>
                      <p className="text-sm text-ac-muted">{match.matchDate} &bull; {match.competition}</p>
                    </div>
                    {match.result && (
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-ac-green-soft text-ac-green' : 'bg-ac-red-soft text-ac-red'}`}>
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
              <h2 className="text-xl font-display font-bold text-ac-text">Performance Insights</h2>
              {teams.length > 1 && (
                <Select value={teamIdForCoach} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-[200px] bg-ac-card border-ac-border text-ac-text" data-testid="select-dashboard-team">
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
                  <h3 className="flex items-center gap-2 text-base font-bold text-ac-text mb-3">
                    <Trophy className="h-4 w-4 text-ac-gold" /> Top Performers
                  </h3>
                  {(coachDash.topPerformers || []).length === 0 ? (
                    <p className="text-sm text-ac-muted">No stats recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.topPerformers.map((p: any, i: number) => (
                        <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-top-performer-${i}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-ac-gold-soft text-ac-gold text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="font-medium text-sm text-ac-text">{p.name}</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ac-gold-soft text-ac-gold">{p.pointsTotal} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ac-text mb-3">
                    <AlertTriangle className="h-4 w-4 text-ac-red" /> Error Leaders
                  </h3>
                  {(coachDash.errorLeaders || []).length === 0 ? (
                    <p className="text-sm text-ac-muted">No error data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.errorLeaders.map((p: any, i: number) => (
                        <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-error-leader-${i}`}>
                          <span className="font-medium text-sm text-ac-text">{p.name}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ac-red-soft text-ac-red">{p.totalErrors} errors</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="afrocat-card p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ac-text mb-3">
                    <Target className="h-4 w-4 text-ac-teal" /> Smart Focus Highlights
                  </h3>
                  {(coachDash.smartFocusHighlights || []).length === 0 ? (
                    <p className="text-sm text-ac-muted">No focus areas identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {coachDash.smartFocusHighlights.map((f: any, i: number) => (
                        <div key={i} className="flex items-center justify-between" data-testid={`row-focus-area-${i}`}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-ac-teal" />
                            <span className="font-medium text-sm text-ac-text">{f.area}</span>
                          </div>
                          <span className="text-xs text-ac-muted">{f.count} player{f.count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {coachDash.latestMatchTotals && Object.keys(coachDash.latestMatchTotals).length > 0 && (
                  <div className="afrocat-card p-5 md:col-span-2 lg:col-span-3">
                    <h3 className="flex items-center gap-2 text-base font-bold text-ac-text mb-4">
                      <TrendingUp className="h-4 w-4 text-ac-teal" /> Latest Match Team Totals
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                      {[
                        { label: "Points", value: coachDash.latestMatchTotals.pointsTotal, icon: Trophy, cls: "text-ac-gold" },
                        { label: "Kills", value: coachDash.latestMatchTotals.spikesKill, icon: Zap, cls: "text-ac-teal" },
                        { label: "Aces", value: coachDash.latestMatchTotals.servesAce, icon: Target, cls: "text-ac-teal" },
                        { label: "Blocks", value: (coachDash.latestMatchTotals.blocksSolo || 0) + (coachDash.latestMatchTotals.blocksAssist || 0), icon: Activity, cls: "text-ac-gold" },
                        { label: "Digs", value: coachDash.latestMatchTotals.digs, icon: Award, cls: "text-ac-teal" },
                        { label: "Errors", value: (coachDash.latestMatchTotals.spikesError || 0) + (coachDash.latestMatchTotals.servesError || 0) + (coachDash.latestMatchTotals.receiveError || 0) + (coachDash.latestMatchTotals.settingError || 0), icon: AlertTriangle, cls: "text-ac-red" },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-3 rounded-xl bg-ac-white-3" data-testid={`stat-team-${item.label.toLowerCase()}`}>
                          <item.icon className={`h-4 w-4 mx-auto mb-1 ${item.cls}`} />
                          <div className={`text-xl font-bold font-display ${item.cls}`}>{item.value || 0}</div>
                          <div className="text-xs text-ac-muted">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isPlayerView && (
          <div className="afrocat-card p-5">
            <h3 className="flex items-center gap-2 font-bold text-ac-text mb-2">
              <Calendar className="h-5 w-5 text-ac-teal" /> Your Portal
            </h3>
            <p className="text-ac-muted">Welcome to your player dashboard. Your stats, attendance records, and awards are accessible from the sidebar.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
