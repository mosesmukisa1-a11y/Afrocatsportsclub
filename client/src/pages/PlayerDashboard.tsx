import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  Trophy, Target, Zap, Calendar, Activity, Shield,
  TrendingUp, AlertTriangle, FileText, CheckCircle
} from "lucide-react";

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const isPlayer = user?.role === "PLAYER";
  const canViewAny = !!user && ["ADMIN","MANAGER","COACH"].includes(user.role);
  const effectivePlayerId = isPlayer && user?.playerId ? user.playerId : selectedPlayerId;

  const { data: dash, isLoading } = useQuery({
    queryKey: ["/api/players/dashboard", effectivePlayerId],
    queryFn: () => api.getPlayerDashboard(effectivePlayerId),
    enabled: !!effectivePlayerId,
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Player Dashboard</h1>
            <p className="text-muted-foreground mt-1">Individual performance and history</p>
          </div>
          {canViewAny && (
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="w-[250px]" data-testid="select-player">
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.jerseyNo} {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!effectivePlayerId && (
          <div className="text-center py-16 text-muted-foreground">
            {isPlayer ? "Your player profile is not linked yet. Contact an administrator." : "Select a player to view their dashboard."}
          </div>
        )}

        {isLoading && effectivePlayerId && (
          <div className="text-center py-16 text-muted-foreground">Loading player data...</div>
        )}

        {dash && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 text-xl font-bold text-primary">
                    {dash.player?.photoUrl ? (
                      <img src={dash.player.photoUrl} className="w-16 h-16 rounded-full object-cover" alt="" />
                    ) : (
                      `${(dash.player?.firstName || "")[0]}${(dash.player?.lastName || "")[0]}`
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold" data-testid="text-player-name">
                      {dash.player?.firstName} {dash.player?.lastName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge data-testid="badge-jersey">#{dash.player?.jerseyNo}</Badge>
                      <Badge variant="secondary" data-testid="badge-position">{dash.player?.position}</Badge>
                      <Badge variant={dash.player?.status === "ACTIVE" ? "default" : "destructive"} data-testid="badge-status">
                        {dash.player?.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
                  <div className="text-2xl font-bold font-display" data-testid="text-matches-played">{dash.recentStats?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Recent Matches</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <div className="text-2xl font-bold font-display" data-testid="text-attendance-rate">
                    {dash.attendanceSummary?.total > 0
                      ? Math.round((dash.attendanceSummary.present / dash.attendanceSummary.total) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">Attendance Rate</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Activity className={`h-5 w-5 mx-auto mb-1 ${dash.injuryStatus ? 'text-red-500' : 'text-green-500'}`} />
                  <div className="text-2xl font-bold font-display" data-testid="text-injury-status">
                    {dash.injuryStatus ? "Injured" : "Fit"}
                  </div>
                  <div className="text-xs text-muted-foreground">Health Status</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
                  <div className="text-2xl font-bold font-display" data-testid="text-contract-status">
                    {dash.contractSummary?.status || "None"}
                  </div>
                  <div className="text-xs text-muted-foreground">Contract</div>
                </CardContent>
              </Card>
            </div>

            {dash.performanceTrend && dash.performanceTrend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" /> Performance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {dash.performanceTrend.map((t: any, i: number) => {
                      const maxPts = Math.max(...dash.performanceTrend.map((p: any) => Math.abs(p.pointsTotal || 1)));
                      const height = Math.max(10, (Math.abs(t.pointsTotal) / maxPts) * 100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`trend-bar-${i}`}>
                          <span className="text-[10px] font-bold">{t.pointsTotal}</span>
                          <div
                            className={`w-full rounded-t-sm ${t.pointsTotal >= 0 ? 'bg-primary' : 'bg-red-400'}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[8px] text-muted-foreground truncate w-full text-center">{t.opponent?.substring(0, 6)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {dash.recentStats && dash.recentStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-amber-500" /> Recent Match Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Opponent</th>
                          <th className="px-3 py-2 text-center">Result</th>
                          <th className="px-3 py-2 text-center">Pts</th>
                          <th className="px-3 py-2 text-center">K</th>
                          <th className="px-3 py-2 text-center">Ace</th>
                          <th className="px-3 py-2 text-center">Blk</th>
                          <th className="px-3 py-2 text-center">Digs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dash.recentStats.map((s: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-muted/10" data-testid={`row-stat-${i}`}>
                            <td className="px-3 py-2 text-sm">{s.matchDate || "—"}</td>
                            <td className="px-3 py-2 font-medium">{s.opponent || "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {s.result ? (
                                <Badge variant={s.result === "W" ? "default" : "destructive"} className="text-xs">{s.result}</Badge>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2 text-center font-bold">{s.pointsTotal ?? 0}</td>
                            <td className="px-3 py-2 text-center">{s.spikesKill ?? 0}</td>
                            <td className="px-3 py-2 text-center">{s.servesAce ?? 0}</td>
                            <td className="px-3 py-2 text-center">{(s.blocksSolo ?? 0) + (s.blocksAssist ?? 0)}</td>
                            <td className="px-3 py-2 text-center">{s.digs ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {dash.smartFocusHistory && dash.smartFocusHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" /> Smart Focus Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dash.smartFocusHistory.slice(0, 10).map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30" data-testid={`row-focus-${i}`}>
                        <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="flex flex-wrap gap-1">
                            {(f.focusAreas || []).map((area: string, j: number) => (
                              <Badge key={j} variant="outline" className="text-xs">{area}</Badge>
                            ))}
                          </div>
                          {f.matchDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              vs {f.opponent || "Unknown"} • {f.matchDate}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
