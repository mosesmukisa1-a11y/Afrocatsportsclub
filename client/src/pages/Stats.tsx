import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockMatches, mockPlayers, mockTeams } from "@/lib/mock-data";
import { Save, AlertCircle } from "lucide-react";

export default function Stats() {
  const match = mockMatches[0];
  const team = mockTeams.find(t => t.id === match.teamId);
  const matchPlayers = mockPlayers.filter(p => p.teamId === match.teamId);

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
              <div className="space-y-1">
                <CardTitle>Select Match</CardTitle>
                <p className="text-sm text-muted-foreground">Choose a recent match to input statistics</p>
              </div>
              <Select defaultValue={match.id}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select a match" />
                </SelectTrigger>
                <SelectContent>
                  {mockMatches.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.matchDate} - vs {m.opponent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="p-6 bg-primary/5 border-b flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-primary">Smart Focus Engine</h4>
                <p className="text-sm text-primary/80">
                  Submitting these stats will automatically generate personalized "Smart Focus" training recommendations for each player based on their performance metrics.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-[200px] sticky left-0 bg-background border-r">Player</th>
                    <th className="px-4 py-3 font-semibold text-center border-r" colSpan={2}>Spikes</th>
                    <th className="px-4 py-3 font-semibold text-center border-r" colSpan={2}>Serves</th>
                    <th className="px-4 py-3 font-semibold text-center border-r" colSpan={2}>Blocks</th>
                    <th className="px-4 py-3 font-semibold text-center border-r" colSpan={2}>Reception</th>
                    <th className="px-4 py-3 font-semibold text-center">Other</th>
                  </tr>
                  <tr className="border-b">
                    <th className="px-4 py-2 sticky left-0 bg-background border-r">Name</th>
                    <th className="px-2 py-2 text-center text-[10px]">Kill</th>
                    <th className="px-2 py-2 text-center text-[10px] border-r">Err</th>
                    <th className="px-2 py-2 text-center text-[10px]">Ace</th>
                    <th className="px-2 py-2 text-center text-[10px] border-r">Err</th>
                    <th className="px-2 py-2 text-center text-[10px]">Solo</th>
                    <th className="px-2 py-2 text-center text-[10px] border-r">Ast</th>
                    <th className="px-2 py-2 text-center text-[10px]">Perf</th>
                    <th className="px-2 py-2 text-center text-[10px] border-r">Err</th>
                    <th className="px-2 py-2 text-center text-[10px]">Digs</th>
                  </tr>
                </thead>
                <tbody>
                  {matchPlayers.map((player) => (
                    <tr key={player.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium sticky left-0 bg-background border-r whitespace-nowrap">
                        <span className="text-muted-foreground mr-2">#{player.jerseyNo}</span>
                        {player.firstName} {player.lastName[0]}.
                      </td>
                      <td className="px-2 py-2"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      <td className="px-2 py-2 border-r"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      
                      <td className="px-2 py-2"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      <td className="px-2 py-2 border-r"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      
                      <td className="px-2 py-2"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      <td className="px-2 py-2 border-r"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      
                      <td className="px-2 py-2"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      <td className="px-2 py-2 border-r"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                      
                      <td className="px-2 py-2"><Input type="number" defaultValue="0" className="w-14 h-8 text-center px-1" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 border-t bg-muted/10 flex justify-end">
              <Button data-testid="button-submit-stats">
                <Save className="w-4 h-4 mr-2" />
                Save Stats & Generate Insights
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}