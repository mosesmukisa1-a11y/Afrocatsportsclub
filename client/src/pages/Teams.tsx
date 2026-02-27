import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Trophy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Teams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MEN");
  const [season, setSeason] = useState("2024/2025");

  const createMut = useMutation({
    mutationFn: () => api.createTeam({ name, category, season }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setOpen(false); setName(""); toast({ title: "Team created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canCreate = user && ["ADMIN","MANAGER"].includes(user.role);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Teams</h1>
            <p className="text-muted-foreground mt-1">Manage club divisions and rosters</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-team"><Plus className="mr-2 h-4 w-4" /> Add Team</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Team</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                  <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required data-testid="input-team-name" /></div>
                  <div><Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEN">Men</SelectItem>
                        <SelectItem value="WOMEN">Women</SelectItem>
                        <SelectItem value="VETERANS">Veterans</SelectItem>
                        <SelectItem value="JUNIORS">Juniors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Season</Label><Input value={season} onChange={e => setSeason(e.target.value)} required /></div>
                  <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create Team"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No teams yet. Create the first one!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team: any) => {
              const playerCount = players.filter((p: any) => p.teamId === team.id).length;
              return (
                <Card key={team.id} className="cursor-pointer transition-all border-l-4 border-l-primary hover:shadow-md" data-testid={`card-team-${team.id}`}>
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
                      <span>{playerCount} Players</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
