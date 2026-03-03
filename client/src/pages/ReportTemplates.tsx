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
import { FileSpreadsheet, Loader2 } from "lucide-react";

type ReportTab = "season" | "player" | "roster" | "attendance" | "financial";

const tabs: { key: ReportTab; label: string }[] = [
  { key: "season", label: "Season Summary" },
  { key: "player", label: "Player Report" },
  { key: "roster", label: "Team Roster" },
  { key: "attendance", label: "Attendance Summary" },
  { key: "financial", label: "Financial Summary" },
];

function openReportWindow(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function ReportTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>("season");

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

  const handleSuccess = (data: any) => {
    if (data?.html) {
      openReportWindow(data.html);
      toast({ title: "Report generated successfully" });
    } else {
      toast({ title: "No report data returned", variant: "destructive" });
    }
  };

  const handleError = (err: any) => {
    toast({ title: "Failed to generate report", description: err.message, variant: "destructive" });
  };

  const seasonMutation = useMutation({
    mutationFn: () => api.generateSeasonSummary(seasonTeamId && seasonTeamId !== "__all__" ? seasonTeamId : undefined),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const playerMutation = useMutation({
    mutationFn: () => api.generatePlayerReport(playerReportId),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const rosterMutation = useMutation({
    mutationFn: () => api.generateTeamRoster(rosterTeamId),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const attendanceMutation = useMutation({
    mutationFn: () =>
      api.generateAttendanceSummary({
        teamId: attendanceTeamId && attendanceTeamId !== "__all__" ? attendanceTeamId : undefined,
        startDate: attendanceStart || undefined,
        endDate: attendanceEnd || undefined,
      }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const financialMutation = useMutation({
    mutationFn: () =>
      api.generateFinancialSummary({
        startDate: financialStart || undefined,
        endDate: financialEnd || undefined,
      }),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const isGenerating =
    seasonMutation.isPending ||
    playerMutation.isPending ||
    rosterMutation.isPending ||
    attendanceMutation.isPending ||
    financialMutation.isPending;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="text-afrocat-teal" size={28} />
          <div>
            <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-report-templates-title">
              Report Builder
            </h1>
            <p className="text-afrocat-muted text-sm">Generate customizable reports for print or PDF</p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-afrocat-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-afrocat-teal text-afrocat-teal"
                  : "border-transparent text-afrocat-muted hover:text-afrocat-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="afrocat-card rounded-lg p-6 bg-afrocat-card border border-afrocat-border">
          {activeTab === "season" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-afrocat-text">Season Summary Report</h2>
              <p className="text-sm text-afrocat-muted">Generate an overview of the entire season. Optionally filter by team.</p>
              <div className="space-y-2 max-w-md">
                <Label className="text-afrocat-text">Team (optional)</Label>
                <Select value={seasonTeamId} onValueChange={setSeasonTeamId}>
                  <SelectTrigger data-testid="select-season-team">
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
                onClick={() => seasonMutation.mutate()}
                disabled={seasonMutation.isPending}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
              >
                {seasonMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          )}

          {activeTab === "player" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-afrocat-text">Player Report</h2>
              <p className="text-sm text-afrocat-muted">Generate a detailed report for a specific player.</p>
              <div className="space-y-2 max-w-md">
                <Label className="text-afrocat-text">Player</Label>
                <Select value={playerReportId} onValueChange={setPlayerReportId}>
                  <SelectTrigger data-testid="select-player-report">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="button-generate-player"
                onClick={() => playerMutation.mutate()}
                disabled={playerMutation.isPending || !playerReportId}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
              >
                {playerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          )}

          {activeTab === "roster" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-afrocat-text">Team Roster Report</h2>
              <p className="text-sm text-afrocat-muted">Generate the full roster for a team.</p>
              <div className="space-y-2 max-w-md">
                <Label className="text-afrocat-text">Team</Label>
                <Select value={rosterTeamId} onValueChange={setRosterTeamId}>
                  <SelectTrigger data-testid="select-roster-team">
                    <SelectValue placeholder="Select a team" />
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
                onClick={() => rosterMutation.mutate()}
                disabled={rosterMutation.isPending || !rosterTeamId}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
              >
                {rosterMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-afrocat-text">Attendance Summary Report</h2>
              <p className="text-sm text-afrocat-muted">Generate attendance data. Optionally filter by team and date range.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Team (optional)</Label>
                  <Select value={attendanceTeamId} onValueChange={setAttendanceTeamId}>
                    <SelectTrigger data-testid="select-attendance-team">
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
                onClick={() => attendanceMutation.mutate()}
                disabled={attendanceMutation.isPending}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
              >
                {attendanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          )}

          {activeTab === "financial" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-afrocat-text">Financial Summary Report</h2>
              <p className="text-sm text-afrocat-muted">Generate a financial overview. Optionally filter by date range.</p>
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
                onClick={() => financialMutation.mutate()}
                disabled={financialMutation.isPending}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
              >
                {financialMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
