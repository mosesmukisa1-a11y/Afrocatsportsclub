import { Layout } from "@/components/Layout";
import { openHtmlAsPdf } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { FileText, Download, Printer, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AFROCAT_LOGO_BASE64 } from "@/lib/logo-base64";

function generateMatchReportHTML(data: any): string {
  const fmtEff = (v: number | null) => v !== null && v !== undefined ? `${v}%` : "—";
  const effClass = (v: number | null) => v !== null && v !== undefined ? (v >= 40 ? 'highlight' : v < 20 ? 'error' : '') : '';

  const topPerformersRows = (data.topPerformers || []).map((p: any) =>
    `<tr>
      <td>${p.jerseyNo}</td><td><strong>${p.name}</strong></td><td>${p.position}</td>
      <td class="highlight">${p.pointsTotal >= 0 ? '+' : ''}${p.pointsTotal}</td>
      <td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td>
      <td>${p.settingAssist}</td><td>${p.receivePerfect ?? 0}</td>
      <td class="${effClass(p.attackEff)}">${fmtEff(p.attackEff)}</td>
      <td class="${p.totalErrors > 3 ? 'error' : ''}">${p.totalErrors ?? 0}</td>
    </tr>`
  ).join("");

  const errorLeadersRows = (data.errorLeaders || []).map((p: any) =>
    `<tr><td>${p.jerseyNo}</td><td>${p.name}</td><td class="error">${p.totalErrors}</td><td>${p.spikesError}</td><td>${p.servesError}</td><td>${p.receiveError}</td><td>${p.settingError}</td></tr>`
  ).join("");

  const allStatsRows = (data.allPlayerStats || []).map((p: any) =>
    `<tr>
      <td>${p.jerseyNo}</td><td><strong>${p.name}</strong></td><td>${p.position}</td>
      <td class="highlight">${p.pointsTotal >= 0 ? '+' : ''}${p.pointsTotal}</td>
      <td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td>
      <td>${p.settingAssist}</td><td>${p.receivePerfect ?? 0}</td>
      <td class="${effClass(p.attackEff)}">${fmtEff(p.attackEff)}</td>
      <td class="${p.totalErrors > 3 ? 'error' : ''}">${p.totalErrors ?? 0}</td>
    </tr>`
  ).join("");

  const smartFocusRows = (data.smartFocus || []).map((sf: any) =>
    `<tr><td>${sf.playerName}</td><td>${(sf.focusAreas || []).join(", ")}</td></tr>`
  ).join("");

  const resultBadge = data.result
    ? `<span class="result-badge ${data.result === 'W' ? 'win' : 'loss'}">${data.result === 'W' ? 'VICTORY' : 'DEFEAT'} (${data.setsFor || 0} – ${data.setsAgainst || 0})</span>`
    : '<span class="result-badge pending">PENDING</span>';

  const t = data.teamTotals || {};
  const totalErrors = (t.spikesError || 0) + (t.servesError || 0) + (t.receiveError || 0) + (t.settingError || 0);

  const setScoresHtml = (data.setScores || []).length > 0
    ? `<div class="set-scores">${(data.setScores || []).map((s: any) =>
        `<div class="set-card ${s.won ? 'won' : 'lost'}">
          <div class="set-label">Set ${s.setNumber}</div>
          <div class="set-score">${s.home} – ${s.away}</div>
          <div class="set-result">${s.won ? '✓ Won' : '✗ Lost'}</div>
        </div>`
      ).join("")}</div>`
    : "";

  return `<!DOCTYPE html><html><head><title>Match Report - ${data.teamName} vs ${data.opponent}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 960px; margin: 0 auto; padding: 28px; color: #1a1a1a; font-size: 12px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 4px solid #0d6e6e; padding-bottom: 18px; }
  .header img.logo { width: 72px; height: 72px; object-fit: contain; margin-bottom: 8px; }
  .header h1 { color: #0d6e6e; font-size: 22px; letter-spacing: 2px; margin-bottom: 4px; }
  .header .motto { font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 12px; }
  .header h2 { font-size: 16px; color: #333; margin-top: 8px; }
  .match-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: #f8f9fa; padding: 14px; border-radius: 8px; font-size: 12px; }
  .match-info div strong { color: #0d6e6e; display: inline-block; min-width: 90px; }
  .result-badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-top: 8px; }
  .result-badge.win { background: #d4edda; color: #155724; }
  .result-badge.loss { background: #f8d7da; color: #721c24; }
  .result-badge.pending { background: #fff3cd; color: #856404; }
  .section { margin-bottom: 22px; }
  .section h3 { color: #0d6e6e; font-size: 14px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e0e0e0; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
  td:nth-child(2) { text-align: left; }
  th { background: #0d6e6e; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  tr:nth-child(even) { background: #f8f9fa; }
  .highlight { font-weight: bold; color: #0d6e6e; }
  .error { font-weight: bold; color: #dc3545; }
  .totals-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
  .total-card { background: #f0faf9; border: 1px solid #b2dfdb; border-radius: 8px; padding: 10px; text-align: center; }
  .total-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
  .total-card .value { font-size: 20px; font-weight: bold; color: #0d6e6e; margin-top: 2px; }
  .total-card .value.error-val { color: #dc3545; }
  .set-scores { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0 18px; }
  .set-card { border: 2px solid #ccc; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 80px; }
  .set-card.won { border-color: #0d6e6e; background: #f0faf9; }
  .set-card.lost { border-color: #dc3545; background: #fff5f5; }
  .set-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; }
  .set-score { font-size: 20px; font-weight: 900; color: #1a1a1a; margin: 4px 0; }
  .set-result { font-size: 10px; font-weight: bold; }
  .set-card.won .set-result { color: #0d6e6e; }
  .set-card.lost .set-result { color: #dc3545; }
  .legend { margin-top: 8px; font-size: 10px; color: #777; display: flex; flex-wrap: wrap; gap: 12px; }
  .legend span { white-space: nowrap; }
  .footer { text-align: center; margin-top: 36px; padding-top: 14px; border-top: 2px solid #e0e0e0; font-size: 10px; color: #999; }
  @media print { body { margin: 0; padding: 12px; } .no-print { display: none; } @page { size: A4 landscape; margin: 8mm; } }
</style></head><body>
<div class="header">
  <img src="${AFROCAT_LOGO_BASE64}" alt="Afrocat Logo" class="logo" />
  <h1>${data.clubName || 'AFROCAT VOLLEYBALL CLUB'}</h1>
  <div class="motto">${data.motto || 'One Team One Dream — Passion Discipline Victory'}</div>
  <h2>MATCH REPORT</h2>
</div>

<div class="match-info">
  <div><strong>Team:</strong> ${data.teamName}</div>
  <div><strong>Opponent:</strong> ${data.opponent}</div>
  <div><strong>Date:</strong> ${data.matchDate || '—'}</div>
  <div><strong>Venue:</strong> ${data.venue || '—'}</div>
  <div><strong>Competition:</strong> ${data.competition || '—'}</div>
  <div><strong>Coach:</strong> ${data.coachName || 'N/A'}</div>
</div>

<div style="text-align:center;margin-bottom:20px;">
  ${resultBadge}
</div>

${setScoresHtml ? `<div class="section"><h3>Set-by-Set Scores</h3>${setScoresHtml}</div>` : ''}

<div class="section">
  <h3>Team Totals</h3>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Net Points</div><div class="value">${t.pointsTotal >= 0 ? '+' : ''}${t.pointsTotal || 0}</div></div>
    <div class="total-card"><div class="label">Kills</div><div class="value">${t.spikesKill || 0}</div></div>
    <div class="total-card"><div class="label">Aces</div><div class="value">${t.servesAce || 0}</div></div>
    <div class="total-card"><div class="label">Blocks</div><div class="value">${(t.blocksSolo || 0) + (t.blocksAssist || 0)}</div></div>
    <div class="total-card"><div class="label">Digs</div><div class="value">${t.digs || 0}</div></div>
    <div class="total-card"><div class="label">Assists</div><div class="value">${t.settingAssist || 0}</div></div>
    <div class="total-card"><div class="label">Recv+</div><div class="value">${t.receivePerfect || 0}</div></div>
    <div class="total-card"><div class="label">Atk Eff%</div><div class="value ${t.attackEff !== null && t.attackEff < 20 ? 'error-val' : ''}">${fmtEff(t.attackEff)}</div></div>
    <div class="total-card"><div class="label">Atk Att</div><div class="value">${t.attackAtt || 0}</div></div>
    <div class="total-card"><div class="label">Total Errors</div><div class="value error-val">${totalErrors}</div></div>
  </div>
  <div class="legend">
    <span><strong>Net Pts</strong> = Kills + Aces + Block kills − (Attack/Serve/Receive/Setting errors)</span>
    <span><strong>Atk Eff%</strong> = (Kills − Errors) ÷ Total Attacks × 100</span>
    <span><strong>Recv+</strong> = Perfect receptions</span>
  </div>
</div>

<div class="section">
  <h3>Top Performers</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Pos</th><th>Net Pts</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th><th>Recv+</th><th>Atk Eff%</th><th>Errors</th></tr></thead>
    <tbody>${topPerformersRows || '<tr><td colspan="12" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

<div class="section">
  <h3>Error Analysis</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Total Errors</th><th>Attack Err</th><th>Serve Err</th><th>Receive Err</th><th>Setting Err</th></tr></thead>
    <tbody>${errorLeadersRows || '<tr><td colspan="7" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

${smartFocusRows ? `<div class="section">
  <h3>SmartFocus Training Recommendations</h3>
  <table>
    <thead><tr><th>Player</th><th>Focus Areas</th></tr></thead>
    <tbody>${smartFocusRows}</tbody>
  </table>
</div>` : ''}

<div class="section">
  <h3>Full Player Statistics</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Pos</th><th>Net Pts</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th><th>Recv+</th><th>Atk Eff%</th><th>Errors</th></tr></thead>
    <tbody>${allStatsRows || '<tr><td colspan="12" style="text-align:center;">No data</td></tr>'}</tbody>
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
        openHtmlAsPdf(generateMatchReportHTML(result.data));
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
                <SelectTrigger className="w-full md:w-[350px] bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-report-match">
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
                          onClick={() => openHtmlAsPdf(generateMatchReportHTML(meta))}
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
