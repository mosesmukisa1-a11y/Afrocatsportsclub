import { Layout } from "@/components/Layout";
import { openHtmlAsPdf } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { FileText, Download, Printer, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateMatchReportHTML } from "@/lib/matchReport";

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
