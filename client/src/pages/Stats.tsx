import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function Stats() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId);

  const { data: matchPlayers = [] } = useQuery({
    queryKey: ["/api/players/team", selectedMatch?.teamId],
    queryFn: () => api.getPlayersByTeam(selectedMatch!.teamId),
    enabled: !!selectedMatch?.teamId,
  });

  const [statsData, setStatsData] = useState<Record<string, any>>({});

  const updateStat = (playerId: string, field: string, value: number) => {
    setStatsData(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  };

  const submitMut = useMutation({
    mutationFn: () => {
      const payload = matchPlayers.map((p: any) => ({
        playerId: p.id,
        spikesKill: statsData[p.id]?.spikesKill || 0,
        spikesError: statsData[p.id]?.spikesError || 0,
        servesAce: statsData[p.id]?.servesAce || 0,
        servesError: statsData[p.id]?.servesError || 0,
        blocksSolo: statsData[p.id]?.blocksSolo || 0,
        blocksAssist: statsData[p.id]?.blocksAssist || 0,
        receivePerfect: statsData[p.id]?.receivePerfect || 0,
        receiveError: statsData[p.id]?.receiveError || 0,
        digs: statsData[p.id]?.digs || 0,
        settingAssist: statsData[p.id]?.settingAssist || 0,
        settingError: statsData[p.id]?.settingError || 0,
        minutesPlayed: statsData[p.id]?.minutesPlayed || 0,
      }));
      return api.submitStats(selectedMatchId, payload);
    },
    onSuccess: () => { toast({ title: "Stats saved and Smart Focus generated!" }); queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fields = [
    { key: "spikesKill", label: "Kill" }, { key: "spikesError", label: "Err" },
    { key: "servesAce", label: "Ace" }, { key: "servesError", label: "Err" },
    { key: "blocksSolo", label: "Solo" }, { key: "blocksAssist", label: "Ast" },
    { key: "receivePerfect", label: "Perf" }, { key: "receiveError", label: "Err" },
    { key: "digs", label: "Digs" }, { key: "settingAssist", label: "S.Ast" }, { key: "settingError", label: "S.Err" },
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Enter Stats</h1>
          <p className="text-muted-foreground mt-1">Record player performance and generate Smart Focus</p>
        </div>

        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>Select Match</CardTitle>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="w-full md:w-[300px]" data-testid="select-match">
                  <SelectValue placeholder="Select a match" />
                </SelectTrigger>
                <SelectContent>
                  {matches.map((m: any) => {
                    const team = teams.find((t: any) => t.id === m.teamId);
                    return <SelectItem key={m.id} value={m.id}>{m.matchDate} - {team?.name} vs {m.opponent}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          {selectedMatchId && matchPlayers.length > 0 && (
            <CardContent className="p-0">
              <div className="p-4 bg-primary/5 border-b flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <p className="text-sm text-primary/80">Submitting stats will auto-generate Smart Focus training recommendations.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left sticky left-0 bg-background border-r">Player</th>
                      {fields.map(f => <th key={f.key} className="px-2 py-3 text-center min-w-[60px]">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {matchPlayers.map((player: any) => (
                      <tr key={player.id} className="border-b hover:bg-muted/10">
                        <td className="px-4 py-2 font-medium sticky left-0 bg-background border-r whitespace-nowrap">
                          #{player.jerseyNo} {player.firstName} {player.lastName[0]}.
                        </td>
                        {fields.map(f => (
                          <td key={f.key} className="px-1 py-2">
                            <Input type="number" className="w-14 h-8 text-center px-1"
                              value={statsData[player.id]?.[f.key] || 0}
                              onChange={e => updateStat(player.id, f.key, parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-6 border-t bg-muted/10 flex justify-end">
                <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} data-testid="button-submit-stats">
                  <Save className="w-4 h-4 mr-2" /> {submitMut.isPending ? "Saving..." : "Save Stats & Generate Insights"}
                </Button>
              </div>
            </CardContent>
          )}

          {selectedMatchId && matchPlayers.length === 0 && (
            <CardContent className="py-10 text-center text-muted-foreground">No players found for this team.</CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
