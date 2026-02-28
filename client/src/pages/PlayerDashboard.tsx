import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  Trophy, Target, Zap, Calendar, Activity, Shield,
  TrendingUp, AlertTriangle, FileText, CheckCircle,
  MapPin, Clock, Swords, User, Flame,
  Heart, BarChart3, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from "recharts";
import logo from "@assets/afrocate_logo_1772226294597.png";

function AcCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ac-card ${className}`}>{children}</div>;
}

function StatItem({ icon: Icon, label, value, accent, danger }: { icon: any; label: string; value: string | number; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-ac-border">
      <div className="flex items-center gap-2.5">
        <Icon size={16} className="text-ac-muted" />
        <span className="text-sm text-ac-muted">{label}</span>
      </div>
      <span className={`font-bold text-sm ${danger ? "text-ac-red" : accent ? "text-ac-gold" : "text-ac-text"}`}>{value}</span>
    </div>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [chartFilter, setChartFilter] = useState<"all" | "home" | "away">("all");
  const [activeTab, setActiveTab] = useState("overview");

  const isPlayer = user?.role === "PLAYER";
  const canViewAny = !!user && ["ADMIN", "MANAGER", "COACH"].includes(user.role);
  const effectivePlayerId = isPlayer && user?.playerId ? user.playerId : selectedPlayerId;

  const { data: dash, isLoading } = useQuery({
    queryKey: ["/api/players/dashboard", effectivePlayerId],
    queryFn: () => api.getPlayerDashboard(effectivePlayerId),
    enabled: !!effectivePlayerId,
  });

  const filteredTrend = (dash?.performanceTrend || []).filter((t: any) => {
    if (chartFilter === "home") return t.isHome;
    if (chartFilter === "away") return !t.isHome;
    return true;
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "focus", label: "Smart Focus", icon: Target },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "injury", label: "Injury & Wellness", icon: Heart },
    { id: "reports", label: "Match Stats", icon: FileText },
  ];

  const chartTooltipStyle = {
    background: "var(--color-ac-card)",
    border: "1px solid var(--color-ac-border)",
    borderRadius: 12,
    color: "var(--color-ac-text)",
    fontSize: 12,
  };

  return (
    <Layout>
      <div className="afrocat-dark -m-6 min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Afrocat" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight text-ac-text" data-testid="text-dashboard-title">
                  Player Dashboard
                </h1>
                <p className="text-xs text-ac-muted">Performance Analytics</p>
              </div>
            </div>
            {canViewAny && (
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="w-[250px] border-ac-border bg-ac-card text-ac-text text-sm" data-testid="select-player">
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>#{p.jerseyNo} {p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!effectivePlayerId && (
            <div className="text-center py-20 text-ac-muted">
              {isPlayer ? "Your player profile is not linked yet. Contact an administrator." : "Select a player to view their dashboard."}
            </div>
          )}

          {isLoading && effectivePlayerId && (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-ac-teal" /></div>
          )}

          {dash && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <AcCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <img src={logo} alt="" className="w-8 h-8 object-contain opacity-40" />
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ac-gold-soft text-ac-gold">
                          #{dash.player?.jerseyNo}
                        </span>
                      </div>

                      <div className="flex justify-center mb-4">
                        {dash.player?.photoUrl ? (
                          <img
                            src={dash.player.photoUrl}
                            alt={`${dash.player.firstName} ${dash.player.lastName}`}
                            className="w-36 h-36 rounded-2xl object-cover border-3 border-ac-teal shadow-[0_0_30px_var(--color-ac-teal-soft)]"
                            data-testid="img-player-photo"
                          />
                        ) : (
                          <div
                            className="w-36 h-36 rounded-2xl flex items-center justify-center text-4xl font-bold bg-gradient-to-br from-ac-teal-soft to-ac-gold-soft text-ac-teal border-3 border-ac-teal"
                            data-testid="img-player-avatar"
                          >
                            {(dash.player?.firstName || "")[0]}{(dash.player?.lastName || "")[0]}
                          </div>
                        )}
                      </div>

                      <div className="text-center mb-4">
                        <h2 className="text-xl font-display font-bold text-ac-text" data-testid="text-player-name">
                          {dash.player?.firstName} {dash.player?.lastName}
                        </h2>
                        <p className="text-sm mt-1 text-ac-muted">{dash.player?.teamName || "Unassigned"}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-ac-teal-soft text-ac-teal" data-testid="badge-position">
                            {dash.player?.position}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dash.player?.status === "ACTIVE" ? "bg-ac-green-soft text-ac-green" : "bg-ac-red-soft text-ac-red"}`}
                            data-testid="badge-status"
                          >
                            {dash.player?.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-5">
                        {[
                          { label: "Matches", value: dash.totals?.matches ?? 0, gold: true },
                          { label: "Points", value: dash.totals?.pointsTotal ?? 0, gold: true },
                          { label: "Aces", value: dash.totals?.aces ?? 0, gold: true },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl bg-ac-white-3">
                            <div className={`text-lg font-bold ${s.gold ? "text-ac-gold" : "text-ac-text"}`}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider text-ac-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                          { label: "Kills", value: dash.totals?.kills ?? 0 },
                          { label: "Blocks", value: dash.totals?.blocks ?? 0 },
                          { label: "Digs", value: dash.totals?.digs ?? 0 },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl bg-ac-white-3">
                            <div className="text-lg font-bold text-ac-text">{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider text-ac-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AcCard>

                  {dash.upcomingFixture ? (
                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Swords size={16} className="text-ac-gold" />
                          <span className="text-xs font-bold uppercase tracking-wider text-ac-gold">Upcoming Fixture</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-sm text-ac-text">{dash.upcomingFixture.teamName}</p>
                            <p className="text-xs text-ac-muted">vs</p>
                            <p className="font-bold text-sm text-ac-text">{dash.upcomingFixture.opponent}</p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dash.upcomingFixture.isHome ? "bg-ac-teal-soft text-ac-teal" : "bg-ac-gold-soft text-ac-gold"}`}
                            data-testid="badge-home-away"
                          >
                            {dash.upcomingFixture.isHome ? "HOME" : "AWAY"}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-ac-muted">
                          <div className="flex items-center gap-2"><Calendar size={12} /> {new Date(dash.upcomingFixture.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                          <div className="flex items-center gap-2"><MapPin size={12} /> {dash.upcomingFixture.venue}</div>
                          <div className="flex items-center gap-2"><Trophy size={12} /> {dash.upcomingFixture.competition}</div>
                          {dash.upcomingFixture.coachName && (
                            <div className="flex items-center gap-2"><User size={12} /> Coach: {dash.upcomingFixture.coachName}</div>
                          )}
                        </div>
                      </div>
                    </AcCard>
                  ) : (
                    <AcCard>
                      <div className="p-5 text-center">
                        <Swords size={24} className="mx-auto mb-2 text-ac-muted" />
                        <p className="text-sm text-ac-muted">No upcoming fixtures scheduled</p>
                      </div>
                    </AcCard>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <AcCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={18} className="text-ac-gold" />
                          <span className="font-bold text-sm text-ac-text">Performance</span>
                        </div>
                        <div className="flex gap-1">
                          {(["all", "home", "away"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setChartFilter(f)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${chartFilter === f ? "bg-ac-gold text-ac-bg" : "bg-ac-white-5 text-ac-muted"}`}
                              data-testid={`button-filter-${f}`}
                            >
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="h-56">
                        {filteredTrend.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredTrend} barSize={28}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ac-border)" />
                              <XAxis
                                dataKey="opponent"
                                tick={{ fill: "var(--color-ac-muted)", fontSize: 10 }}
                                axisLine={{ stroke: "var(--color-ac-border)" }}
                                tickLine={false}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={50}
                                tickFormatter={(v: string) => v?.substring(0, 8) || ""}
                              />
                              <YAxis tick={{ fill: "var(--color-ac-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={chartTooltipStyle} formatter={(val: any) => [val, "Points"]} labelFormatter={(l: string) => `vs ${l}`} />
                              <Bar dataKey="pointsTotal" radius={[6, 6, 0, 0]}>
                                {filteredTrend.map((_: any, i: number) => (
                                  <Cell key={i} fill={i === filteredTrend.length - 1 ? "var(--color-ac-gold)" : "var(--color-ac-teal)"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-ac-muted">
                            <p className="text-sm">No performance data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </AcCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp size={16} className="text-ac-teal" />
                          <span className="font-bold text-sm text-ac-text">Points Trend</span>
                        </div>
                        <div className="h-44">
                          {(dash.performanceTrend || []).length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dash.performanceTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ac-border)" />
                                <XAxis dataKey="opponent" tick={{ fill: "var(--color-ac-muted)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v?.substring(0, 5) || ""} />
                                <YAxis tick={{ fill: "var(--color-ac-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={chartTooltipStyle} />
                                <Line type="monotone" dataKey="pointsTotal" stroke="var(--color-ac-gold)" strokeWidth={2.5} dot={{ fill: "var(--color-ac-gold)", r: 4 }} activeDot={{ r: 6, fill: "var(--color-ac-gold)" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-ac-muted">
                              <p className="text-sm">Need 2+ matches for trend</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </AcCard>

                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield size={16} className="text-ac-teal" />
                          <span className="font-bold text-sm text-ac-text">Statistics</span>
                        </div>
                        <div className="space-y-0">
                          <StatItem icon={Trophy} label="Matches Played" value={dash.totals?.matches ?? 0} />
                          <StatItem icon={Clock} label="Minutes Played" value={dash.totals?.minutesPlayed ?? 0} />
                          <StatItem icon={Flame} label="Total Points" value={dash.totals?.pointsTotal ?? 0} accent />
                          <StatItem icon={Zap} label="Aces" value={dash.totals?.aces ?? 0} />
                          <StatItem icon={Shield} label="Blocks" value={dash.totals?.blocks ?? 0} />
                          <StatItem icon={Activity} label="Digs" value={dash.totals?.digs ?? 0} />
                          <StatItem icon={AlertTriangle} label="Serve Errors" value={dash.totals?.servesError ?? 0} danger />
                          <StatItem icon={AlertTriangle} label="Spike Errors" value={dash.totals?.spikesError ?? 0} danger />
                          <StatItem icon={CheckCircle} label="Attendance" value={
                            dash.attendanceSummary?.total > 0
                              ? `${Math.round((dash.attendanceSummary.present / dash.attendanceSummary.total) * 100)}%`
                              : "N/A"
                          } accent />
                        </div>
                      </div>
                    </AcCard>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                      activeTab === tab.id
                        ? "bg-ac-gold text-ac-bg border-ac-gold"
                        : "bg-ac-white-4 text-ac-muted border-ac-border"
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={16} className="text-ac-gold" />
                      <span className="font-bold text-sm text-ac-text">Season Overview</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {[
                        { label: "Points", value: dash.totals?.pointsTotal ?? 0, gold: true },
                        { label: "Kills", value: dash.totals?.kills ?? 0 },
                        { label: "Aces", value: dash.totals?.aces ?? 0 },
                        { label: "Blocks", value: dash.totals?.blocks ?? 0 },
                        { label: "Digs", value: dash.totals?.digs ?? 0 },
                        { label: "Assists", value: dash.totals?.settingAssist ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="text-center p-3 rounded-xl bg-ac-white-3">
                          <div className={`text-2xl font-bold ${s.gold ? "text-ac-gold" : "text-ac-teal"}`}>{s.value}</div>
                          <div className="text-[10px] uppercase tracking-wider mt-1 text-ac-muted">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {dash.activeContract && (
                      <div className="mt-5 p-4 rounded-xl bg-ac-teal-soft border border-ac-teal/30">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-ac-teal" />
                          <span className="font-bold text-xs text-ac-teal">Active Contract</span>
                        </div>
                        <p className="text-sm text-ac-text">
                          {dash.activeContract.contractType} — {dash.activeContract.startDate} to {dash.activeContract.endDate}
                        </p>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "focus" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target size={16} className="text-ac-gold" />
                      <span className="font-bold text-sm text-ac-text">Smart Focus Recommendations</span>
                    </div>
                    {(dash.smartFocusHistory || []).length === 0 ? (
                      <p className="text-sm py-8 text-center text-ac-muted">No focus recommendations yet</p>
                    ) : (
                      <div className="space-y-3">
                        {dash.smartFocusHistory.slice(0, 10).map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-ac-white-3" data-testid={`row-focus-${i}`}>
                            <Zap size={14} className="mt-0.5 shrink-0 text-ac-gold" />
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {(f.focusAreas || []).map((area: string, j: number) => (
                                  <span key={j} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ac-gold-soft text-ac-gold">
                                    {area}
                                  </span>
                                ))}
                              </div>
                              {f.matchDate && (
                                <p className="text-xs mt-1 text-ac-muted">vs {f.opponent || "Unknown"} &bull; {f.matchDate}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "attendance" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar size={16} className="text-ac-teal" />
                      <span className="font-bold text-sm text-ac-text">Attendance Summary</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Present", value: dash.attendanceSummary?.present ?? 0, cls: "text-ac-green" },
                        { label: "Late", value: dash.attendanceSummary?.late ?? 0, cls: "text-ac-gold" },
                        { label: "Absent", value: dash.attendanceSummary?.absent ?? 0, cls: "text-ac-red" },
                        { label: "Excused", value: dash.attendanceSummary?.excused ?? 0, cls: "text-ac-muted" },
                      ].map(s => (
                        <div key={s.label} className="text-center p-4 rounded-xl bg-ac-white-3">
                          <div className={`text-3xl font-bold ${s.cls}`}>{s.value}</div>
                          <div className="text-xs mt-1 text-ac-muted">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {dash.attendanceSummary?.total > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-ac-teal-soft">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ac-teal">Attendance Rate</span>
                          <span className="text-2xl font-bold text-ac-teal">
                            {Math.round((dash.attendanceSummary.present / dash.attendanceSummary.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full mt-2 bg-ac-white-10">
                          <div
                            className="h-full rounded-full bg-ac-teal transition-all"
                            style={{ width: `${(dash.attendanceSummary.present / dash.attendanceSummary.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "injury" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart size={16} className="text-ac-red" />
                      <span className="font-bold text-sm text-ac-text">Injury & Wellness</span>
                    </div>
                    {dash.injuryStatus ? (
                      <div className="p-4 rounded-xl bg-ac-red-soft border border-ac-red/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} className="text-ac-red" />
                          <span className="font-bold text-sm text-ac-red">Active Injury</span>
                        </div>
                        <p className="text-sm text-ac-text">{dash.injuryStatus.injuryType}</p>
                        <div className="flex gap-3 mt-2 text-xs text-ac-muted">
                          <span>Severity: <strong className="text-ac-gold">{dash.injuryStatus.severity}</strong></span>
                          <span>Since: {dash.injuryStatus.startDate}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl text-center bg-ac-green-soft">
                        <CheckCircle size={32} className="mx-auto mb-2 text-ac-green" />
                        <p className="font-bold text-sm text-ac-green">Fully Fit</p>
                        <p className="text-xs mt-1 text-ac-muted">No active injuries</p>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "reports" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText size={16} className="text-ac-gold" />
                      <span className="font-bold text-sm text-ac-text">Recent Match Stats</span>
                    </div>
                    {(dash.recentStats || []).length === 0 ? (
                      <p className="text-sm py-8 text-center text-ac-muted">No match stats recorded yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-ac-border">
                              {["Date", "Opponent", "Result", "Pts", "K", "Ace", "Blk", "Digs"].map(h => (
                                <th key={h} className="px-3 py-2 text-xs uppercase tracking-wider text-ac-muted">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dash.recentStats.map((s: any, i: number) => (
                              <tr key={i} className="border-b border-ac-border" data-testid={`row-stat-${i}`}>
                                <td className="px-3 py-2.5 text-xs text-ac-muted">{s.matchDate || "—"}</td>
                                <td className="px-3 py-2.5 font-medium text-sm text-ac-text">{s.opponent || "—"}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {s.result ? (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.result === "W" ? "bg-ac-green-soft text-ac-green" : "bg-ac-red-soft text-ac-red"}`}>
                                      {s.result}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-ac-gold">{s.pointsTotal ?? 0}</td>
                                <td className="px-3 py-2.5 text-center text-ac-text">{s.spikesKill ?? 0}</td>
                                <td className="px-3 py-2.5 text-center text-ac-text">{s.servesAce ?? 0}</td>
                                <td className="px-3 py-2.5 text-center text-ac-text">{(s.blocksSolo ?? 0) + (s.blocksAssist ?? 0)}</td>
                                <td className="px-3 py-2.5 text-center text-ac-text">{s.digs ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
