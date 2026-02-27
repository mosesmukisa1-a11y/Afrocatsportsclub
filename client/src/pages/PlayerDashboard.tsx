import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  Trophy, Target, Zap, Calendar, Activity, Shield,
  TrendingUp, AlertTriangle, FileText, CheckCircle,
  MapPin, Clock, Swords, User, ChevronRight, Flame,
  Heart, BarChart3, Award, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from "recharts";
import logo from "@assets/afrocate_logo_1772226294597.png";

const AC = {
  bg: "#0B0F14",
  card: "#111827",
  card2: "#0F172A",
  border: "rgba(255,255,255,0.08)",
  text: "#E5E7EB",
  textMuted: "rgba(229,231,235,0.70)",
  primary: "#0F8B7D",
  primaryDark: "#0B6F66",
  primarySoft: "rgba(15,139,125,0.18)",
  accent: "#F2B705",
  accentDark: "#D9A300",
  accentSoft: "rgba(242,183,5,0.18)",
};

function DarkCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[18px] ${className}`}
      style={{
        background: `linear-gradient(135deg, ${AC.card}, ${AC.card2})`,
        border: `1px solid ${AC.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </div>
  );
}

function StatItem({ icon: Icon, label, value, color = AC.text }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1" style={{ borderBottom: `1px solid ${AC.border}` }}>
      <div className="flex items-center gap-2.5">
        <Icon size={16} style={{ color: AC.textMuted }} />
        <span className="text-sm" style={{ color: AC.textMuted }}>{label}</span>
      </div>
      <span className="font-bold text-sm" style={{ color }}>{value}</span>
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

  return (
    <Layout>
      <div className="afrocat-dark -m-6 min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Afrocat" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight" style={{ color: AC.text }} data-testid="text-dashboard-title">
                  Player Dashboard
                </h1>
                <p className="text-xs" style={{ color: AC.textMuted }}>Performance Analytics</p>
              </div>
            </div>
            {canViewAny && (
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="w-[250px] border-0 text-sm" style={{ background: AC.card, color: AC.text, borderColor: AC.border }} data-testid="select-player">
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
            <div className="text-center py-20" style={{ color: AC.textMuted }}>
              {isPlayer ? "Your player profile is not linked yet. Contact an administrator." : "Select a player to view their dashboard."}
            </div>
          )}

          {isLoading && effectivePlayerId && (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: AC.primary }} /></div>
          )}

          {dash && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <DarkCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <img src={logo} alt="" className="w-8 h-8 object-contain opacity-40" />
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: AC.accentSoft, color: AC.accent }}>
                          #{dash.player?.jerseyNo}
                        </span>
                      </div>

                      <div className="flex justify-center mb-4">
                        {dash.player?.photoUrl ? (
                          <img
                            src={dash.player.photoUrl}
                            alt={`${dash.player.firstName} ${dash.player.lastName}`}
                            className="w-36 h-36 rounded-2xl object-cover"
                            style={{ border: `3px solid ${AC.primary}`, boxShadow: `0 0 30px ${AC.primarySoft}` }}
                            data-testid="img-player-photo"
                          />
                        ) : (
                          <div
                            className="w-36 h-36 rounded-2xl flex items-center justify-center text-4xl font-bold"
                            style={{ background: `linear-gradient(135deg, ${AC.primarySoft}, ${AC.accentSoft})`, color: AC.primary, border: `3px solid ${AC.primary}` }}
                            data-testid="img-player-avatar"
                          >
                            {(dash.player?.firstName || "")[0]}{(dash.player?.lastName || "")[0]}
                          </div>
                        )}
                      </div>

                      <div className="text-center mb-4">
                        <h2 className="text-xl font-display font-bold" style={{ color: AC.text }} data-testid="text-player-name">
                          {dash.player?.firstName} {dash.player?.lastName}
                        </h2>
                        <p className="text-sm mt-1" style={{ color: AC.textMuted }}>{dash.player?.teamName || "Unassigned"}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: AC.primarySoft, color: AC.primary }} data-testid="badge-position">
                            {dash.player?.position}
                          </span>
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{
                              background: dash.player?.status === "ACTIVE" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: dash.player?.status === "ACTIVE" ? "#22c55e" : "#ef4444"
                            }}
                            data-testid="badge-status"
                          >
                            {dash.player?.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-5">
                        {[
                          { label: "Matches", value: dash.totals?.matches ?? 0 },
                          { label: "Points", value: dash.totals?.pointsTotal ?? 0 },
                          { label: "Aces", value: dash.totals?.aces ?? 0 },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                            <div className="text-lg font-bold" style={{ color: AC.accent }}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: AC.textMuted }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                          { label: "Kills", value: dash.totals?.kills ?? 0 },
                          { label: "Blocks", value: dash.totals?.blocks ?? 0 },
                          { label: "Digs", value: dash.totals?.digs ?? 0 },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                            <div className="text-lg font-bold" style={{ color: AC.text }}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: AC.textMuted }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DarkCard>

                  {dash.upcomingFixture && (
                    <DarkCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Swords size={16} style={{ color: AC.accent }} />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: AC.accent }}>Upcoming Fixture</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-sm" style={{ color: AC.text }}>{dash.upcomingFixture.teamName}</p>
                            <p className="text-xs" style={{ color: AC.textMuted }}>vs</p>
                            <p className="font-bold text-sm" style={{ color: AC.text }}>{dash.upcomingFixture.opponent}</p>
                          </div>
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: dash.upcomingFixture.isHome ? AC.primarySoft : AC.accentSoft, color: dash.upcomingFixture.isHome ? AC.primary : AC.accent }}
                            data-testid="badge-home-away"
                          >
                            {dash.upcomingFixture.isHome ? "HOME" : "AWAY"}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs" style={{ color: AC.textMuted }}>
                          <div className="flex items-center gap-2"><Calendar size={12} /> {new Date(dash.upcomingFixture.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                          <div className="flex items-center gap-2"><MapPin size={12} /> {dash.upcomingFixture.venue}</div>
                          <div className="flex items-center gap-2"><Trophy size={12} /> {dash.upcomingFixture.competition}</div>
                          {dash.upcomingFixture.coachName && (
                            <div className="flex items-center gap-2"><User size={12} /> Coach: {dash.upcomingFixture.coachName}</div>
                          )}
                        </div>
                      </div>
                    </DarkCard>
                  )}

                  {!dash.upcomingFixture && (
                    <DarkCard>
                      <div className="p-5 text-center">
                        <Swords size={24} className="mx-auto mb-2" style={{ color: AC.textMuted }} />
                        <p className="text-sm" style={{ color: AC.textMuted }}>No upcoming fixtures scheduled</p>
                      </div>
                    </DarkCard>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <DarkCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={18} style={{ color: AC.accent }} />
                          <span className="font-bold text-sm" style={{ color: AC.text }}>Performance</span>
                        </div>
                        <div className="flex gap-1">
                          {(["all", "home", "away"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setChartFilter(f)}
                              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                              style={{
                                background: chartFilter === f ? AC.accent : "rgba(255,255,255,0.05)",
                                color: chartFilter === f ? AC.bg : AC.textMuted,
                              }}
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
                              <CartesianGrid strokeDasharray="3 3" stroke={AC.border} />
                              <XAxis
                                dataKey="opponent"
                                tick={{ fill: AC.textMuted, fontSize: 10 }}
                                axisLine={{ stroke: AC.border }}
                                tickLine={false}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={50}
                                tickFormatter={(v: string) => v?.substring(0, 8) || ""}
                              />
                              <YAxis tick={{ fill: AC.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{ background: AC.card, border: `1px solid ${AC.border}`, borderRadius: 12, color: AC.text, fontSize: 12 }}
                                formatter={(val: any, name: string) => [val, "Points"]}
                                labelFormatter={(label: string) => `vs ${label}`}
                              />
                              <Bar dataKey="pointsTotal" radius={[6, 6, 0, 0]}>
                                {filteredTrend.map((entry: any, index: number) => (
                                  <Cell key={index} fill={index === filteredTrend.length - 1 ? AC.accent : AC.primary} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center" style={{ color: AC.textMuted }}>
                            <p className="text-sm">No performance data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </DarkCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DarkCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp size={16} style={{ color: AC.primary }} />
                          <span className="font-bold text-sm" style={{ color: AC.text }}>Points Trend</span>
                        </div>
                        <div className="h-44">
                          {(dash.performanceTrend || []).length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dash.performanceTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke={AC.border} />
                                <XAxis
                                  dataKey="opponent"
                                  tick={{ fill: AC.textMuted, fontSize: 9 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(v: string) => v?.substring(0, 5) || ""}
                                />
                                <YAxis tick={{ fill: AC.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ background: AC.card, border: `1px solid ${AC.border}`, borderRadius: 12, color: AC.text, fontSize: 12 }}
                                />
                                <Line type="monotone" dataKey="pointsTotal" stroke={AC.accent} strokeWidth={2.5} dot={{ fill: AC.accent, r: 4 }} activeDot={{ r: 6, fill: AC.accent }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center" style={{ color: AC.textMuted }}>
                              <p className="text-sm">Need 2+ matches for trend</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </DarkCard>

                    <DarkCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield size={16} style={{ color: AC.primary }} />
                          <span className="font-bold text-sm" style={{ color: AC.text }}>Statistics</span>
                        </div>
                        <div className="space-y-0">
                          <StatItem icon={Trophy} label="Matches Played" value={dash.totals?.matches ?? 0} />
                          <StatItem icon={Clock} label="Minutes Played" value={dash.totals?.minutesPlayed ?? 0} />
                          <StatItem icon={Flame} label="Total Points" value={dash.totals?.pointsTotal ?? 0} color={AC.accent} />
                          <StatItem icon={Zap} label="Aces" value={dash.totals?.aces ?? 0} />
                          <StatItem icon={Shield} label="Blocks" value={dash.totals?.blocks ?? 0} />
                          <StatItem icon={Activity} label="Digs" value={dash.totals?.digs ?? 0} />
                          <StatItem icon={AlertTriangle} label="Serve Errors" value={dash.totals?.servesError ?? 0} color="#ef4444" />
                          <StatItem icon={AlertTriangle} label="Spike Errors" value={dash.totals?.spikesError ?? 0} color="#ef4444" />
                          <StatItem icon={CheckCircle} label="Attendance" value={
                            dash.attendanceSummary?.total > 0
                              ? `${Math.round((dash.attendanceSummary.present / dash.attendanceSummary.total) * 100)}%`
                              : "N/A"
                          } color={AC.primary} />
                        </div>
                      </div>
                    </DarkCard>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                    style={{
                      background: activeTab === tab.id ? AC.accent : "rgba(255,255,255,0.04)",
                      color: activeTab === tab.id ? AC.bg : AC.textMuted,
                      border: `1px solid ${activeTab === tab.id ? AC.accent : AC.border}`,
                    }}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <DarkCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={16} style={{ color: AC.accent }} />
                      <span className="font-bold text-sm" style={{ color: AC.text }}>Season Overview</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {[
                        { label: "Points", value: dash.totals?.pointsTotal ?? 0, color: AC.accent },
                        { label: "Kills", value: dash.totals?.kills ?? 0, color: AC.primary },
                        { label: "Aces", value: dash.totals?.aces ?? 0, color: AC.primary },
                        { label: "Blocks", value: dash.totals?.blocks ?? 0, color: AC.primary },
                        { label: "Digs", value: dash.totals?.digs ?? 0, color: AC.primary },
                        { label: "Assists", value: dash.totals?.settingAssist ?? 0, color: AC.primary },
                      ].map(s => (
                        <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: AC.textMuted }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {dash.activeContract && (
                      <div className="mt-5 p-4 rounded-xl" style={{ background: AC.primarySoft, border: `1px solid ${AC.primary}30` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} style={{ color: AC.primary }} />
                          <span className="font-bold text-xs" style={{ color: AC.primary }}>Active Contract</span>
                        </div>
                        <p className="text-sm" style={{ color: AC.text }}>
                          {dash.activeContract.contractType} — {dash.activeContract.startDate} to {dash.activeContract.endDate}
                        </p>
                      </div>
                    )}
                  </div>
                </DarkCard>
              )}

              {activeTab === "focus" && (
                <DarkCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target size={16} style={{ color: AC.accent }} />
                      <span className="font-bold text-sm" style={{ color: AC.text }}>Smart Focus Recommendations</span>
                    </div>
                    {(dash.smartFocusHistory || []).length === 0 ? (
                      <p className="text-sm py-8 text-center" style={{ color: AC.textMuted }}>No focus recommendations yet</p>
                    ) : (
                      <div className="space-y-3">
                        {dash.smartFocusHistory.slice(0, 10).map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }} data-testid={`row-focus-${i}`}>
                            <Zap size={14} className="mt-0.5 shrink-0" style={{ color: AC.accent }} />
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {(f.focusAreas || []).map((area: string, j: number) => (
                                  <span key={j} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: AC.accentSoft, color: AC.accent }}>
                                    {area}
                                  </span>
                                ))}
                              </div>
                              {f.matchDate && (
                                <p className="text-xs mt-1" style={{ color: AC.textMuted }}>
                                  vs {f.opponent || "Unknown"} &bull; {f.matchDate}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DarkCard>
              )}

              {activeTab === "attendance" && (
                <DarkCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar size={16} style={{ color: AC.primary }} />
                      <span className="font-bold text-sm" style={{ color: AC.text }}>Attendance Summary</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Present", value: dash.attendanceSummary?.present ?? 0, color: "#22c55e" },
                        { label: "Late", value: dash.attendanceSummary?.late ?? 0, color: AC.accent },
                        { label: "Absent", value: dash.attendanceSummary?.absent ?? 0, color: "#ef4444" },
                        { label: "Excused", value: dash.attendanceSummary?.excused ?? 0, color: AC.textMuted },
                      ].map(s => (
                        <div key={s.label} className="text-center p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs mt-1" style={{ color: AC.textMuted }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {dash.attendanceSummary?.total > 0 && (
                      <div className="mt-4 p-4 rounded-xl" style={{ background: AC.primarySoft }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ color: AC.primary }}>Attendance Rate</span>
                          <span className="text-2xl font-bold" style={{ color: AC.primary }}>
                            {Math.round((dash.attendanceSummary.present / dash.attendanceSummary.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.1)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(dash.attendanceSummary.present / dash.attendanceSummary.total) * 100}%`, background: AC.primary }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </DarkCard>
              )}

              {activeTab === "injury" && (
                <DarkCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart size={16} style={{ color: "#ef4444" }} />
                      <span className="font-bold text-sm" style={{ color: AC.text }}>Injury & Wellness</span>
                    </div>
                    {dash.injuryStatus ? (
                      <div className="p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                          <span className="font-bold text-sm" style={{ color: "#ef4444" }}>Active Injury</span>
                        </div>
                        <p className="text-sm" style={{ color: AC.text }}>{dash.injuryStatus.injuryType}</p>
                        <div className="flex gap-3 mt-2 text-xs" style={{ color: AC.textMuted }}>
                          <span>Severity: <strong style={{ color: AC.accent }}>{dash.injuryStatus.severity}</strong></span>
                          <span>Since: {dash.injuryStatus.startDate}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                        <CheckCircle size={32} className="mx-auto mb-2" style={{ color: "#22c55e" }} />
                        <p className="font-bold text-sm" style={{ color: "#22c55e" }}>Fully Fit</p>
                        <p className="text-xs mt-1" style={{ color: AC.textMuted }}>No active injuries</p>
                      </div>
                    )}
                  </div>
                </DarkCard>
              )}

              {activeTab === "reports" && (
                <DarkCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText size={16} style={{ color: AC.accent }} />
                      <span className="font-bold text-sm" style={{ color: AC.text }}>Recent Match Stats</span>
                    </div>
                    {(dash.recentStats || []).length === 0 ? (
                      <p className="text-sm py-8 text-center" style={{ color: AC.textMuted }}>No match stats recorded yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${AC.border}` }}>
                              {["Date", "Opponent", "Result", "Pts", "K", "Ace", "Blk", "Digs"].map(h => (
                                <th key={h} className="px-3 py-2 text-xs uppercase tracking-wider" style={{ color: AC.textMuted }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dash.recentStats.map((s: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${AC.border}` }} data-testid={`row-stat-${i}`}>
                                <td className="px-3 py-2.5 text-xs" style={{ color: AC.textMuted }}>{s.matchDate || "—"}</td>
                                <td className="px-3 py-2.5 font-medium text-sm" style={{ color: AC.text }}>{s.opponent || "—"}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {s.result ? (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                                      background: s.result === "W" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                      color: s.result === "W" ? "#22c55e" : "#ef4444"
                                    }}>{s.result}</span>
                                  ) : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold" style={{ color: AC.accent }}>{s.pointsTotal ?? 0}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: AC.text }}>{s.spikesKill ?? 0}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: AC.text }}>{s.servesAce ?? 0}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: AC.text }}>{(s.blocksSolo ?? 0) + (s.blocksAssist ?? 0)}</td>
                                <td className="px-3 py-2.5 text-center" style={{ color: AC.text }}>{s.digs ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </DarkCard>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
