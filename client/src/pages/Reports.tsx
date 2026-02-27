import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { FileText, Download, Printer } from "lucide-react";

export default function Reports() {
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const { data: matchStats = [] } = useQuery({
    queryKey: ["/api/stats/match", selectedMatchId],
    queryFn: () => api.getStatsByMatch(selectedMatchId),
    enabled: !!selectedMatchId,
  });

  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);
  const matchTeam = teams.find((t: any) => t.id === selectedMatch?.teamId);

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
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Match reports and performance analysis</p>
        </div>

        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Match Report</CardTitle>
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
          </CardHeader>

          {selectedMatchId && selectedMatch && (
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-display font-bold">{matchTeam?.name} vs {selectedMatch.opponent}</h2>
                  <p className="text-muted-foreground">{selectedMatch.matchDate} • {selectedMatch.venue} • {selectedMatch.competition}</p>
                  {selectedMatch.result && (
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold ${selectedMatch.result === 'W' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {selectedMatch.result === 'W' ? 'Victory' : 'Defeat'} ({selectedMatch.setsFor} - {selectedMatch.setsAgainst})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportJSON} data-testid="button-export-json"><Download className="h-4 w-4 mr-1" /> JSON</Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print"><Printer className="h-4 w-4 mr-1" /> Print</Button>
                </div>
              </div>

              {matchStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
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
                          <tr key={s.id} className="border-b hover:bg-muted/10">
                            <td className="px-4 py-3 font-medium">{player?.firstName} {player?.lastName}</td>
                            <td className="px-3 py-3 text-center">{s.spikesKill}</td>
                            <td className="px-3 py-3 text-center">{s.servesAce}</td>
                            <td className="px-3 py-3 text-center">{(s.blocksSolo || 0) + (s.blocksAssist || 0)}</td>
                            <td className="px-3 py-3 text-center">{s.digs}</td>
                            <td className="px-3 py-3 text-center">{s.settingAssist}</td>
                            <td className="px-3 py-3 text-center font-bold">{s.pointsTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">No stats recorded for this match yet.</p>
              )}
            </CardContent>
          )}

          {!selectedMatchId && (
            <CardContent className="py-10 text-center text-muted-foreground">Select a match to view the report.</CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
