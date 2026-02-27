import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy } from "lucide-react";
import { mockTeams, mockPlayers } from "@/lib/mock-data";

export default function Teams() {
  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Teams</h1>
            <p className="text-muted-foreground mt-1">Manage club divisions and rosters</p>
          </div>
          <Button data-testid="button-add-team">
            <Plus className="mr-2 h-4 w-4" /> Add Team
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockTeams.map((team) => {
            const playerCount = mockPlayers.filter(p => p.teamId === team.id).length;
            return (
              <Card key={team.id} className="hover-elevate cursor-pointer transition-all border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                      <CardDescription className="mt-1">{team.category} • {team.season}</CardDescription>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{playerCount} Active Players</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}