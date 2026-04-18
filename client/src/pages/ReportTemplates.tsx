import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileSpreadsheet, Loader2, Trophy, Users, ClipboardList,
  Calendar, DollarSign, BarChart2, CheckCircle2, FileText,
  Download, ChevronRight, Info, Star, Shield
} from "lucide-react";

type ReportTab = "match" | "season" | "player" | "roster" | "attendance" | "financial";

const tabs: { key: ReportTab; label: string; icon: any; roles?: string[] }[] = [
  { key: "match",      label: "Match Stats",       icon: BarChart2 },
  { key: "season",     label: "Season Summary",    icon: Trophy },
  { key: "player",     label: "Player Report",     icon: Star },
  { key: "roster",     label: "Team Roster",       icon: Users },
  { key: "attendance", label: "Attendance",         icon: Calendar },
  { key: "financial",  label: "Financial",          icon: DollarSign, roles: ["ADMIN", "MANAGER", "FINANCE"] },
];

function openReportWindow(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function ReportCard({ children, color = "teal" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className={`rounded-2xl border bg-afrocat-card p-6 space-y-5 border-afrocat-border`}>
      {children}
    </div>
  );
}

function IncludesList({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl bg-afrocat-white-3 border border-afrocat-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={13} className="text-afrocat-muted" />
        <span className="text-xs font-bold text-afrocat-muted uppercase tracking-wider">This report includes</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-afrocat-text">
            <CheckCircle2 size={12} className="text-afrocat-teal shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReportTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>("match");
  const [lastGenerated, setLastGenerated] = useState<ReportTab | null>(null);

  const [matchId, setMatchId] = useState("");
  const [seasonTeamId, setSeasonTeamId] = useState("");
  const [playerReportId, setPlayerReportId] = useState("");
  const [rosterTeamId, setRosterTeamId] = useState("");
  const [attendanceTeamId, setAttendanceTeamId] = useState("");
  const [attendanceStart, setAttendanceStart] = useState("");
  const [attendanceEnd, setAttendanceEnd] = useState("");
  const [financialStart, setFinancialStart] = useState("");
  const [financialEnd, setFinancialEnd] = useState("");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.getTeams });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: api.getPlayers });
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });

  const sortedPlayers = [...players].sort((a: any, b: any) =>
    (a.fullName || "").localeCompare(b.fullName || "")
  );
  const finalisedMatches = matches.filter((m: any) => m.statsEntered || m.result);

  const handleSuccess = (tab: ReportTab) => (data: any) => {
    if (data?.html) {
      openReportWindow(data.html);
      setLastGenerated(tab);
      toast({ title: "Report generated!", description: "Opening in a new tab — use browser Save as PDF to download." });
    } else {
      toast({ title: "No report data returned", variant: "destructive" });
    }
  };

  const handleError = (err: any) => {
    toast({ title: "Failed to generate report", description: err.message || "Server error", variant: "destructive" });
  };

  const seasonMut = useMutation({
    mutationFn: () => api.generateSeasonSummary(seasonTeamId && seasonTeamId !== "__all__" ? seasonTeamId : undefined),
    onSuccess: handleSuccess("season"), onError: handleError,
  });
  const playerMut = useMutation({
    mutationFn: () => api.generatePlayerReport(playerReportId),
    onSuccess: handleSuccess("player"), onError: handleError,
  });
  const rosterMut = useMutation({
    mutationFn: () => api.generateTeamRoster(rosterTeamId),
    onSuccess: handleSuccess("roster"), onError: handleError,
  });
  const attendanceMut = useMutation({
    mutationFn: () => api.generateAttendanceSummary({
      teamId: attendanceTeamId && attendanceTeamId !== "__all__" ? attendanceTeamId : undefined,
      startDate: attendanceStart || undefined,
      endDate: attendanceEnd || undefined,
    }),
    onSuccess: handleSuccess("attendance"), onError: handleError,
  });
  const financialMut = useMutation({
    mutationFn: () => api.generateFinancialSummary({
      startDate: financialStart || undefined,
      endDate: financialEnd || undefined,
    }),
    onSuccess: handleSuccess("financial"), onError: handleError,
  });

  const isGenerating =
    seasonMut.isPending || playerMut.isPending || rosterMut.isPending ||
    attendanceMut.isPending || financialMut.isPending;

  const visibleTabs = tabs.filter(t => {
    if (!t.roles) return true;
    return t.roles.some(r => user?.role === r || (user?.roles || []).includes(r));
  });

  const selectedMatch = matches.find((m: any) => m.id === matchId);
  const selectedTeamForMatch = teams.find((t: any) => t.id === selectedMatch?.teamId);

  function openMatchPdf() {
    const token = localStorage.getItem("token") || "";
    window.open(`/api/matches/${matchId}/stats-report/print?token=${token}`, "_blank");
    setLastGenerated("match");
    toast({ title: "Opening Stats PDF…", description: "Use browser Save as PDF to download." });
  }

  function openMatchActivity() {
    const token = localStorage.getItem("token") || "";
    window.open(`/api/matches/${matchId}/activity-report?token=${token}`, "_blank");
  }

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="text-afrocat-teal" size={28} />
          <div>
            <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-report-templates-title">
              Report Builder
            </h1>
            <p className="text-afrocat-muted text-sm">Generate professional reports for print or PDF download</p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-afrocat-border">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                activeTab === tab.key
                  ? "border-afrocat-teal text-afrocat-teal"
                  : "border-transparent text-afrocat-muted hover:text-afrocat-text"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "match" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <BarChart2 size={18} className="text-afrocat-teal" /> Match Stats Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">
                Generate a full A4-formatted player statistics report for a match — ready to print or save as PDF.
              </p>
            </div>

            <IncludesList items={[
              "Match header: teams, date, venue, competition, format, result",
              "Full player stats table: kills, aces, blocks, digs, assists, receptions, errors, net points",
              "Team totals row with aggregate numbers",
              "Per-player Training Focus Areas (position-specific weaknesses)",
              "Stats key / legend at the bottom",
              "Auto-triggers browser print/save-as-PDF dialog",
            ]} />

            <div className="space-y-2 max-w-lg">
              <Label className="text-afrocat-text">Select Match</Label>
              <Select value={matchId} onValueChange={setMatchId}>
                <SelectTrigger data-testid="select-match-report" className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                  <SelectValue placeholder="Choose a match…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {matches.length === 0 && <SelectItem value="__none__" disabled>No matches found</SelectItem>}
                  {[...matches].sort((a: any, b: any) => (b.matchDate || "").localeCompare(a.matchDate || "")).map((m: any) => {
                    const t = teams.find((t: any) => t.id === m.teamId);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {m.matchDate} — {t?.name || "?"} vs {m.opponent}
                        {m.result ? ` (${m.result})` : ""}
                        {!m.statsEntered ? " [no stats]" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedMatch && (
              <div className="rounded-xl bg-afrocat-white-3 border border-afrocat-border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold text-sm text-afrocat-text">
                      {selectedTeamForMatch?.name || "Afrocat"} vs {selectedMatch.opponent}
                    </div>
                    <div className="text-xs text-afrocat-muted mt-0.5">
                      {selectedMatch.matchDate} &bull; {selectedMatch.venue} &bull; {selectedMatch.competition || "—"}
                      {selectedMatch.bestOf && ` &bull; Best of ${selectedMatch.bestOf}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedMatch.result ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedMatch.result === "W" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                        {selectedMatch.result === "W" ? "WIN" : "LOSS"} {selectedMatch.setsFor}-{selectedMatch.setsAgainst}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-afrocat-white-10 text-afrocat-muted">No result</span>
                    )}
                    {selectedMatch.statsEntered ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-afrocat-teal-soft text-afrocat-teal font-bold">Stats ready</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold">No stats</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                data-testid="button-generate-match-pdf"
                onClick={openMatchPdf}
                disabled={!matchId || !selectedMatch?.statsEntered}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
              >
                <Download size={15} /> Download Stats PDF
              </Button>
              <Button
                data-testid="button-generate-match-activity"
                variant="outline"
                onClick={openMatchActivity}
                disabled={!matchId}
                className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5 flex items-center gap-2"
              >
                <FileText size={15} /> Full Activity Report
              </Button>
            </div>
            {matchId && !selectedMatch?.statsEntered && (
              <p className="text-xs text-afrocat-gold flex items-center gap-1.5">
                <Info size={12} /> Stats PDF requires finalized match stats. Use the Activity Report for event timeline only.
              </p>
            )}
          </ReportCard>
        )}

        {activeTab === "season" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <Trophy size={18} className="text-afrocat-gold" /> Season Summary Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">A full overview of the season with match results and top performers.</p>
            </div>

            <IncludesList items={[
              "Win / loss record with win percentage",
              "All match results listed chronologically",
              "Top 10 performers by total points",
              "Per-player kills, aces, blocks, digs, and assists",
              "Filter by team or view all teams combined",
            ]} />

            <div className="space-y-2 max-w-md">
              <Label className="text-afrocat-text">Team (optional)</Label>
              <Select value={seasonTeamId} onValueChange={setSeasonTeamId}>
                <SelectTrigger data-testid="select-season-team" className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Teams</SelectItem>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="button-generate-season"
              onClick={() => seasonMut.mutate()}
              disabled={seasonMut.isPending}
              className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
            >
              {seasonMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {seasonMut.isPending ? "Generating…" : "Generate Report"}
            </Button>

            {lastGenerated === "season" && !seasonMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-afrocat-green">
                <CheckCircle2 size={14} /> Report opened in new tab — use File → Print → Save as PDF
              </div>
            )}
          </ReportCard>
        )}

        {activeTab === "player" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <Star size={18} className="text-afrocat-gold" /> Player Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">Detailed individual report for a specific player with full career stats.</p>
            </div>

            <IncludesList items={[
              "Player profile: name, position, jersey, age, height, weight, nationality",
              "Team and contract information",
              "Career statistics across all matches: kills, aces, blocks, digs, assists, points",
              "Awards and honours received",
              "Generated date and club branding",
            ]} />

            <div className="space-y-2 max-w-md">
              <Label className="text-afrocat-text">Select Player</Label>
              <Select value={playerReportId} onValueChange={setPlayerReportId}>
                <SelectTrigger data-testid="select-player-report" className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                  <SelectValue placeholder="Choose a player…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {sortedPlayers.map((p: any) => {
                    const t = teams.find((t: any) => t.id === p.teamId);
                    return (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.fullName || `${p.firstName} ${p.lastName}`}
                        {p.position ? ` — ${p.position}` : ""}
                        {t ? ` (${t.name})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="button-generate-player"
              onClick={() => playerMut.mutate()}
              disabled={playerMut.isPending || !playerReportId}
              className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
            >
              {playerMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {playerMut.isPending ? "Generating…" : "Generate Report"}
            </Button>

            {lastGenerated === "player" && !playerMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-afrocat-green">
                <CheckCircle2 size={14} /> Report opened in new tab — use File → Print → Save as PDF
              </div>
            )}
          </ReportCard>
        )}

        {activeTab === "roster" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <Users size={18} className="text-afrocat-teal" /> Team Roster Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">Official roster sheet for a team, suitable for competition submission.</p>
            </div>

            <IncludesList items={[
              "All active players listed by jersey number",
              "Full name, position, jersey number",
              "Date of birth, age, height, weight",
              "Matches played and total points this season",
              "Club branding header and generation date",
            ]} />

            <div className="space-y-2 max-w-md">
              <Label className="text-afrocat-text">Select Team</Label>
              <Select value={rosterTeamId} onValueChange={setRosterTeamId}>
                <SelectTrigger data-testid="select-roster-team" className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                  <SelectValue placeholder="Choose a team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="button-generate-roster"
              onClick={() => rosterMut.mutate()}
              disabled={rosterMut.isPending || !rosterTeamId}
              className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
            >
              {rosterMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {rosterMut.isPending ? "Generating…" : "Generate Roster"}
            </Button>

            {lastGenerated === "roster" && !rosterMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-afrocat-green">
                <CheckCircle2 size={14} /> Roster opened in new tab — use File → Print → Save as PDF
              </div>
            )}
          </ReportCard>
        )}

        {activeTab === "attendance" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <Calendar size={18} className="text-afrocat-teal" /> Attendance Summary Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">Player attendance rates across training sessions for a given period.</p>
            </div>

            <IncludesList items={[
              "Number of sessions in the selected period",
              "Per-player present, absent, and attendance percentage",
              "Players sorted by attendance rate (highest first)",
              "Green/red colour coding for above/below 75% threshold",
              "Optional team and date range filters",
            ]} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
              <div className="space-y-2">
                <Label className="text-afrocat-text">Team (optional)</Label>
                <Select value={attendanceTeamId} onValueChange={setAttendanceTeamId}>
                  <SelectTrigger data-testid="select-attendance-team" className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Teams</SelectItem>
                    {teams.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-afrocat-text">Start Date</Label>
                <Input
                  type="date"
                  data-testid="input-attendance-start"
                  value={attendanceStart}
                  onChange={(e) => setAttendanceStart(e.target.value)}
                  className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-afrocat-text">End Date</Label>
                <Input
                  type="date"
                  data-testid="input-attendance-end"
                  value={attendanceEnd}
                  onChange={(e) => setAttendanceEnd(e.target.value)}
                  className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                />
              </div>
            </div>

            <Button
              data-testid="button-generate-attendance"
              onClick={() => attendanceMut.mutate()}
              disabled={attendanceMut.isPending}
              className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
            >
              {attendanceMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {attendanceMut.isPending ? "Generating…" : "Generate Report"}
            </Button>

            {lastGenerated === "attendance" && !attendanceMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-afrocat-green">
                <CheckCircle2 size={14} /> Report opened in new tab — use File → Print → Save as PDF
              </div>
            )}
          </ReportCard>
        )}

        {activeTab === "financial" && (
          <ReportCard>
            <div>
              <h2 className="text-lg font-bold text-afrocat-text flex items-center gap-2">
                <DollarSign size={18} className="text-afrocat-green" /> Financial Summary Report
              </h2>
              <p className="text-sm text-afrocat-muted mt-1">Complete income and expense breakdown for the selected period.</p>
            </div>

            <IncludesList items={[
              "Total income vs total expenses with net balance in N$",
              "Breakdown by category (fees, expenses, donations, etc.)",
              "Full transaction list: date, type, category, description, amount",
              "Colour coded: green for income, red for expenses",
              "Optional date range filter",
            ]} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label className="text-afrocat-text">Start Date</Label>
                <Input
                  type="date"
                  data-testid="input-financial-start"
                  value={financialStart}
                  onChange={(e) => setFinancialStart(e.target.value)}
                  className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-afrocat-text">End Date</Label>
                <Input
                  type="date"
                  data-testid="input-financial-end"
                  value={financialEnd}
                  onChange={(e) => setFinancialEnd(e.target.value)}
                  className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                />
              </div>
            </div>

            <Button
              data-testid="button-generate-financial"
              onClick={() => financialMut.mutate()}
              disabled={financialMut.isPending}
              className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white flex items-center gap-2"
            >
              {financialMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {financialMut.isPending ? "Generating…" : "Generate Report"}
            </Button>

            {lastGenerated === "financial" && !financialMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-afrocat-green">
                <CheckCircle2 size={14} /> Report opened in new tab — use File → Print → Save as PDF
              </div>
            )}
          </ReportCard>
        )}

        <div className="rounded-2xl bg-afrocat-white-3 border border-afrocat-border p-4">
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-afrocat-muted shrink-0 mt-0.5" />
            <div className="text-xs text-afrocat-muted space-y-0.5">
              <p className="font-semibold text-afrocat-text">How to save as PDF</p>
              <p>When a report opens in a new tab: press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) → set Destination to <strong>Save as PDF</strong> → click Save.</p>
              <p>The Match Stats report automatically opens the print dialog. All other reports open in a new window where you can print or save.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
