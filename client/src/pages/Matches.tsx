import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Matches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: matches = [], isLoading } = useQuery({ queryKey: ["/api/matches"], queryFn: api.getMatches });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", opponent: "", matchDate: "", venue: "Home", competition: "", result: "" as string, setsFor: 0, setsAgainst: 0 });

  const createMut = useMutation({
    mutationFn: () => api.createMatch({ ...form, result: form.result || null, setsFor: Number(form.setsFor), setsAgainst: Number(form.setsAgainst) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/matches"] }); setOpen(false); toast({ title: "Match created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canCreate = user && ["ADMIN","MANAGER","COACH","STATISTICIAN"].includes(user.role);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Matches</h1>
            <p className="text-muted-foreground mt-1">Schedule and results</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button data-testid="button-add-match"><Plus className="mr-2 h-4 w-4" /> Schedule Match</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Schedule Match</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                  <div><Label>Team</Label>
                    <Select value={form.teamId} onValueChange={v => setForm({...form, teamId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Opponent</Label><Input value={form.opponent} onChange={e => setForm({...form, opponent: e.target.value})} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={form.matchDate} onChange={e => setForm({...form, matchDate: e.target.value})} required /></div>
                    <div><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} /></div>
                  </div>
                  <div><Label>Competition</Label><Input value={form.competition} onChange={e => setForm({...form, competition: e.target.value})} required /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Result</Label>
                      <Select value={form.result} onValueChange={v => setForm({...form, result: v})}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="W">Win</SelectItem><SelectItem value="L">Loss</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Sets For</Label><Input type="number" value={form.setsFor} onChange={e => setForm({...form, setsFor: Number(e.target.value)})} /></div>
                    <div><Label>Sets Against</Label><Input type="number" value={form.setsAgainst} onChange={e => setForm({...form, setsAgainst: Number(e.target.value)})} /></div>
                  </div>
                  <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create Match"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No matches scheduled yet.</div>
        ) : (
          <div className="space-y-4">
            {matches.map((match: any) => {
              const team = teams.find((t: any) => t.id === match.teamId);
              const isWin = match.result === "W";
              return (
                <Card key={match.id} className="overflow-hidden" data-testid={`card-match-${match.id}`}>
                  <div className="flex flex-col md:flex-row">
                    <div className={`w-full md:w-3 ${match.result ? (isWin ? 'bg-green-500' : 'bg-red-500') : 'bg-muted'} h-2 md:h-auto`}></div>
                    <CardContent className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-medium bg-primary/10 text-primary px-2 py-1 rounded">{match.competition}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {match.matchDate}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {match.venue}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex-1 text-right"><h3 className="text-xl font-bold font-display">{team?.name || "Team"}</h3></div>
                            <div className="px-4 py-2 bg-muted rounded-lg flex items-center justify-center min-w-[100px]">
                              <span className="text-2xl font-bold font-display">{match.setsFor}</span>
                              <span className="mx-2 text-muted-foreground">-</span>
                              <span className="text-2xl font-bold font-display">{match.setsAgainst}</span>
                            </div>
                            <div className="flex-1"><h3 className="text-xl font-bold font-display">{match.opponent}</h3></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
