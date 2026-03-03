import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, AlertCircle, Target, Zap, Shield, Hand,
  TrendingDown, Brain, Activity
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

function StatusBadge({ status }: { status: string }) {
  if (status === "RED") return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-xs" data-testid="badge-red">
      <AlertTriangle className="w-3 h-3" /> RED
    </span>
  );
  if (status === "YELLOW") return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold text-xs" data-testid="badge-yellow">
      <AlertCircle className="w-3 h-3" /> YELLOW
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-bold text-xs" data-testid="badge-green">
      <CheckCircle2 className="w-3 h-3" /> GREEN
    </span>
  );
}

function MetricCard({ label, value, threshold, icon: Icon, unit }: { label: string; value: number; threshold?: { yellow: number; red: number }; icon: any; unit?: string }) {
  let color = "text-afrocat-green";
  if (threshold) {
    if (value >= threshold.red) color = "text-red-400";
    else if (value >= threshold.yellow) color = "text-yellow-400";
  }
  return (
    <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-afrocat-muted" />
        <span className="text-[10px] font-bold text-afrocat-muted uppercase">{label}</span>
      </div>
      <div className={`text-xl font-display font-bold ${color}`}>
        {typeof value === "number" ? (unit === "%" ? `${value}%` : value.toFixed(3)) : value}
      </div>
    </div>
  );
}

export default function CoachDashboard() {
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);

  const handleMatchChange = (matchId: string) => {
    setSelectedMatchId(matchId);
    const match = matches.find((m: any) => m.id === matchId);
    if (match?.teamId) setSelectedTeamId(match.teamId);
  };

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["/api/coach/devstats/dashboard", selectedTeamId, selectedMatchId],
    queryFn: () => api.getCoachDevStatsDashboard(selectedTeamId, selectedMatchId),
    enabled: !!selectedMatchId && !!selectedTeamId,
  });

  const alerts = dashboard?.dashboard || [];
  const teamSummary = dashboard?.teamSummary || null;
  const focusAreas = dashboard?.focus || [];

  const redCount = alerts.filter((a: any) => a.status === "RED").length;
  const yellowCount = alerts.filter((a: any) => a.status === "YELLOW").length;
  const greenCount = alerts.filter((a: any) => a.status === "GREEN").length;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Afrocat" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-dashboard-title">
                Coach Development Dashboard
              </h1>
              <p className="text-sm text-afrocat-muted mt-0.5">
                Red / Yellow / Green player alerts with training focus recommendations
              </p>
            </div>
          </div>
        </div>

        <div className="afrocat-card p-4">
          <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Select Match</label>
          <Select value={selectedMatchId} onValueChange={handleMatchChange}>
            <SelectTrigger data-testid="select-dashboard-match">
              <SelectValue placeholder="Select a match to analyze" />
            </SelectTrigger>
            <SelectContent>
              {matches.map((m: any) => {
                const team = teams.find((t: any) => t.id === m.teamId);
                return (
                  <SelectItem key={m.id} value={m.id}>
                    {m.matchDate} — {team?.name || "?"} vs {m.opponent}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedMatchId && isLoading && (
          <div className="afrocat-card p-6 text-center text-afrocat-muted">Loading dashboard...</div>
        )}

        {selectedMatchId && !isLoading && alerts.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="afrocat-card p-4 text-center">
                <div className="text-3xl font-display font-bold text-red-400">{redCount}</div>
                <div className="text-xs font-bold text-afrocat-muted uppercase mt-1">Red Alerts</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-3xl font-display font-bold text-yellow-400">{yellowCount}</div>
                <div className="text-xs font-bold text-afrocat-muted uppercase mt-1">Yellow Alerts</div>
              </div>
              <div className="afrocat-card p-4 text-center">
                <div className="text-3xl font-display font-bold text-green-400">{greenCount}</div>
                <div className="text-xs font-bold text-afrocat-muted uppercase mt-1">Green</div>
              </div>
            </div>

            {/* Team Summary */}
            {teamSummary && (
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

            {/* Player Alerts Table */}
            <div className="afrocat-card overflow-hidden">
              <div className="bg-afrocat-white-5 border-b border-afrocat-border p-4 rounded-t-[18px]">
                <h3 className="font-display font-bold text-afrocat-text text-sm">Player Alert Status</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-afrocat-border bg-afrocat-white-3">
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Player</th>
                      <th className="text-center p-3 text-xs font-bold text-afrocat-muted uppercase">Serve Err%</th>
                      <th className="text-center p-3 text-xs font-bold text-afrocat-muted uppercase">Recv -%</th>
                      <th className="text-center p-3 text-xs font-bold text-afrocat-muted uppercase">Atk Eff</th>
                      <th className="text-center p-3 text-xs font-bold text-afrocat-muted uppercase">Dec Err</th>
                      <th className="text-center p-3 text-xs font-bold text-afrocat-muted uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-bold text-afrocat-muted uppercase">Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a: any) => (
                      <tr
                        key={a.playerId}
                        className={`border-b border-afrocat-border ${a.status === "RED" ? "bg-red-500/5" : a.status === "YELLOW" ? "bg-yellow-500/5" : "bg-green-500/5"}`}
                        data-testid={`alert-row-${a.playerId}`}
                      >
                        <td className="p-3 font-bold text-afrocat-text">
                          {a.playerName} <span className="text-afrocat-muted font-normal">#{a.jerseyNo}</span>
                        </td>
                        <td className="p-3 text-center">{a.keyMetrics.serveErrorPct}</td>
                        <td className="p-3 text-center">{a.keyMetrics.receiveMinusPct}</td>
                        <td className="p-3 text-center">{a.keyMetrics.attackEfficiency}</td>
                        <td className="p-3 text-center">{a.keyMetrics.decisionErrors}</td>
                        <td className="p-3 text-center"><StatusBadge status={a.status} /></td>
                        <td className="p-3 text-xs text-afrocat-muted">{(a.reasons || []).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Training Focus */}
            <div className="afrocat-card p-5">
              <h3 className="font-display font-bold text-afrocat-text text-sm mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-afrocat-teal" /> Focus Areas — Next Training
              </h3>
              <div className="space-y-4">
                {focusAreas.map((f: any) => (
                  <div key={f.playerId} className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`focus-${f.playerId}`}>
                    <div className="font-bold text-sm text-afrocat-text mb-2">{f.playerName}</div>
                    <ul className="space-y-1">
                      {(f.focusAreas || []).map((area: string, i: number) => (
                        <li key={i} className="text-xs text-afrocat-muted flex items-start gap-2">
                          <TrendingDown className="w-3 h-3 mt-0.5 text-afrocat-teal shrink-0" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedMatchId && !isLoading && alerts.length === 0 && (
          <div className="afrocat-card p-6 text-center text-afrocat-muted">
            No development stats recorded for this match yet. Use the Advanced Dev Stats page to record events first.
          </div>
        )}
      </div>
    </Layout>
  );
}
