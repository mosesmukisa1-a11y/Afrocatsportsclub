import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Players() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: players = [], isLoading } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "Male", jerseyNo: 0, position: "Setter", teamId: "", phone: "", dob: "" });

  const createMut = useMutation({
    mutationFn: () => api.createPlayer({ ...form, jerseyNo: Number(form.jerseyNo) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/players"] }); setOpen(false); toast({ title: "Player added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredPlayers = players.filter((p: any) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreate = user && ["ADMIN","MANAGER"].includes(user.role);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Players</h1>
            <p className="text-muted-foreground mt-1">Club roster and athlete profiles</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-player"><Plus className="mr-2 h-4 w-4" /> Add Player</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required /></div>
                    <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required /></div>
                  </div>
                  <div><Label>Team</Label>
                    <Select value={form.teamId} onValueChange={v => setForm({...form, teamId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Jersey #</Label><Input type="number" value={form.jerseyNo} onChange={e => setForm({...form, jerseyNo: Number(e.target.value)})} /></div>
                    <div><Label>Position</Label>
                      <Select value={form.position} onValueChange={v => setForm({...form, position: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Setter","Outside Hitter","Opposite","Middle Blocker","Libero"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Adding..." : "Add Player"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search players..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-players" />
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading players...</div>
        ) : (
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
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player: any) => {
                    const team = teams.find((t: any) => t.id === player.teamId);
                    let statusColor = "bg-green-100 text-green-800";
                    if (player.status === "INJURED") statusColor = "bg-red-100 text-red-800";
                    if (player.status === "SUSPENDED") statusColor = "bg-yellow-100 text-yellow-800";
                    return (
                      <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-player-${player.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {player.firstName[0]}{player.lastName[0]}
                            </div>
                            <div className="font-semibold">{player.firstName} {player.lastName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-muted-foreground">#{player.jerseyNo}</td>
                        <td className="px-6 py-4">{player.position}</td>
                        <td className="px-6 py-4">{team?.name || "—"}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${statusColor}`}>{player.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPlayers.length === 0 && <div className="text-center py-10 text-muted-foreground">No players found.</div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
