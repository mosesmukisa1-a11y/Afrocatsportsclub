import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Injuries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: injuries = [], isLoading } = useQuery({ queryKey: ["/api/injuries"], queryFn: api.getInjuries });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ playerId: "", injuryType: "", severity: "MEDIUM" as string, startDate: "" });

  const createMut = useMutation({
    mutationFn: () => api.createInjury(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/injuries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setOpen(false); toast({ title: "Injury logged" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [clearNote, setClearNote] = useState("");
  const [clearId, setClearId] = useState<string | null>(null);

  const clearMut = useMutation({
    mutationFn: (id: string) => api.clearInjury(id, clearNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/injuries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setClearId(null); setClearNote(""); toast({ title: "Injury cleared" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openInjuries = injuries.filter((i: any) => i.status === "OPEN");
  const clearedInjuries = injuries.filter((i: any) => i.status === "CLEARED");

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Injuries & Wellness</h1>
            <p className="text-muted-foreground mt-1">Medical tracking and clearance workflow</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-injury"><Plus className="mr-2 h-4 w-4" /> Log Injury</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Injury</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                <div><Label>Player</Label>
                  <Select value={form.playerId} onValueChange={v => setForm({...form, playerId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Injury Type</Label><Input value={form.injuryType} onChange={e => setForm({...form, injuryType: e.target.value})} required /></div>
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required /></div>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Logging..." : "Log Injury"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Clearance modal */}
        {clearId && (
          <Card className="border-2 border-primary">
            <CardHeader><CardTitle>Clear Injury</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Clearance Note</Label><Input value={clearNote} onChange={e => setClearNote(e.target.value)} placeholder="Recovery notes..." /></div>
              <div className="flex gap-2">
                <Button onClick={() => clearMut.mutate(clearId)} disabled={clearMut.isPending}><CheckCircle className="w-4 h-4 mr-2" />{clearMut.isPending ? "Clearing..." : "Clear Injury"}</Button>
                <Button variant="outline" onClick={() => setClearId(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold mb-4 text-destructive">Open Injuries ({openInjuries.length})</h2>
              {openInjuries.length === 0 ? <p className="text-muted-foreground">No active injuries.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openInjuries.map((i: any) => {
                    const player = players.find((p: any) => p.id === i.playerId);
                    return (
                      <Card key={i.id} className="border-l-4 border-l-destructive">
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{player?.firstName} {player?.lastName}</h3>
                              <p className="text-sm text-muted-foreground">{i.injuryType} • {i.severity} severity</p>
                              <p className="text-xs text-muted-foreground mt-1">Since {i.startDate}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => setClearId(i.id)} data-testid={`button-clear-injury-${i.id}`}>Clear</Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
            {clearedInjuries.length > 0 && (
              <div>
                <h2 className="text-xl font-display font-bold mb-4 text-green-600">Cleared ({clearedInjuries.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clearedInjuries.map((i: any) => {
                    const player = players.find((p: any) => p.id === i.playerId);
                    return (
                      <Card key={i.id} className="border-l-4 border-l-green-500 opacity-70">
                        <CardContent className="p-5">
                          <h3 className="font-semibold">{player?.firstName} {player?.lastName}</h3>
                          <p className="text-sm text-muted-foreground">{i.injuryType} • Cleared</p>
                          {i.clearanceNote && <p className="text-xs text-muted-foreground mt-1">{i.clearanceNote}</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
