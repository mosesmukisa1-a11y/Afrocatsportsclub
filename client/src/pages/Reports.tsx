import { Layout } from "@/components/Layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { FileText, Download, Printer, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function generateMatchReportHTML(data: any): string {
  const topPerformersRows = (data.topPerformers || []).map((p: any) =>
    `<tr><td>${p.jerseyNo}</td><td>${p.name}</td><td>${p.position}</td><td class="highlight">${p.pointsTotal}</td><td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td><td>${p.settingAssist}</td></tr>`
  ).join("");

  const errorLeadersRows = (data.errorLeaders || []).map((p: any) =>
    `<tr><td>${p.jerseyNo}</td><td>${p.name}</td><td class="error">${p.totalErrors}</td><td>${p.spikesError}</td><td>${p.servesError}</td><td>${p.receiveError}</td><td>${p.settingError}</td></tr>`
  ).join("");

  const allStatsRows = (data.allPlayerStats || []).map((p: any) =>
    `<tr><td>${p.jerseyNo}</td><td>${p.name}</td><td>${p.position}</td><td class="highlight">${p.pointsTotal}</td><td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td><td>${p.settingAssist}</td></tr>`
  ).join("");

  const smartFocusRows = (data.smartFocus || []).map((sf: any) =>
    `<tr><td>${sf.playerName}</td><td>${(sf.focusAreas || []).join(", ")}</td></tr>`
  ).join("");

  const resultBadge = data.result
    ? `<span class="result-badge ${data.result === 'W' ? 'win' : 'loss'}">${data.result === 'W' ? 'VICTORY' : 'DEFEAT'} (${data.setsFor || 0} - ${data.setsAgainst || 0})</span>`
    : '<span class="result-badge pending">PENDING</span>';

  const t = data.teamTotals || {};

  return `<!DOCTYPE html><html><head><title>Match Report - ${data.teamName} vs ${data.opponent}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 30px; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #0d6e6e; padding-bottom: 20px; }
  .header h1 { color: #0d6e6e; font-size: 24px; letter-spacing: 2px; margin-bottom: 4px; }
  .header .motto { font-size: 11px; color: #888; letter-spacing: 1px; margin-bottom: 15px; }
  .header h2 { font-size: 18px; color: #333; margin-top: 10px; }
  .match-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 13px; }
  .match-info div strong { color: #0d6e6e; display: inline-block; min-width: 100px; }
  .result-badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-top: 10px; }
  .result-badge.win { background: #d4edda; color: #155724; }
  .result-badge.loss { background: #f8d7da; color: #721c24; }
  .result-badge.pending { background: #fff3cd; color: #856404; }
  .section { margin-bottom: 25px; }
  .section h3 { color: #0d6e6e; font-size: 15px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #e0e0e0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
  th { background: #0d6e6e; color: white; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  tr:nth-child(even) { background: #f8f9fa; }
  .highlight { font-weight: bold; color: #0d6e6e; }
  .error { font-weight: bold; color: #dc3545; }
  .totals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
  .total-card { background: #f0faf9; border: 1px solid #b2dfdb; border-radius: 8px; padding: 12px; text-align: center; }
  .total-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .total-card .value { font-size: 22px; font-weight: bold; color: #0d6e6e; }
  .footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 2px solid #e0e0e0; font-size: 11px; color: #999; }
  @media print { body { margin: 0; padding: 15px; } .no-print { display: none; } }
</style></head><body>
<div class="header">
  <h1>${data.clubName || 'AFROCAT VOLLEYBALL CLUB'}</h1>
  <div class="motto">${data.motto || 'One Team One Dream — Passion Discipline Victory'}</div>
  <h2>MATCH REPORT</h2>
</div>

<div class="match-info">
  <div><strong>Team:</strong> ${data.teamName}</div>
  <div><strong>Opponent:</strong> ${data.opponent}</div>
  <div><strong>Date:</strong> ${data.matchDate}</div>
  <div><strong>Venue:</strong> ${data.venue}</div>
  <div><strong>Competition:</strong> ${data.competition}</div>
  <div><strong>Coach:</strong> ${data.coachName || 'N/A'}</div>
</div>

<div style="text-align:center;margin-bottom:25px;">
  ${resultBadge}
</div>

<div class="section">
  <h3>Team Totals</h3>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Points Total</div><div class="value">${t.pointsTotal || 0}</div></div>
    <div class="total-card"><div class="label">Kills</div><div class="value">${t.spikesKill || 0}</div></div>
    <div class="total-card"><div class="label">Aces</div><div class="value">${t.servesAce || 0}</div></div>
    <div class="total-card"><div class="label">Blocks</div><div class="value">${(t.blocksSolo || 0) + (t.blocksAssist || 0)}</div></div>
    <div class="total-card"><div class="label">Digs</div><div class="value">${t.digs || 0}</div></div>
    <div class="total-card"><div class="label">Assists</div><div class="value">${t.settingAssist || 0}</div></div>
    <div class="total-card"><div class="label">Perfect Receives</div><div class="value">${t.receivePerfect || 0}</div></div>
    <div class="total-card"><div class="label">Total Errors</div><div class="value error">${(t.spikesError || 0) + (t.servesError || 0) + (t.receiveError || 0) + (t.settingError || 0)}</div></div>
  </div>
</div>

<div class="section">
  <h3>Top Performers</h3>
  <table>
    <thead><tr><th>Jersey</th><th>Name</th><th>Position</th><th>Points</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th></tr></thead>
    <tbody>${topPerformersRows || '<tr><td colspan="9" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

<div class="section">
  <h3>Error Leaders</h3>
  <table>
    <thead><tr><th>Jersey</th><th>Name</th><th>Total Errors</th><th>Attack Err</th><th>Serve Err</th><th>Receive Err</th><th>Setting Err</th></tr></thead>
    <tbody>${errorLeadersRows || '<tr><td colspan="7" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

${smartFocusRows ? `<div class="section">
  <h3>SmartFocus Summary</h3>
  <table>
    <thead><tr><th>Player</th><th>Focus Areas</th></tr></thead>
    <tbody>${smartFocusRows}</tbody>
  </table>
