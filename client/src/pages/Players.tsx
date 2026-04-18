import { Layout } from "@/components/Layout";
import { openHtmlAsPdf } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Eye, Printer, Shield, Trash2, Mail, Phone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/CameraCapture";
import { useState, useMemo } from "react";

const POSITIONS = ["Setter", "Outside Hitter", "Opposite", "Middle Blocker", "Libero"];

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
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [filterGender, setFilterGender] = useState("ALL");
  const { data: players = [], isLoading } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const userRoles = user?.roles && user.roles.length > 0 ? user.roles : user ? [user.role] : [];

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deletePlayer(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/players"] }); setDeleteConfirmId(null); setViewOpen(false); toast({ title: "Player removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pdfMut = useMutation({
    mutationFn: (playerId: string) => api.generatePlayerProfilePdf(playerId),
    onSuccess: (data) => {
      openHtmlAsPdf(data.html);
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

  const filteredPlayers = useMemo(() => {
    return (players || []).filter((p: any) => {
      const matchesSearch =
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.position || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = filterTeam === "ALL" || p.teamId === filterTeam;
      const matchesGender = filterGender === "ALL" || (p.gender || "").toLowerCase() === filterGender.toLowerCase();
      return matchesSearch && matchesTeam && matchesGender;
    }).sort((a: any, b: any) => {
      const nameA = `${a.lastName || ""} ${a.firstName || ""}`.toLowerCase();
      const nameB = `${b.lastName || ""} ${b.firstName || ""}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [players, searchTerm, filterTeam, filterGender]);

  const canCreate = user && ["ADMIN", "MANAGER"].includes(user.role);
  const canEdit = user && ["ADMIN", "MANAGER"].includes(user.role);
  const canDelete = user && ["ADMIN"].includes(user.role);
  const canContact = user && (["ADMIN", "MANAGER", "COACH"].includes(user.role) || userRoles.includes("CAPTAIN"));
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
          <div><Label className="text-afrocat-muted text-sm">First Name *</Label><Input value={form.firstName} onChange={e => set("firstName", e.target.value)} required data-testid="input-firstName" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Last Name *</Label><Input value={form.lastName} onChange={e => set("lastName", e.target.value)} required data-testid="input-lastName" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div><Label className="text-afrocat-muted text-sm">Team</Label>
          <Select value={form.teamId} onValueChange={v => set("teamId", v)}>
            <SelectTrigger data-testid="select-team" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Select team" /></SelectTrigger>
            <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Jersey #</Label><Input type="number" value={form.jerseyNo} onChange={e => set("jerseyNo", Number(e.target.value))} data-testid="input-jerseyNo" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Position</Label>
            <Select value={form.position} onValueChange={v => set("position", v)}>
              <SelectTrigger data-testid="select-position" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Gender</Label>
            <Select value={form.gender} onValueChange={v => set("gender", v)}>
              <SelectTrigger data-testid="select-gender" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-afrocat-muted text-sm">Date of Birth</Label><Input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} data-testid="input-dob" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Nationality</Label><Input value={form.nationality} onChange={e => set("nationality", e.target.value)} data-testid="input-nationality" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">ID/Passport</Label><Input value={form.idNumber} onChange={e => set("idNumber", e.target.value)} data-testid="input-idNumber" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div>
          <Label className="text-afrocat-muted text-sm mb-2 block">Player Photo</Label>
          <CameraCapture
            onCapture={(dataUrl) => set("photoUrl", dataUrl)}
            onClose={() => {}}
            currentPhoto={form.photoUrl || null}
          />
        </div>
      </TabsContent>
      <TabsContent value="contact" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} data-testid="input-phone" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} data-testid="input-playerEmail" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div><Label className="text-afrocat-muted text-sm">Home Address</Label><Input value={form.homeAddress} onChange={e => set("homeAddress", e.target.value)} data-testid="input-homeAddress" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Town</Label><Input value={form.town} onChange={e => set("town", e.target.value)} data-testid="input-town" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Region</Label><Input value={form.region} onChange={e => set("region", e.target.value)} data-testid="input-region" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
      </TabsContent>
      <TabsContent value="kin" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Name</Label><Input value={form.nextOfKinName} onChange={e => set("nextOfKinName", e.target.value)} data-testid="input-nextOfKinName" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Relationship</Label><Input value={form.nextOfKinRelation} onChange={e => set("nextOfKinRelation", e.target.value)} data-testid="input-nextOfKinRelation" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Phone</Label><Input value={form.nextOfKinPhone} onChange={e => set("nextOfKinPhone", e.target.value)} data-testid="input-nextOfKinPhone" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          <div><Label className="text-afrocat-muted text-sm">Address</Label><Input value={form.nextOfKinAddress} onChange={e => set("nextOfKinAddress", e.target.value)} data-testid="input-nextOfKinAddress" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div className="rounded-xl border border-dashed border-afrocat-border bg-afrocat-white-3 p-4">
          <h4 className="text-sm font-bold text-afrocat-text flex items-center gap-1 mb-3"><Shield className="h-3 w-3 text-afrocat-teal" /> Emergency Contact</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-afrocat-muted text-sm">Name</Label><Input value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} data-testid="input-emergencyContactName" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
            <div><Label className="text-afrocat-muted text-sm">Phone</Label><Input value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} data-testid="input-emergencyContactPhone" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="medical" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-afrocat-muted text-sm">Blood Group</Label>
            <Select value={form.bloodGroup} onValueChange={v => set("bloodGroup", v)}>
              <SelectTrigger data-testid="select-bloodGroup" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-afrocat-muted text-sm">Allergies</Label><Input value={form.allergies} onChange={e => set("allergies", e.target.value)} data-testid="input-allergies" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
        </div>
        <div><Label className="text-afrocat-muted text-sm">Medical Notes</Label><Textarea value={form.medicalNotes} onChange={e => set("medicalNotes", e.target.value)} rows={3} data-testid="input-medicalNotes" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" /></div>
      </TabsContent>
    </Tabs>
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Players</h1>
            <p className="text-afrocat-muted mt-1">Club roster and athlete profiles</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm({ ...emptyForm }); }}>
              <DialogTrigger asChild>
                <Button className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-add-player"><Plus className="mr-2 h-4 w-4" /> Add Player</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Player</DialogTitle>
                  <DialogDescription>Register a new player with full bio data</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                  <PlayerFormFields isCreate />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-submit-player">
                      {createMut.isPending ? "Adding..." : "Add Player"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-afrocat-muted" />
            <Input placeholder="Search players..." className="pl-9 bg-afrocat-white-5 border-afrocat-border text-afrocat-text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-players" />
          </div>
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-full sm:w-[200px] bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-filter-team">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Teams</SelectItem>
              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterGender} onValueChange={setFilterGender}>
            <SelectTrigger className="w-full sm:w-[160px] bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-filter-gender">
              <SelectValue placeholder="Filter by gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-afrocat-muted">
          Showing {(filteredPlayers || []).length} of {(players || []).length} players
          {filterTeam !== "ALL" && <span> • Team: {(teams || []).find((t: any) => t.id === filterTeam)?.name}</span>}
          {filterGender !== "ALL" && <span> • Gender: {filterGender}</span>}
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-afrocat-muted">Loading players...</div>
        ) : (
          <div className="afrocat-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Player</th>
                    <th className="px-6 py-4 font-semibold">Jersey</th>
                    <th className="px-6 py-4 font-semibold">Position</th>
                    <th className="px-6 py-4 font-semibold">Team</th>
                    <th className="px-6 py-4 font-semibold">Gender</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player: any) => {
                    const team = teams.find((t: any) => t.id === player.teamId);
                    let statusColor = "bg-afrocat-green-soft text-afrocat-green";
                    if (player.status === "INJURED") statusColor = "bg-afrocat-red-soft text-afrocat-red";
                    if (player.status === "SUSPENDED") statusColor = "bg-afrocat-gold-soft text-afrocat-gold";
                    return (
                      <tr key={player.id} className="border-b border-afrocat-border last:border-0 hover:bg-afrocat-white-3 transition-colors" data-testid={`row-player-${player.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {player.photoUrl ? (
                              <img src={player.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-afrocat-border" data-testid={`img-player-${player.id}`} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-afrocat-teal font-bold text-xs" data-testid={`avatar-player-${player.id}`}>
                                {(player.firstName || "")[0]}{(player.lastName || "")[0]}
                              </div>
                            )}
                            <div className="font-semibold text-afrocat-text" data-testid={`text-player-name-${player.id}`}>{player.firstName} {player.lastName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-afrocat-muted" data-testid={`text-jersey-${player.id}`}>{player.jerseyNo ? `#${player.jerseyNo}` : "—"}</td>
                        <td className="px-6 py-4 text-afrocat-text" data-testid={`text-position-${player.id}`}>{player.position || "—"}</td>
                        <td className="px-6 py-4 text-afrocat-text" data-testid={`text-team-${player.id}`}>{team?.name || "Unassigned"}</td>
                        <td className="px-6 py-4 text-afrocat-text" data-testid={`text-gender-${player.id}`}>{player.gender || "—"}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${statusColor}`} data-testid={`badge-status-${player.id}`}>{player.status}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button onClick={() => openView(player)} className="p-1.5 rounded hover:bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text cursor-pointer" data-testid={`button-view-${player.id}`} title="View profile">
                              <Eye className="h-4 w-4" />
                            </button>
                            {canContact && player.email && (
                              <a href={`mailto:${player.email}`} className="p-1.5 rounded hover:bg-afrocat-teal-soft text-afrocat-muted hover:text-afrocat-teal cursor-pointer" data-testid={`button-email-${player.id}`} title={`Email ${player.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                            {canContact && player.phone && (
                              <a href={`tel:${player.phone}`} className="p-1.5 rounded hover:bg-afrocat-green-soft text-afrocat-muted hover:text-afrocat-green cursor-pointer" data-testid={`button-phone-${player.id}`} title={`Call ${player.phone}`}>
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            <button onClick={() => pdfMut.mutate(player.id)} className="p-1.5 rounded hover:bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text cursor-pointer" data-testid={`button-pdf-${player.id}`} title="Print profile">
                              <Printer className="h-4 w-4" />
                            </button>
                            {canDelete && (
                              <button onClick={() => setDeleteConfirmId(player.id)} className="p-1.5 rounded hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer" data-testid={`button-delete-${player.id}`} title="Remove player">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPlayers.length === 0 && <div className="text-center py-10 text-afrocat-muted" data-testid="text-no-players">No players found.</div>}
            </div>
          </div>
        )}

        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="afrocat-card p-6 w-full max-w-sm" data-testid="dialog-confirm-delete">
              <h3 className="text-lg font-bold text-afrocat-text mb-2">Remove Player</h3>
              <p className="text-sm text-afrocat-muted mb-4">
                Are you sure you want to permanently remove this player? This will also delete their stats, attendance records, and other related data.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-afrocat-border text-afrocat-muted" data-testid="button-cancel-delete">Cancel</Button>
                <Button onClick={() => deleteMut.mutate(deleteConfirmId)} disabled={deleteMut.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white" data-testid="button-confirm-delete">
                  {deleteMut.isPending ? "Removing..." : "Remove Player"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedPlayer?.photoUrl ? (
                  <img src={selectedPlayer.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-afrocat-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-afrocat-teal font-bold text-sm">
                    {(selectedPlayer?.firstName || "")[0]}{(selectedPlayer?.lastName || "")[0]}
                  </div>
                )}
                <span>{selectedPlayer?.firstName} {selectedPlayer?.lastName}</span>
                {selectedPlayer?.jerseyNo && <span className="px-2 py-0.5 rounded-full bg-afrocat-gold-soft text-afrocat-gold text-sm font-bold">#{selectedPlayer.jerseyNo}</span>}
              </DialogTitle>
              <DialogDescription>Player profile details</DialogDescription>
            </DialogHeader>

            {editMode && canEdit ? (
              <form onSubmit={e => { e.preventDefault(); updateMut.mutate(); }} className="space-y-4">
                <PlayerFormFields />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditMode(false)} className="border-afrocat-border text-afrocat-muted" data-testid="button-cancel-edit">Cancel</Button>
                  <Button type="submit" disabled={updateMut.isPending} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-save-edit">
                    {updateMut.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-afrocat-muted text-xs uppercase">Position</span><p className="font-medium text-afrocat-text">{selectedPlayer?.position || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Gender</span><p className="font-medium text-afrocat-text">{selectedPlayer?.gender || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">DOB</span><p className="font-medium text-afrocat-text">{selectedPlayer?.dob || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Nationality</span><p className="font-medium text-afrocat-text">{selectedPlayer?.nationality || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Phone</span>
                    <p className="font-medium text-afrocat-text">
                      {selectedPlayer?.phone ? (
                        canContact ? (
                          <a href={`tel:${selectedPlayer.phone}`} className="text-afrocat-teal hover:underline" data-testid="link-player-phone">{selectedPlayer.phone}</a>
                        ) : selectedPlayer.phone
                      ) : "—"}
                    </p>
                  </div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Email</span>
                    <p className="font-medium text-afrocat-text">
                      {selectedPlayer?.email ? (
                        canContact ? (
                          <a href={`mailto:${selectedPlayer.email}`} className="text-afrocat-teal hover:underline" data-testid="link-player-email">{selectedPlayer.email}</a>
                        ) : selectedPlayer.email
                      ) : "—"}
                    </p>
                  </div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Address</span><p className="font-medium text-afrocat-text">{selectedPlayer?.homeAddress || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Town/Region</span><p className="font-medium text-afrocat-text">{[selectedPlayer?.town, selectedPlayer?.region].filter(Boolean).join(", ") || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">ID/Passport</span><p className="font-medium text-afrocat-text">{selectedPlayer?.idNumber || "—"}</p></div>
                  <div><span className="text-afrocat-muted text-xs uppercase">Blood Group</span><p className="font-medium text-afrocat-text">{selectedPlayer?.bloodGroup || "—"}</p></div>
                </div>
                {(selectedPlayer?.nextOfKinName || selectedPlayer?.emergencyContactName) && (
                  <div className="border-t border-afrocat-border pt-3">
                    <h4 className="text-xs uppercase text-afrocat-muted font-semibold mb-2">Next of Kin / Emergency</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-afrocat-muted text-xs">Next of Kin</span><p className="font-medium text-afrocat-text">{selectedPlayer?.nextOfKinName || "—"} ({selectedPlayer?.nextOfKinRelation || "—"})</p></div>
                      <div><span className="text-afrocat-muted text-xs">NoK Phone</span><p className="font-medium text-afrocat-text">{selectedPlayer?.nextOfKinPhone || "—"}</p></div>
                      <div><span className="text-afrocat-muted text-xs">Emergency</span><p className="font-medium text-afrocat-text">{selectedPlayer?.emergencyContactName || "—"}</p></div>
                      <div><span className="text-afrocat-muted text-xs">Emergency Phone</span><p className="font-medium text-afrocat-text">{selectedPlayer?.emergencyContactPhone || "—"}</p></div>
                    </div>
                  </div>
                )}

                {canContact && (selectedPlayer?.email || selectedPlayer?.phone) && (
                  <div className="border-t border-afrocat-border pt-3">
                    <h4 className="text-xs uppercase text-afrocat-muted font-semibold mb-2">Quick Contact</h4>
                    <div className="flex gap-2">
                      {selectedPlayer?.email && (
                        <a href={`mailto:${selectedPlayer.email}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-afrocat-teal-soft text-afrocat-teal text-sm font-medium hover:bg-afrocat-teal/20 transition-colors"
                          data-testid="button-quick-email">
                          <Mail className="h-4 w-4" /> Email Player
                        </a>
                      )}
                      {selectedPlayer?.phone && (
                        <a href={`tel:${selectedPlayer.phone}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-afrocat-green-soft text-afrocat-green text-sm font-medium hover:bg-afrocat-green/20 transition-colors"
                          data-testid="button-quick-phone">
                          <Phone className="h-4 w-4" /> Call Player
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {canEdit && <Button variant="outline" onClick={() => setEditMode(true)} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5" data-testid="button-edit-player">Edit</Button>}
                  <Button variant="outline" onClick={() => pdfMut.mutate(selectedPlayer?.id)} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5" data-testid="button-print-profile">
                    <Printer className="mr-2 h-4 w-4" /> Print Profile
                  </Button>
                  {canDelete && (
                    <Button variant="outline" onClick={() => { setViewOpen(false); setDeleteConfirmId(selectedPlayer?.id); }}
                      className="border-afrocat-red/30 text-afrocat-red hover:bg-afrocat-red-soft" data-testid="button-delete-player">
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
