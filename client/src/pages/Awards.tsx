import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Award as AwardIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const AWARD_LABELS: Record<string, string> = {
  MVP: "MVP",
  MOST_IMPROVED: "Most Improved",
  BEST_SERVER: "Best Server",
  BEST_BLOCKER: "Best Blocker",
  COACH_AWARD: "Coach's Award",
};

export default function Awards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: awards = [], isLoading } = useQuery({ queryKey: ["/api/awards"], queryFn: api.getAwards });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ playerId: "", awardType: "MVP" as string, awardMonth: "", notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createAward(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/awards"] }); setOpen(false); toast({ title: "Award granted!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Awards</h1>
            <p className="text-muted-foreground mt-1">Recognize outstanding players</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-award"><Plus className="mr-2 h-4 w-4" /> Grant Award</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Grant Award</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                <div><Label>Player</Label>
                  <Select value={form.playerId} onValueChange={v => setForm({...form, playerId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Award Type</Label>
                  <Select value={form.awardType} onValueChange={v => setForm({...form, awardType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(AWARD_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Month</Label><Input type="month" value={form.awardMonth} onChange={e => setForm({...form, awardMonth: e.target.value})} required /></div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Granting..." : "Grant Award"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : awards.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No awards granted yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {awards.map((a: any) => {
              const player = players.find((p: any) => p.id === a.playerId);
              return (
                <Card key={a.id} className="border-l-4 border-l-yellow-500 hover:shadow-md transition-shadow" data-testid={`card-award-${a.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <AwardIcon className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{player?.firstName} {player?.lastName}</h3>
                        <p className="text-sm font-medium text-primary">{AWARD_LABELS[a.awardType] || a.awardType}</p>
                        <p className="text-xs text-muted-foreground">{a.awardMonth}</p>
                        {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                      </div>
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
