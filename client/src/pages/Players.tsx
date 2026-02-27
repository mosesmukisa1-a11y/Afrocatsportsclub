import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileText, Eye, Printer, User, Phone, Heart, Shield } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const POSITIONS = ["Setter", "Outside Hitter", "Opposite", "Middle Blocker", "Libero"];
const STATUSES = ["ACTIVE", "SUSPENDED", "INJURED", "SUSPENDED_CONTRACT"] as const;

const emptyForm = {
  firstName: "", lastName: "", gender: "", jerseyNo: 0, position: "", teamId: "",
  phone: "", email: "", dob: "", homeAddress: "", town: "", region: "",
  nationality: "", idNumber: "",
  nextOfKinName: "", nextOfKinRelation: "", nextOfKinPhone: "", nextOfKinAddress: "",
  emergencyContactName: "", emergencyContactPhone: "",
  medicalNotes: "", allergies: "", bloodGroup: "", photoUrl: "",
};

export default function Players() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: players = [], isLoading } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const createMut = useMutation({
    mutationFn: () => api.createPlayer({ ...form, jerseyNo: Number(form.jerseyNo) || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/players"] }); setOpen(false); setForm({ ...emptyForm }); toast({ title: "Player added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () => api.updatePlayer(selectedPlayer.id, { ...form, jerseyNo: Number(form.jerseyNo) || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/players"] }); setViewOpen(false); toast({ title: "Player updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pdfMut = useMutation({
    mutationFn: (playerId: string) => api.generatePlayerProfilePdf(playerId),
    onSuccess: (data) => {
      const win = window.open("", "_blank");
      if (win) { win.document.write(data.html); win.document.close(); }
      toast({ title: "Profile PDF generated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openView = (player: any) => {
    setSelectedPlayer(player);
    setForm({
      firstName: player.firstName || "", lastName: player.lastName || "",
      gender: player.gender || "", jerseyNo: player.jerseyNo || 0,
      position: player.position || "", teamId: player.teamId || "",
      phone: player.phone || "", email: player.email || "",
      dob: player.dob || "", homeAddress: player.homeAddress || "",
      town: player.town || "", region: player.region || "",
      nationality: player.nationality || "", idNumber: player.idNumber || "",
      nextOfKinName: player.nextOfKinName || "", nextOfKinRelation: player.nextOfKinRelation || "",
      nextOfKinPhone: player.nextOfKinPhone || "", nextOfKinAddress: player.nextOfKinAddress || "",
      emergencyContactName: player.emergencyContactName || "", emergencyContactPhone: player.emergencyContactPhone || "",
      medicalNotes: player.medicalNotes || "", allergies: player.allergies || "",
      bloodGroup: player.bloodGroup || "", photoUrl: player.photoUrl || "",
    });
    setEditMode(false);
    setViewOpen(true);
  };

  const filteredPlayers = players.filter((p: any) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.position || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreate = user && ["ADMIN", "MANAGER"].includes(user.role);
  const canEdit = user && ["ADMIN", "MANAGER"].includes(user.role);
  const set = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

  const PlayerFormFields = ({ isCreate }: { isCreate?: boolean }) => (
    <Tabs defaultValue="identity" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="identity" data-testid="tab-identity">Identity</TabsTrigger>
        <TabsTrigger value="contact" data-testid="tab-contact">Contact</TabsTrigger>
        <TabsTrigger value="kin" data-testid="tab-kin">Next of Kin</TabsTrigger>
        <TabsTrigger value="medical" data-testid="tab-medical">Medical</TabsTrigger>
      </TabsList>
      <TabsContent value="identity" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First Name *</Label><Input value={form.firstName} onChange={e => set("firstName", e.target.value)} required data-testid="input-firstName" /></div>
          <div><Label>Last Name *</Label><Input value={form.lastName} onChange={e => set("lastName", e.target.value)} required data-testid="input-lastName" /></div>
        </div>
        <div><Label>Team</Label>
          <Select value={form.teamId} onValueChange={v => set("teamId", v)}>
            <SelectTrigger data-testid="select-team"><SelectValue placeholder="Select team" /></SelectTrigger>
            <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Jersey #</Label><Input type="number" value={form.jerseyNo} onChange={e => set("jerseyNo", Number(e.target.value))} data-testid="input-jerseyNo" /></div>
          <div><Label>Position</Label>
            <Select value={form.position} onValueChange={v => set("position", v)}>
              <SelectTrigger data-testid="select-position"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Gender</Label>
            <Select value={form.gender} onValueChange={v => set("gender", v)}>
              <SelectTrigger data-testid="select-gender"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} data-testid="input-dob" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nationality</Label><Input value={form.nationality} onChange={e => set("nationality", e.target.value)} data-testid="input-nationality" /></div>
          <div><Label>ID/Passport</Label><Input value={form.idNumber} onChange={e => set("idNumber", e.target.value)} data-testid="input-idNumber" /></div>
        </div>
        <div><Label>Photo URL</Label><Input value={form.photoUrl} onChange={e => set("photoUrl", e.target.value)} placeholder="https://..." data-testid="input-photoUrl" /></div>
      </TabsContent>
      <TabsContent value="contact" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} data-testid="input-phone" /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} data-testid="input-playerEmail" /></div>
        </div>
        <div><Label>Home Address</Label><Input value={form.homeAddress} onChange={e => set("homeAddress", e.target.value)} data-testid="input-homeAddress" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Town</Label><Input value={form.town} onChange={e => set("town", e.target.value)} data-testid="input-town" /></div>
          <div><Label>Region</Label><Input value={form.region} onChange={e => set("region", e.target.value)} data-testid="input-region" /></div>
        </div>
      </TabsContent>
      <TabsContent value="kin" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.nextOfKinName} onChange={e => set("nextOfKinName", e.target.value)} data-testid="input-nextOfKinName" /></div>
          <div><Label>Relationship</Label><Input value={form.nextOfKinRelation} onChange={e => set("nextOfKinRelation", e.target.value)} data-testid="input-nextOfKinRelation" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.nextOfKinPhone} onChange={e => set("nextOfKinPhone", e.target.value)} data-testid="input-nextOfKinPhone" /></div>
          <div><Label>Address</Label><Input value={form.nextOfKinAddress} onChange={e => set("nextOfKinAddress", e.target.value)} data-testid="input-nextOfKinAddress" /></div>
        </div>
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-1"><Shield className="h-3 w-3" /> Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-4">
            <div><Label>Name</Label><Input value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} data-testid="input-emergencyContactName" /></div>
            <div><Label>Phone</Label><Input value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} data-testid="input-emergencyContactPhone" /></div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="medical" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Blood Group</Label>
            <Select value={form.bloodGroup} onValueChange={v => set("bloodGroup", v)}>
              <SelectTrigger data-testid="select-bloodGroup"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Allergies</Label><Input value={form.allergies} onChange={e => set("allergies", e.target.value)} data-testid="input-allergies" /></div>
        </div>
        <div><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={e => set("medicalNotes", e.target.value)} rows={3} data-testid="input-medicalNotes" /></div>
      </TabsContent>
    </Tabs>
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Players</h1>
            <p className="text-muted-foreground mt-1">Club roster and athlete profiles</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm({ ...emptyForm }); }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-player"><Plus className="mr-2 h-4 w-4" /> Add Player</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Player</DialogTitle>
                  <DialogDescription>Register a new player with full bio data</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                  <PlayerFormFields isCreate />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createMut.isPending} data-testid="button-submit-player">
                      {createMut.isPending ? "Adding..." : "Add Player"}
                    </Button>
                  </div>
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
                    <th className="px-6 py-4 font-semibold">Actions</th>
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
                            {player.photoUrl ? (
                              <img src={player.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {(player.firstName || "")[0]}{(player.lastName || "")[0]}
                              </div>
                            )}
                            <div className="font-semibold">{player.firstName} {player.lastName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-muted-foreground">{player.jerseyNo ? `#${player.jerseyNo}` : "—"}</td>
                        <td className="px-6 py-4">{player.position || "—"}</td>
                        <td className="px-6 py-4">{team?.name || "Unassigned"}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${statusColor}`}>{player.status}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openView(player)} data-testid={`button-view-${player.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => pdfMut.mutate(player.id)} data-testid={`button-pdf-${player.id}`}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPlayers.length === 0 && <div className="text-center py-10 text-muted-foreground">No players found.</div>}
            </div>
          </div>
        )}

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedPlayer?.photoUrl ? (
                  <img src={selectedPlayer.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {(selectedPlayer?.firstName || "")[0]}{(selectedPlayer?.lastName || "")[0]}
                  </div>
                )}
                <span>{selectedPlayer?.firstName} {selectedPlayer?.lastName}</span>
                {selectedPlayer?.jerseyNo && <Badge>#{selectedPlayer.jerseyNo}</Badge>}
              </DialogTitle>
              <DialogDescription>Player profile details</DialogDescription>
            </DialogHeader>

            {editMode && canEdit ? (
              <form onSubmit={e => { e.preventDefault(); updateMut.mutate(); }} className="space-y-4">
                <PlayerFormFields />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditMode(false)} data-testid="button-cancel-edit">Cancel</Button>
                  <Button type="submit" disabled={updateMut.isPending} data-testid="button-save-edit">
                    {updateMut.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs uppercase">Position</span><p className="font-medium">{selectedPlayer?.position || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Gender</span><p className="font-medium">{selectedPlayer?.gender || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">DOB</span><p className="font-medium">{selectedPlayer?.dob || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Nationality</span><p className="font-medium">{selectedPlayer?.nationality || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Phone</span><p className="font-medium">{selectedPlayer?.phone || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Email</span><p className="font-medium">{selectedPlayer?.email || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Address</span><p className="font-medium">{selectedPlayer?.homeAddress || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Town/Region</span><p className="font-medium">{[selectedPlayer?.town, selectedPlayer?.region].filter(Boolean).join(", ") || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">ID/Passport</span><p className="font-medium">{selectedPlayer?.idNumber || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs uppercase">Blood Group</span><p className="font-medium">{selectedPlayer?.bloodGroup || "—"}</p></div>
                </div>
                {(selectedPlayer?.nextOfKinName || selectedPlayer?.emergencyContactName) && (
                  <div className="border-t pt-3">
                    <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2">Next of Kin / Emergency</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground text-xs">Next of Kin</span><p className="font-medium">{selectedPlayer?.nextOfKinName || "—"} ({selectedPlayer?.nextOfKinRelation || "—"})</p></div>
                      <div><span className="text-muted-foreground text-xs">NoK Phone</span><p className="font-medium">{selectedPlayer?.nextOfKinPhone || "—"}</p></div>
                      <div><span className="text-muted-foreground text-xs">Emergency</span><p className="font-medium">{selectedPlayer?.emergencyContactName || "—"}</p></div>
                      <div><span className="text-muted-foreground text-xs">Emergency Phone</span><p className="font-medium">{selectedPlayer?.emergencyContactPhone || "—"}</p></div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {canEdit && <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-player">Edit</Button>}
                  <Button variant="outline" onClick={() => pdfMut.mutate(selectedPlayer?.id)} data-testid="button-print-profile">
                    <Printer className="mr-2 h-4 w-4" /> Print Profile
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
