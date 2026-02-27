import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.fullName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-total-players">{players.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Across {teams.length} teams</p>
              </CardContent>
            </Card>
          )}

          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Match Record</CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-match-record">{wins} - {matches.length - wins}</div>
                <p className="text-xs text-primary font-medium mt-1">{matches.length > 0 ? (wins / matches.length * 100).toFixed(0) : 0}% Win Rate</p>
              </CardContent>
            </Card>
          )}

          {user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Finance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-net-finance">${totalIncome - totalExpense}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center text-xs text-green-600 font-medium"><ArrowUpRight className="h-3 w-3 mr-1" />${totalIncome}</span>
                  <span className="flex items-center text-xs text-red-600 font-medium"><ArrowDownRight className="h-3 w-3 mr-1" />${totalExpense}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Injuries</CardTitle>
                <Activity className={`h-4 w-4 ${openInjuries > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-open-injuries">{openInjuries}</div>
                <p className="text-xs text-muted-foreground mt-1">Players needing clearance</p>
              </CardContent>
            </Card>
          )}
        </div>

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && matches.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Matches</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matches.slice(0, 5).map((match: any) => {
                  const team = teams.find((t: any) => t.id === match.teamId);
                  return (
                    <div key={match.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0" data-testid={`row-recent-match-${match.id}`}>
                      <div>
                        <p className="font-semibold">{team?.name || "Team"} vs {match.opponent}</p>
                        <p className="text-sm text-muted-foreground">{match.matchDate} • {match.competition}</p>
                      </div>
                      {match.result && (
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {match.result} ({match.setsFor} - {match.setsAgainst})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {isCoachView && teams.length > 0 && (
          <>
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-bold">Performance Insights</h2>
              {teams.length > 1 && (
                <Select value={teamIdForCoach} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-dashboard-team">
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
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-4 w-4 text-amber-500" /> Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(coachDash.topPerformers || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No stats recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {coachDash.topPerformers.map((p: any, i: number) => (
                          <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-top-performer-${i}`}>
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="font-medium text-sm">{p.name}</span>
                            </div>
                            <Badge variant="secondary" className="font-bold">{p.pointsTotal} pts</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> Error Leaders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(coachDash.errorLeaders || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No error data available.</p>
                    ) : (
                      <div className="space-y-3">
                        {coachDash.errorLeaders.map((p: any, i: number) => (
                          <div key={p.playerId || i} className="flex items-center justify-between" data-testid={`row-error-leader-${i}`}>
                            <span className="font-medium text-sm">{p.name}</span>
                            <Badge variant="destructive" className="font-bold">{p.totalErrors} errors</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4 text-primary" /> Smart Focus Highlights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(coachDash.smartFocusHighlights || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No focus areas identified.</p>
                    ) : (
                      <div className="space-y-3">
                        {coachDash.smartFocusHighlights.map((f: any, i: number) => (
                          <div key={i} className="flex items-center justify-between" data-testid={`row-focus-area-${i}`}>
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{f.area}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{f.count} player{f.count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {coachDash.latestMatchTotals && Object.keys(coachDash.latestMatchTotals).length > 0 && (
                  <Card className="md:col-span-2 lg:col-span-3">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4 text-primary" /> Latest Match Team Totals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {[
                          { label: "Points", value: coachDash.latestMatchTotals.pointsTotal, icon: Trophy },
                          { label: "Kills", value: coachDash.latestMatchTotals.spikesKill, icon: Zap },
                          { label: "Aces", value: coachDash.latestMatchTotals.servesAce, icon: Target },
                          { label: "Blocks", value: (coachDash.latestMatchTotals.blocksSolo || 0) + (coachDash.latestMatchTotals.blocksAssist || 0), icon: Activity },
                          { label: "Digs", value: coachDash.latestMatchTotals.digs, icon: Award },
                          { label: "Errors", value: (coachDash.latestMatchTotals.spikesError || 0) + (coachDash.latestMatchTotals.servesError || 0) + (coachDash.latestMatchTotals.receiveError || 0) + (coachDash.latestMatchTotals.settingError || 0), icon: AlertTriangle },
                        ].map((item) => (
                          <div key={item.label} className="text-center p-3 rounded-lg bg-muted/30" data-testid={`stat-team-${item.label.toLowerCase()}`}>
                            <item.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                            <div className="text-xl font-bold font-display">{item.value || 0}</div>
                            <div className="text-xs text-muted-foreground">{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {isPlayerView && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Your Portal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Welcome to your player dashboard. Your stats, attendance records, and awards are accessible from the sidebar.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
