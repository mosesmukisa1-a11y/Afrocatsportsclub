import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { mockPlayers, mockTeams, mockMatches, mockFinances, mockInjuries } from "@/lib/mock-data";

export default function Dashboard() {
  const totalIncome = mockFinances.filter(f => f.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = mockFinances.filter(f => f.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);
  const openInjuries = mockInjuries.filter(i => i.status === "OPEN").length;
  
  const wins = mockMatches.filter(m => m.result === "W").length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of Afrocat Club operations</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{mockPlayers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Across {mockTeams.length} teams</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Match Record</CardTitle>
              <Trophy className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{wins} - {mockMatches.length - wins}</div>
              <p className="text-xs text-primary font-medium mt-1">{(wins / mockMatches.length * 100).toFixed(0)}% Win Rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Finance (Month)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">${totalIncome - totalExpense}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center text-xs text-green-600 font-medium">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  ${totalIncome}
                </span>
                <span className="flex items-center text-xs text-red-600 font-medium">
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                  ${totalExpense}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Injuries</CardTitle>
              <Activity className={`h-4 w-4 ${openInjuries > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{openInjuries}</div>
              <p className="text-xs text-muted-foreground mt-1">Players needing clearance</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Matches */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockMatches.map((match) => {
                  const team = mockTeams.find(t => t.id === match.teamId);
                  return (
                    <div key={match.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                      <div>
                        <p className="font-semibold">{team?.name} vs {match.opponent}</p>
                        <p className="text-sm text-muted-foreground">{match.matchDate} • {match.competition}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {match.result} ({match.setsFor} - {match.setsAgainst})
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Injury Watchlist */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Injury Watchlist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockInjuries.filter(i => i.status === "OPEN").map(injury => {
                  const player = mockPlayers.find(p => p.id === injury.playerId);
                  return (
                    <div key={injury.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive font-bold">
                          {player?.firstName[0]}{player?.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold">{player?.firstName} {player?.lastName}</p>
                          <p className="text-sm text-muted-foreground">{injury.injuryType}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md font-medium">
                        {injury.severity} Severity
                      </span>
                    </div>
                  );
                })}
                {openInjuries === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No active injuries!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}