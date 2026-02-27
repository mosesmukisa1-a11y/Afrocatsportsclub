import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { mockPlayers, mockTeams } from "@/lib/mock-data";
import { useState } from "react";

export default function Players() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlayers = mockPlayers.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Players</h1>
            <p className="text-muted-foreground mt-1">Club roster and athlete profiles</p>
          </div>
          <Button data-testid="button-add-player">
            <Plus className="mr-2 h-4 w-4" /> Add Player
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search players by name or position..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="sm:w-auto w-full">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>

        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Player</th>
                  <th className="px-6 py-4 font-semibold">Jersey</th>
                  <th className="px-6 py-4 font-semibold">Position</th>
                  <th className="px-6 py-4 font-semibold">Team</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const team = mockTeams.find(t => t.id === player.teamId);
                  
                  let statusColor = "bg-green-100 text-green-800";
                  if (player.status === "INJURED") statusColor = "bg-red-100 text-red-800";
                  if (player.status === "SUSPENDED") statusColor = "bg-yellow-100 text-yellow-800";

                  return (
                    <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {player.firstName[0]}{player.lastName[0]}
                          </div>
                          <div className="font-semibold text-foreground">
                            {player.firstName} {player.lastName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">
                        #{player.jerseyNo}
                      </td>
                      <td className="px-6 py-4">
                        {player.position}
                      </td>
                      <td className="px-6 py-4">
                        {team?.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${statusColor}`}>
                          {player.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlayers.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                No players found.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}