</div>` : ''}

<div class="section">
  <h3>Full Player Statistics</h3>
  <table>
    <thead><tr><th>Jersey</th><th>Name</th><th>Position</th><th>Points</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th></tr></thead>
    <tbody>${allStatsRows || '<tr><td colspan="9" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

<div class="footer">
  <p>${data.clubName || 'AFROCAT VOLLEYBALL CLUB'} &mdash; ${data.motto || 'One Team One Dream — Passion Discipline Victory'}</p>
  <p>Generated on ${new Date().toLocaleString()}</p>
</div>
</body></html>`;
}

export default function Reports() {
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: matchDocuments = [] } = useQuery({
    queryKey: ["/api/match-documents"],
    queryFn: () => api.getMatchDocuments(),
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const { data: matchStats = [] } = useQuery({
    queryKey: ["/api/stats/match", selectedMatchId],
    queryFn: () => api.getStatsByMatch(selectedMatchId),
    enabled: !!selectedMatchId,
  });

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);
  const matchTeam = teams.find((t: any) => t.id === selectedMatch?.teamId);

  const matchReportDocs = matchDocuments.filter((d: any) => d.documentType === "MATCH_REPORT");

  const generateReportMut = useMutation({
    mutationFn: () => api.generateMatchReport(selectedMatchId, selectedMatch?.teamId),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["/api/match-documents"] });
      toast({ title: "Match report generated!", description: "You can now view and print the report." });
      if (result?.data) {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(generateMatchReportHTML(result.data));
          w.document.close();
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to generate report", variant: "destructive" });
    },
  });

  const exportJSON = () => {
    const data = { match: selectedMatch, team: matchTeam, stats: matchStats.map((s: any) => {
      const player = players.find((p: any) => p.id === s.playerId);
      return { ...s, playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown" };
    })};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `match-report-${selectedMatchId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-reports-title">Reports</h1>
          <p className="text-afrocat-muted mt-1">Match reports and performance analysis</p>
        </div>

        <div className="afrocat-card">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-6 py-4 rounded-t-[18px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-display font-semibold text-afrocat-text flex items-center gap-2"><FileText className="h-5 w-5" /> Match Report</h3>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="w-full md:w-[350px]" data-testid="select-report-match">
                  <SelectValue placeholder="Select a match" />
                </SelectTrigger>
                <SelectContent>
                  {matches.map((m: any) => {
                    const team = teams.find((t: any) => t.id === m.teamId);
                    return <SelectItem key={m.id} value={m.id}>{m.matchDate} — {team?.name} vs {m.opponent}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMatchId && selectedMatch && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-match-heading">{matchTeam?.name} vs {selectedMatch.opponent}</h2>
                  <p className="text-afrocat-muted">{selectedMatch.matchDate} • {selectedMatch.venue} • {selectedMatch.competition}</p>
                  {selectedMatch.result && (
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold ${selectedMatch.result === 'W' ? 'bg-afrocat-green-soft text-afrocat-green' : 'bg-afrocat-red-soft text-afrocat-red'}`} data-testid="text-match-result">
                      {selectedMatch.result === 'W' ? 'Victory' : 'Defeat'} ({selectedMatch.setsFor} - {selectedMatch.setsAgainst})
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => generateReportMut.mutate()}
                    disabled={generateReportMut.isPending || matchStats.length === 0}
                    data-testid="button-generate-report"
                  >
                    {generateReportMut.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-1" /> Generate Match Report</>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportJSON} data-testid="button-export-json"><Download className="h-4 w-4 mr-1" /> JSON</Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print"><Printer className="h-4 w-4 mr-1" /> Print</Button>
                </div>
              </div>

              {matchStats.length === 0 && (
                <div className="flex items-center gap-2 text-afrocat-gold bg-afrocat-gold-soft p-3 rounded-lg" data-testid="text-no-stats-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">No stats recorded for this match. Enter stats first to generate a report.</span>
                </div>
              )}

              {matchStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
                      <tr>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-3 py-3 text-center">K</th>
                        <th className="px-3 py-3 text-center">Ace</th>
                        <th className="px-3 py-3 text-center">Blk</th>
                        <th className="px-3 py-3 text-center">Digs</th>
                        <th className="px-3 py-3 text-center">Ast</th>
                        <th className="px-3 py-3 text-center font-bold">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchStats.sort((a: any, b: any) => (b.pointsTotal || 0) - (a.pointsTotal || 0)).map((s: any) => {
                        const player = players.find((p: any) => p.id === s.playerId);
                        return (
                          <tr key={s.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-stat-${s.id}`}>
                            <td className="px-4 py-3 font-medium text-afrocat-text">{player?.firstName} {player?.lastName}</td>
                            <td className="px-3 py-3 text-center text-afrocat-text">{s.spikesKill}</td>
                            <td className="px-3 py-3 text-center text-afrocat-text">{s.servesAce}</td>
                            <td className="px-3 py-3 text-center text-afrocat-text">{(s.blocksSolo || 0) + (s.blocksAssist || 0)}</td>
                            <td className="px-3 py-3 text-center text-afrocat-text">{s.digs}</td>
                            <td className="px-3 py-3 text-center text-afrocat-text">{s.settingAssist}</td>
                            <td className="px-3 py-3 text-center font-bold text-afrocat-teal">{s.pointsTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!selectedMatchId && (
            <div className="py-10 text-center text-afrocat-muted" data-testid="text-select-match-prompt">Select a match to view the report.</div>
          )}
        </div>

        {matchReportDocs.length > 0 && (
          <div className="afrocat-card">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-6 py-4 rounded-t-[18px]">
              <h3 className="text-lg font-display font-semibold text-afrocat-text flex items-center gap-2"><CheckCircle className="h-5 w-5 text-afrocat-green" /> Previously Generated Match Reports</h3>
            </div>
            <div className="p-4 space-y-3">
              {matchReportDocs.map((doc: any) => {
                const meta = doc.metadata as any;
                const team = teams.find((t: any) => t.id === doc.teamId);
                const match = matches.find((m: any) => m.id === doc.matchId);

                return (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-afrocat-white-3 rounded-lg border border-afrocat-border hover:bg-afrocat-white-5 transition-colors" data-testid={`card-report-${doc.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-afrocat-teal-soft rounded-lg flex items-center justify-center">
                        <FileText size={20} className="text-afrocat-teal" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-afrocat-text" data-testid={`text-report-title-${doc.id}`}>
                          {meta?.teamName || team?.name || "Unknown"} vs {meta?.opponent || match?.opponent || "Unknown"}
                        </h4>
                        <p className="text-xs text-afrocat-muted">
                          {meta?.matchDate || match?.matchDate || ""} • {meta?.competition || ""}
                          {doc.createdAt && ` • Generated ${new Date(doc.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {meta && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const w = window.open("", "_blank");
                            if (w) {
                              w.document.write(generateMatchReportHTML(meta));
                              w.document.close();
                            }
                          }}
                          data-testid={`button-view-report-${doc.id}`}
                        >
                          <Download size={14} className="mr-1" /> View / Print
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
