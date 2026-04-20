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
  Heart, BarChart3, Loader2, Cake, Search, Download, X
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from "recharts";
import logo from "@assets/afrocate_logo_1772226294597.png";

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function AcCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`afrocat-card ${className}`}>{children}</div>;
}

function StatItem({ icon: Icon, label, value, accent, danger }: { icon: any; label: string; value: string | number; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-afrocat-border">
      <div className="flex items-center gap-2.5">
        <Icon size={16} className="text-afrocat-muted" />
        <span className="text-sm text-afrocat-muted">{label}</span>
      </div>
      <span className={`font-bold text-sm ${danger ? "text-afrocat-red" : accent ? "text-afrocat-gold" : "text-afrocat-text"}`}>{value}</span>
    </div>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [chartFilter, setChartFilter] = useState<"all" | "home" | "away">("all");
  const [activeTab, setActiveTab] = useState("overview");

  const [statsSearch, setStatsSearch] = useState("");
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
    background: "var(--color-afrocat-card)",
    border: "1px solid var(--color-afrocat-border)",
    borderRadius: 12,
    color: "var(--color-afrocat-text)",
    fontSize: 12,
  };

  const filteredStats = (dash?.recentStats || []).filter((s: any) => {
    if (!statsSearch.trim()) return true;
    const q = statsSearch.toLowerCase();
    return (
      (s.opponent || "").toLowerCase().includes(q) ||
      (s.matchDate || "").toLowerCase().includes(q)
    );
  });

  const handleDownloadPDF = async () => {
    if (!dash) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const playerName = `${dash.player?.firstName || ""} ${dash.player?.lastName || ""}`.trim();
    const teamName = dash.player?.teamName || "Unassigned";
    const position = dash.player?.position || "—";
    const jersey = dash.player?.jerseyNo ? `#${dash.player.jerseyNo}` : "—";
    const generated = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    doc.setFillColor(13, 27, 32);
    doc.rect(0, 0, 210, 297, "F");

    doc.setFillColor(0, 150, 136);
    doc.rect(0, 0, 210, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("AFROCAT SPORTS CLUB", 14, 14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Player Stats Report", 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(200, 230, 225);
    doc.text(`Generated: ${generated}`, 14, 30);
    doc.text(`One Team One Dream`, 196, 30, { align: "right" });

    doc.setFillColor(20, 40, 48);
    doc.roundedRect(14, 44, 182, 34, 3, 3, "F");

    doc.setTextColor(255, 210, 63);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(playerName, 22, 57);

    doc.setTextColor(160, 200, 195);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${teamName}  ·  ${position}  ·  ${jersey}`, 22, 65);

    const totals = dash.totals || {};
    const kpis = [
      ["Matches", totals.matches ?? 0],
      ["Total Points", totals.pointsTotal ?? 0],
      ["Kills", totals.kills ?? 0],
      ["Aces", totals.aces ?? 0],
      ["Blocks", totals.blocks ?? 0],
      ["Digs", totals.digs ?? 0],
    ];

    doc.setTextColor(255, 210, 63);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Season Totals", 14, 88);

    const kpiPerRow = 3;
    kpis.forEach(([label, value], idx) => {
      const col = idx % kpiPerRow;
      const row = Math.floor(idx / kpiPerRow);
      const x = 14 + col * 62;
      const y = 94 + row * 22;
      doc.setFillColor(20, 40, 48);
      doc.roundedRect(x, y, 58, 18, 2, 2, "F");
      doc.setTextColor(255, 210, 63);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), x + 29, y + 11, { align: "center" });
      doc.setTextColor(140, 180, 175);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(String(label).toUpperCase(), x + 29, y + 16, { align: "center" });
    });

    const statsToExport = statsSearch.trim() ? filteredStats : (dash.recentStats || []);
    if (statsToExport.length > 0) {
      doc.setTextColor(255, 210, 63);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(statsSearch.trim() ? `Match Stats (filtered: "${statsSearch}")` : "Match Stats — All Matches", 14, 148);

      autoTable(doc, {
        startY: 153,
        head: [["Date", "Opponent", "Result", "Points", "Kills", "Aces", "Blocks", "Digs", "Assists", "Errors"]],
        body: statsToExport.map((s: any) => [
          s.matchDate || "—",
          s.opponent || "—",
          s.result || "—",
          s.pointsTotal ?? 0,
          s.spikesKill ?? 0,
          s.servesAce ?? 0,
          (s.blocksSolo ?? 0) + (s.blocksAssist ?? 0),
          s.digs ?? 0,
          s.settingAssist ?? 0,
          (s.spikesError ?? 0) + (s.servesError ?? 0),
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 3,
          fillColor: [20, 40, 48],
          textColor: [200, 225, 220],
          lineColor: [40, 70, 80],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [0, 120, 108],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [16, 34, 42] },
        columnStyles: {
          3: { textColor: [255, 210, 63], fontStyle: "bold" },
          2: { halign: "center" },
        },
        margin: { left: 14, right: 14 },
      });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(0, 120, 108);
      doc.rect(0, 290, 210, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(`Afrocat Sports Club — Confidential  ·  Page ${i} of ${pageCount}`, 105, 295, { align: "center" });
    }

    doc.save(`${playerName.replace(/\s+/g, "_")}_Stats_${generated.replace(/ /g, "_")}.pdf`);
  };

  return (
    <Layout>
      <div className="bg-afrocat-bg bg-afrocat-glow text-afrocat-text -m-6 min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Afrocat" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight text-afrocat-text" data-testid="text-dashboard-title">
                  Player Dashboard
                </h1>
                <p className="text-xs text-afrocat-muted">Performance Analytics</p>
              </div>
            </div>
            {canViewAny && (
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="w-[250px] border-afrocat-border bg-afrocat-card text-afrocat-text text-sm" data-testid="select-player">
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
            <div className="text-center py-20 text-afrocat-muted">
              {isPlayer ? "Your player profile is not linked yet. Contact an administrator." : "Select a player to view their dashboard."}
            </div>
          )}

          {isLoading && effectivePlayerId && (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-afrocat-teal" /></div>
          )}

          {dash && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <AcCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <img src={logo} alt="" className="w-8 h-8 object-contain opacity-40" />
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold">
                          #{dash.player?.jerseyNo}
                        </span>
                      </div>

                      <div className="flex justify-center mb-4">
                        {dash.player?.photoUrl ? (
                          <img
                            src={dash.player.photoUrl}
                            alt={`${dash.player.firstName} ${dash.player.lastName}`}
                            className="w-36 h-36 rounded-2xl object-cover border-3 border-afrocat-teal shadow-[0_0_30px_var(--color-afrocat-teal-soft)]"
                            data-testid="img-player-photo"
                          />
                        ) : (
                          <div
                            className="w-36 h-36 rounded-2xl flex items-center justify-center text-4xl font-bold bg-gradient-to-br from-ac-teal-soft to-ac-gold-soft text-afrocat-teal border-3 border-afrocat-teal"
                            data-testid="img-player-avatar"
                          >
                            {(dash.player?.firstName || "")[0]}{(dash.player?.lastName || "")[0]}
                          </div>
                        )}
                      </div>

                      <div className="text-center mb-4">
                        <h2 className="text-xl font-display font-bold text-afrocat-text" data-testid="text-player-name">
                          {dash.player?.firstName} {dash.player?.lastName}
                        </h2>
                        <p className="text-sm mt-1 text-afrocat-muted">{dash.player?.teamName || "Unassigned"}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-afrocat-teal-soft text-afrocat-teal" data-testid="badge-position">
                            {dash.player?.position}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dash.player?.status === "ACTIVE" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}
                            data-testid="badge-status"
                          >
                            {dash.player?.status}
                          </span>
                        </div>
                        {calcAge(dash.player?.dob) !== null && (
                          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-afrocat-muted" data-testid="text-player-age">
                            <Cake size={14} className="text-afrocat-gold" />
                            <span>Age: <strong className="text-afrocat-text">{calcAge(dash.player?.dob)}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-5">
                        {[
                          { label: "Matches", value: dash.totals?.matches ?? 0, gold: true },
                          { label: "Points", value: dash.totals?.pointsTotal ?? 0, gold: true },
                          { label: "Aces", value: dash.totals?.aces ?? 0, gold: true },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl bg-afrocat-white-3">
                            <div className={`text-lg font-bold ${s.gold ? "text-afrocat-gold" : "text-afrocat-text"}`}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider text-afrocat-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                          { label: "Kills", value: dash.totals?.kills ?? 0 },
                          { label: "Blocks", value: dash.totals?.blocks ?? 0 },
                          { label: "Digs", value: dash.totals?.digs ?? 0 },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-xl bg-afrocat-white-3">
                            <div className="text-lg font-bold text-afrocat-text">{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider text-afrocat-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AcCard>

                  {dash.upcomingFixture ? (
                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Swords size={16} className="text-afrocat-gold" />
                          <span className="text-xs font-bold uppercase tracking-wider text-afrocat-gold">Upcoming Fixture</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-sm text-afrocat-text">{dash.upcomingFixture.teamName}</p>
                            <p className="text-xs text-afrocat-muted">vs</p>
                            <p className="font-bold text-sm text-afrocat-text">{dash.upcomingFixture.opponent}</p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dash.upcomingFixture.isHome ? "bg-afrocat-teal-soft text-afrocat-teal" : "bg-afrocat-gold-soft text-afrocat-gold"}`}
                            data-testid="badge-home-away"
                          >
                            {dash.upcomingFixture.isHome ? "HOME" : "AWAY"}
                          </span>
                        </div>
                        {dash.upcomingFixture.timeLeftLabel && (
                          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-afrocat-teal-soft" data-testid="text-fixture-countdown">
                            <Clock size={14} className="text-afrocat-teal" />
                            <span className="text-sm font-bold text-afrocat-teal">{dash.upcomingFixture.timeLeftLabel}</span>
                          </div>
                        )}
                        <div className="space-y-1.5 text-xs text-afrocat-muted">
                          <div className="flex items-center gap-2"><Calendar size={12} /> {new Date(dash.upcomingFixture.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                          {dash.upcomingFixture.startTime && (
                            <div className="flex items-center gap-2"><Clock size={12} /> {new Date(dash.upcomingFixture.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          )}
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
                        <Swords size={24} className="mx-auto mb-2 text-afrocat-muted" />
                        <p className="text-sm text-afrocat-muted">No upcoming fixtures scheduled</p>
                      </div>
                    </AcCard>
                  )}

                  {dash.recentTeamMatches && dash.recentTeamMatches.length > 0 && (
                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy size={16} className="text-afrocat-gold" />
                          <span className="text-xs font-bold uppercase tracking-wider text-afrocat-gold">Recent Matches</span>
                        </div>
                        <div className="space-y-2">
                          {dash.recentTeamMatches.map((m: any) => (
                            <div key={m.matchId} className="flex items-center justify-between p-2 rounded-lg bg-afrocat-white-3" data-testid={`recent-match-${m.matchId}`}>
                              <div>
                                <p className="text-xs font-bold text-afrocat-text">vs {m.opponent}</p>
                                <p className="text-[10px] text-afrocat-muted">{m.date} - {m.venue}</p>
                              </div>
                              <div className="text-right">
                                {m.status === "PLAYED" ? (
                                  <span className={`text-sm font-bold ${m.result === "W" ? "text-afrocat-green" : "text-afrocat-red"}`} data-testid={`score-${m.matchId}`}>
                                    {m.homeScore} - {m.awayScore}
                                  </span>
                                ) : (
                                  <span className="text-xs text-yellow-400" data-testid={`score-pending-${m.matchId}`}>Score pending</span>
                                )}
                                <p className="text-[10px] text-afrocat-muted">{m.statusLabel}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AcCard>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <AcCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={18} className="text-afrocat-gold" />
                          <span className="font-bold text-sm text-afrocat-text">Performance</span>
                        </div>
                        <div className="flex gap-1">
                          {(["all", "home", "away"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setChartFilter(f)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${chartFilter === f ? "bg-afrocat-gold text-afrocat-bg" : "bg-afrocat-white-5 text-afrocat-muted"}`}
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
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-afrocat-border)" />
                              <XAxis
                                dataKey="opponent"
                                tick={{ fill: "var(--color-afrocat-muted)", fontSize: 10 }}
                                axisLine={{ stroke: "var(--color-afrocat-border)" }}
                                tickLine={false}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={50}
                                tickFormatter={(v: string) => v?.substring(0, 8) || ""}
                              />
                              <YAxis tick={{ fill: "var(--color-afrocat-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={chartTooltipStyle} formatter={(val: any) => [val, "Points"]} labelFormatter={(l: string) => `vs ${l}`} />
                              <Bar dataKey="pointsTotal" radius={[6, 6, 0, 0]}>
                                {filteredTrend.map((_: any, i: number) => (
                                  <Cell key={i} fill={i === filteredTrend.length - 1 ? "var(--color-afrocat-gold)" : "var(--color-afrocat-teal)"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-afrocat-muted">
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
                          <TrendingUp size={16} className="text-afrocat-teal" />
                          <span className="font-bold text-sm text-afrocat-text">Points Trend</span>
                        </div>
                        <div className="h-44">
                          {(dash.performanceTrend || []).length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dash.performanceTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-afrocat-border)" />
                                <XAxis dataKey="opponent" tick={{ fill: "var(--color-afrocat-muted)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v?.substring(0, 5) || ""} />
                                <YAxis tick={{ fill: "var(--color-afrocat-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={chartTooltipStyle} />
                                <Line type="monotone" dataKey="pointsTotal" stroke="var(--color-afrocat-gold)" strokeWidth={2.5} dot={{ fill: "var(--color-afrocat-gold)", r: 4 }} activeDot={{ r: 6, fill: "var(--color-afrocat-gold)" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-afrocat-muted">
                              <p className="text-sm">Need 2+ matches for trend</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </AcCard>

                    <AcCard>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield size={16} className="text-afrocat-teal" />
                          <span className="font-bold text-sm text-afrocat-text">Statistics</span>
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
                          <StatItem icon={CheckCircle} label="Attend %" value={
                            dash.attendanceSummary?.expectedSessions > 0
                              ? `${dash.attendanceSummary.attendRate}%`
                              : dash.attendanceSummary?.total > 0
                                ? `${dash.attendanceSummary.attendRate}%`
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
                        ? "bg-afrocat-gold text-afrocat-bg border-afrocat-gold"
                        : "bg-afrocat-white-4 text-afrocat-muted border-afrocat-border"
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="space-y-4">
                  {dash.recentStats && dash.recentStats.length > 0 && (() => {
                    const latest = dash.recentStats[0];
                    const latestFocus = (dash.smartFocusHistory || []).filter((f: any) => f.matchId === latest.matchId);
                    const allFocusAreas = latestFocus.flatMap((f: any) => f.focusAreas || []);
                    const totalErrors = (latest.spikesError ?? 0) + (latest.servesError ?? 0) + (latest.receiveError ?? 0) + (latest.settingError ?? 0);
                    return (
                      <AcCard>
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Flame size={16} className="text-afrocat-gold" />
                              <span className="font-bold text-sm text-afrocat-text">Latest Match Performance</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {latest.result && (
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${latest.result === "W" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                                  {latest.result === "W" ? "WIN" : "LOSS"}
                                </span>
                              )}
                              <span className="text-xs text-afrocat-muted">vs {latest.opponent} &bull; {latest.matchDate}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-4">
                            {[
                              { label: "Net Pts", value: latest.pointsTotal ?? 0, gold: true },
                              { label: "Kills", value: latest.spikesKill ?? 0 },
                              { label: "Aces", value: latest.servesAce ?? 0 },
                              { label: "Blocks", value: (latest.blocksSolo ?? 0) + (latest.blocksAssist ?? 0) },
                              { label: "Digs", value: latest.digs ?? 0 },
                              { label: "Assists", value: latest.settingAssist ?? 0 },
                              { label: "Errors", value: totalErrors, danger: totalErrors > 3 },
                            ].map(s => (
                              <div key={s.label} className="text-center p-2.5 rounded-xl bg-afrocat-white-3">
                                <div className={`text-xl font-bold ${s.gold ? "text-afrocat-gold" : s.danger ? "text-afrocat-red" : "text-afrocat-teal"}`}>{s.value}</div>
                                <div className="text-[9px] uppercase tracking-wider mt-0.5 text-afrocat-muted">{s.label}</div>
                              </div>
                            ))}
                          </div>
                          {allFocusAreas.length > 0 ? (
                            <div className="p-3 rounded-xl bg-afrocat-gold-soft border border-afrocat-gold/20">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Target size={13} className="text-afrocat-gold" />
                                <span className="text-xs font-bold text-afrocat-gold">Training Focus for Next Session</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {allFocusAreas.map((area: string, i: number) => (
                                  <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-afrocat-gold/20 text-afrocat-gold border border-afrocat-gold/30">
                                    {area}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-afrocat-green-soft border border-afrocat-green/20">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle size={13} className="text-afrocat-green" />
                                <span className="text-xs font-bold text-afrocat-green">No major weaknesses this match — excellent work!</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </AcCard>
                    );
                  })()}

                  <AcCard>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={16} className="text-afrocat-gold" />
                        <span className="font-bold text-sm text-afrocat-text">Season Overview</span>
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
                          <div key={s.label} className="text-center p-3 rounded-xl bg-afrocat-white-3">
                            <div className={`text-2xl font-bold ${s.gold ? "text-afrocat-gold" : "text-afrocat-teal"}`}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider mt-1 text-afrocat-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {dash.activeContract && (
                        <div className="mt-5 p-4 rounded-xl bg-afrocat-teal-soft border border-afrocat-teal/30">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={14} className="text-afrocat-teal" />
                            <span className="font-bold text-xs text-afrocat-teal">Active Contract</span>
                          </div>
                          <p className="text-sm text-afrocat-text">
                            {dash.activeContract.contractType} — {dash.activeContract.startDate} to {dash.activeContract.endDate}
                          </p>
                        </div>
                      )}
                    </div>
                  </AcCard>
                </div>
              )}

              {activeTab === "focus" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target size={16} className="text-afrocat-gold" />
                      <span className="font-bold text-sm text-afrocat-text">Smart Focus Recommendations</span>
                    </div>
                    {(dash.smartFocusHistory || []).length === 0 ? (
                      <p className="text-sm py-8 text-center text-afrocat-muted">No focus recommendations yet</p>
                    ) : (
                      <div className="space-y-3">
                        {dash.smartFocusHistory.slice(0, 10).map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-afrocat-white-3" data-testid={`row-focus-${i}`}>
                            <Zap size={14} className="mt-0.5 shrink-0 text-afrocat-gold" />
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {(f.focusAreas || []).map((area: string, j: number) => (
                                  <span key={j} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold">
                                    {area}
                                  </span>
                                ))}
                              </div>
                              {f.matchDate && (
                                <p className="text-xs mt-1 text-afrocat-muted">vs {f.opponent || "Unknown"} &bull; {f.matchDate}</p>
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
                      <Calendar size={16} className="text-afrocat-teal" />
                      <span className="font-bold text-sm text-afrocat-text">Attendance Summary</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Present", value: dash.attendanceSummary?.present ?? 0, cls: "text-afrocat-green" },
                        { label: "Late", value: dash.attendanceSummary?.late ?? 0, cls: "text-afrocat-gold" },
                        { label: "Absent", value: dash.attendanceSummary?.absent ?? 0, cls: "text-afrocat-red" },
                        { label: "Excused", value: dash.attendanceSummary?.excused ?? 0, cls: "text-afrocat-muted" },
                      ].map(s => (
                        <div key={s.label} className="text-center p-4 rounded-xl bg-afrocat-white-3">
                          <div className={`text-3xl font-bold ${s.cls}`}>{s.value}</div>
                          <div className="text-xs mt-1 text-afrocat-muted">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {(dash.attendanceSummary?.expectedSessions > 0 || dash.attendanceSummary?.total > 0) && (
                      <div className="mt-4 space-y-3">
                        {dash.attendanceSummary?.isPerfect && (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold/10 border border-afrocat-gold/40">
                            <span className="text-afrocat-gold text-lg">🌟</span>
                            <span className="text-sm font-bold text-afrocat-gold">Perfect Attendance — 0 absences, 0 late marks</span>
                          </div>
                        )}
                        <div className="p-4 rounded-xl bg-afrocat-teal-soft">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-afrocat-teal">Attend % <span className="text-xs font-normal text-afrocat-muted">(Present+Late+Excused / Expected)</span></span>
                            <span className="text-2xl font-bold text-afrocat-teal">{dash.attendanceSummary.attendRate}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-afrocat-white-10">
                            <div className="h-full rounded-full bg-afrocat-teal transition-all" style={{ width: `${Math.min(100, dash.attendanceSummary.attendRate)}%` }} />
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-afrocat-text">On Time % <span className="text-xs font-normal text-afrocat-muted">(Present only / Expected)</span></span>
                            <span className="text-xl font-bold text-afrocat-text">{dash.attendanceSummary.onTimeRate}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-afrocat-white-10">
                            <div className="h-full rounded-full bg-afrocat-gold transition-all" style={{ width: `${Math.min(100, dash.attendanceSummary.onTimeRate)}%` }} />
                          </div>
                        </div>
                        <p className="text-[11px] text-afrocat-muted text-center">
                          Expected sessions: {dash.attendanceSummary.expectedSessions} &bull; Recorded: {dash.attendanceSummary.total}
                        </p>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "injury" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart size={16} className="text-afrocat-red" />
                      <span className="font-bold text-sm text-afrocat-text">Injury & Wellness</span>
                    </div>
                    {dash.injuryStatus ? (
                      <div className="p-4 rounded-xl bg-afrocat-red-soft border border-afrocat-red/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} className="text-afrocat-red" />
                          <span className="font-bold text-sm text-afrocat-red">Active Injury</span>
                        </div>
                        <p className="text-sm text-afrocat-text">{dash.injuryStatus.injuryType}</p>
                        <div className="flex gap-3 mt-2 text-xs text-afrocat-muted">
                          <span>Severity: <strong className="text-afrocat-gold">{dash.injuryStatus.severity}</strong></span>
                          <span>Since: {dash.injuryStatus.startDate}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl text-center bg-afrocat-green-soft">
                        <CheckCircle size={32} className="mx-auto mb-2 text-afrocat-green" />
                        <p className="font-bold text-sm text-afrocat-green">Fully Fit</p>
                        <p className="text-xs mt-1 text-afrocat-muted">No active injuries</p>
                      </div>
                    )}
                  </div>
                </AcCard>
              )}

              {activeTab === "reports" && (
                <AcCard>
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-afrocat-gold" />
                        <span className="font-bold text-sm text-afrocat-text">Match Stats</span>
                        {(dash.recentStats || []).length > 0 && (
                          <span className="text-xs text-afrocat-muted">
                            ({filteredStats.length} of {dash.recentStats.length} matches)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Search input */}
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-afrocat-muted" />
                          <input
                            type="text"
                            value={statsSearch}
                            onChange={e => setStatsSearch(e.target.value)}
                            placeholder="Search opponent or date..."
                            data-testid="input-stats-search"
                            className="pl-8 pr-7 py-1.5 rounded-lg text-xs bg-afrocat-white-5 border border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:border-afrocat-teal w-48"
                          />
                          {statsSearch && (
                            <button
                              onClick={() => setStatsSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-afrocat-muted hover:text-afrocat-text"
                              data-testid="button-clear-search"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        {/* PDF Download */}
                        <button
                          onClick={handleDownloadPDF}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-afrocat-teal hover:bg-afrocat-teal-dark text-white transition-colors"
                          data-testid="button-download-pdf"
                        >
                          <Download size={13} />
                          Save PDF
                        </button>
                      </div>
                    </div>

                    {(dash.recentStats || []).length === 0 ? (
                      <p className="text-sm py-8 text-center text-afrocat-muted">No match stats recorded yet</p>
                    ) : filteredStats.length === 0 ? (
                      <div className="py-10 text-center">
                        <Search size={28} className="mx-auto mb-2 text-afrocat-muted" />
                        <p className="text-sm text-afrocat-muted">No matches found for "<span className="text-afrocat-text">{statsSearch}</span>"</p>
                        <button onClick={() => setStatsSearch("")} className="text-xs text-afrocat-teal mt-2 underline" data-testid="button-clear-search-empty">Clear search</button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-afrocat-border">
                              {["Date", "Opponent", "Result", "Pts", "Kills", "Aces", "Blks", "Digs", "Asst", "Err"].map(h => (
                                <th key={h} className="px-3 py-2 text-xs uppercase tracking-wider text-afrocat-muted text-center first:text-left">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStats.map((s: any, i: number) => {
                              const totalErrors = (s.spikesError ?? 0) + (s.servesError ?? 0);
                              return (
                                <tr key={i} className="border-b border-afrocat-border hover:bg-afrocat-white-3 transition-colors" data-testid={`row-stat-${i}`}>
                                  <td className="px-3 py-2.5 text-xs text-afrocat-muted whitespace-nowrap">{s.matchDate || "—"}</td>
                                  <td className="px-3 py-2.5 font-medium text-sm text-afrocat-text whitespace-nowrap">{s.opponent || "—"}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {s.result ? (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.result === "W" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                                        {s.result}
                                      </span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-bold text-afrocat-gold">{s.pointsTotal ?? 0}</td>
                                  <td className="px-3 py-2.5 text-center text-afrocat-text">{s.spikesKill ?? 0}</td>
                                  <td className="px-3 py-2.5 text-center text-afrocat-text">{s.servesAce ?? 0}</td>
                                  <td className="px-3 py-2.5 text-center text-afrocat-text">{(s.blocksSolo ?? 0) + (s.blocksAssist ?? 0)}</td>
                                  <td className="px-3 py-2.5 text-center text-afrocat-text">{s.digs ?? 0}</td>
                                  <td className="px-3 py-2.5 text-center text-afrocat-text">{s.settingAssist ?? 0}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className={totalErrors > 3 ? "text-afrocat-red font-bold" : "text-afrocat-text"}>{totalErrors}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-afrocat-teal/30 bg-afrocat-white-3">
                              <td colSpan={3} className="px-3 py-2 text-xs font-bold text-afrocat-muted">TOTALS ({filteredStats.length} matches)</td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-gold">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.pointsTotal ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-teal">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.spikesKill ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-teal">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.servesAce ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-teal">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.blocksSolo ?? 0) + (s.blocksAssist ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-teal">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.digs ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-teal">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.settingAssist ?? 0), 0)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-afrocat-red">
                                {filteredStats.reduce((acc: number, s: any) => acc + (s.spikesError ?? 0) + (s.servesError ?? 0), 0)}
                              </td>
                            </tr>
                          </tfoot>
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
