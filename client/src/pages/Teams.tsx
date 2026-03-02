import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Trophy, Pencil } from "lucide-react";
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

  const [editOpen, setEditOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSeason, setEditSeason] = useState("");

  const createMut = useMutation({
    mutationFn: () => api.createTeam({ name, category, season }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setOpen(false); setName(""); toast({ title: "Team created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () => api.updateTeam(editTeam.id, { name: editName, category: editCategory, season: editSeason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setEditOpen(false); setEditTeam(null); toast({ title: "Team updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canCreate = user && ["ADMIN", "MANAGER"].includes(user.role);
  const canEdit = user && ["ADMIN", "MANAGER"].includes(user.role);

  const openEditDialog = (team: any) => {
    setEditTeam(team);
    setEditName(team.name);
    setEditCategory(team.category);
    setEditSeason(team.season);
    setEditOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Teams</h1>
            <p className="text-afrocat-muted mt-1">Manage club divisions and rosters</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-add-team"><Plus className="mr-2 h-4 w-4" /> Add Team</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Team</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                  <div><Label className="text-afrocat-muted text-sm">Name</Label><Input value={name} onChange={e => setName(e.target.value)} required data-testid="input-team-name" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
                  <div><Label className="text-afrocat-muted text-sm">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEN">Men</SelectItem>
                        <SelectItem value="WOMEN">Women</SelectItem>
                        <SelectItem value="VETERANS">Veterans</SelectItem>
                        <SelectItem value="JUNIORS">Juniors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-afrocat-muted text-sm">Season</Label><Input value={season} onChange={e => setSeason(e.target.value)} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
                  <Button type="submit" disabled={createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white">{createMut.isPending ? "Creating..." : "Create Team"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-afrocat-muted">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-10 text-afrocat-muted">No teams yet. Create the first one!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team: any) => {
              const playerCount = players.filter((p: any) => p.teamId === team.id).length;
              return (
                <div key={team.id} className="afrocat-card p-5 hover:border-afrocat-teal/30 transition-all" data-testid={`card-team-${team.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-display font-bold text-afrocat-text" data-testid={`text-team-name-${team.id}`}>{team.name}</h3>
                      <p className="text-sm text-afrocat-muted mt-1">{team.category} • {team.season}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => openEditDialog(team)}
                          className="w-8 h-8 rounded-full bg-afrocat-white-5 flex items-center justify-center hover:bg-afrocat-teal-soft transition-colors cursor-pointer"
                          data-testid={`button-edit-team-${team.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-afrocat-muted hover:text-afrocat-teal" />
                        </button>
                      )}
                      <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center">
                        <Trophy className="h-4 w-4 text-afrocat-teal" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-afrocat-muted mt-4">
                    <Users className="h-4 w-4" />
                    <span>{playerCount} Players</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditTeam(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); updateMut.mutate(); }} className="space-y-4">
              <div><Label className="text-afrocat-muted text-sm">Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required data-testid="input-edit-team-name" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
              <div><Label className="text-afrocat-muted text-sm">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEN">Men</SelectItem>
                    <SelectItem value="WOMEN">Women</SelectItem>
                    <SelectItem value="VETERANS">Veterans</SelectItem>
                    <SelectItem value="JUNIORS">Juniors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-afrocat-muted text-sm">Season</Label><Input value={editSeason} onChange={e => setEditSeason(e.target.value)} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
              <Button type="submit" disabled={updateMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-save-team">{updateMut.isPending ? "Saving..." : "Save Changes"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
