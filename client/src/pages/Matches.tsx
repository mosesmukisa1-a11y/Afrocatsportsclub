import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, MapPin } from "lucide-react";
import { mockMatches, mockTeams } from "@/lib/mock-data";

export default function Matches() {
  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Matches</h1>
            <p className="text-muted-foreground mt-1">Schedule and results</p>
          </div>
          <Button data-testid="button-add-match">
            <Plus className="mr-2 h-4 w-4" /> Schedule Match
          </Button>
        </div>

        <div className="space-y-4">
          {mockMatches.map((match) => {
            const team = mockTeams.find(t => t.id === match.teamId);
            const isWin = match.result === "W";
            
            return (
              <Card key={match.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Result Indicator Banner */}
                  <div className={`w-full md:w-3 ${isWin ? 'bg-green-500' : 'bg-red-500'} h-2 md:h-auto`}></div>
                  
                  <CardContent className="flex-1 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center font-medium bg-secondary/10 text-secondary-foreground px-2 py-1 rounded">
                            {match.competition}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {match.matchDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {match.venue}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex-1 text-right">
                            <h3 className="text-xl font-bold font-display">{team?.name}</h3>
                          </div>
                          
                          <div className="px-4 py-2 bg-muted rounded-lg flex items-center justify-center min-w-[100px]">
                            <span className="text-2xl font-bold font-display">{match.setsFor}</span>
                            <span className="mx-2 text-muted-foreground">-</span>
                            <span className="text-2xl font-bold font-display">{match.setsAgainst}</span>
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="text-xl font-bold font-display">{match.opponent}</h3>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                        <Button variant="outline" size="sm" className="w-full">Match Report</Button>
                        <Button variant="secondary" size="sm" className="w-full">View Stats</Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}