import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers, enabled: !!user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams, enabled: !!user && user.role !== "PLAYER" });
  const { data: matches = [] } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches, enabled: !!user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) });
  const { data: injuries = [] } = useQuery({ queryKey: ["/api/injuries"], queryFn: api.getInjuries, enabled: !!user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) });
  const { data: financeTxns = [] } = useQuery({ queryKey: ["/api/finance"], queryFn: api.getFinanceTxns, enabled: !!user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) });

  const totalIncome = financeTxns.filter((f: any) => f.type === "INCOME").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const totalExpense = financeTxns.filter((f: any) => f.type === "EXPENSE").reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const openInjuries = injuries.filter((i: any) => i.status === "OPEN").length;
  const wins = matches.filter((m: any) => m.result === "W").length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.fullName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-total-players">{players.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Across {teams.length} teams</p>
              </CardContent>
            </Card>
          )}
          
          {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Match Record</CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-match-record">{wins} - {matches.length - wins}</div>
                <p className="text-xs text-primary font-medium mt-1">{matches.length > 0 ? (wins / matches.length * 100).toFixed(0) : 0}% Win Rate</p>
              </CardContent>
            </Card>
          )}

          {user && ["ADMIN","MANAGER","FINANCE"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Finance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-net-finance">${totalIncome - totalExpense}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center text-xs text-green-600 font-medium"><ArrowUpRight className="h-3 w-3 mr-1" />${totalIncome}</span>
                  <span className="flex items-center text-xs text-red-600 font-medium"><ArrowDownRight className="h-3 w-3 mr-1" />${totalExpense}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {user && ["ADMIN","MANAGER","MEDICAL"].includes(user.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Injuries</CardTitle>
                <Activity className={`h-4 w-4 ${openInjuries > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display" data-testid="text-open-injuries">{openInjuries}</div>
                <p className="text-xs text-muted-foreground mt-1">Players needing clearance</p>
              </CardContent>
            </Card>
          )}
        </div>

        {user && !["FINANCE","MEDICAL","PLAYER"].includes(user.role) && matches.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Matches</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matches.slice(0, 5).map((match: any) => {
                  const team = teams.find((t: any) => t.id === match.teamId);
                  return (
                    <div key={match.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                      <div>
                        <p className="font-semibold">{team?.name || "Team"} vs {match.opponent}</p>
                        <p className="text-sm text-muted-foreground">{match.matchDate} • {match.competition}</p>
                      </div>
                      {match.result && (
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${match.result === 'W' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {match.result} ({match.setsFor} - {match.setsAgainst})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {user?.role === "PLAYER" && (
          <Card>
            <CardHeader><CardTitle>Your Portal</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Welcome to your player dashboard. Your stats, attendance records, and awards are accessible from here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
