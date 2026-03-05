import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarCheck, Calendar, Users, Send, Loader2, Lock, ShieldCheck, Pencil, AlertCircle, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["/api/attendance/sessions"], queryFn: () => api.getAttendanceSessions() });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const [open, setOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", sessionDate: "", sessionType: "TRAINING" as string, notes: "" });
  const [scheduleForm, setScheduleForm] = useState({ teamId: "", playerIds: [] as string[], sessionDate: "", sessionType: "TRAINING" as string, notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createAttendanceSession(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions"] }); setOpen(false); toast({ title: "Session created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const scheduleMut = useMutation({
    mutationFn: () => api.scheduleCustomTraining({
      teamId: scheduleForm.teamId || undefined,
      playerIds: scheduleForm.playerIds.length > 0 ? scheduleForm.playerIds : undefined,
      sessionDate: scheduleForm.sessionDate,
      sessionType: scheduleForm.sessionType,
      notes: scheduleForm.notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions"] });
      setScheduleOpen(false);
      setScheduleForm({ teamId: "", playerIds: [], sessionDate: "", sessionType: "TRAINING", notes: "" });
      toast({ title: "Training Scheduled", description: "Players have been notified." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const autoGenMut = useMutation({
    mutationFn: api.autoGenerateTraining,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions"] });
      toast({ title: "Auto-Generated", description: `${data.generated} sessions created for this week.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [markSessionId, setMarkSessionId] = useState<string | null>(null);
  const [superAdminEditing, setSuperAdminEditing] = useState(false);
  const markSession = sessions.find((s: any) => s.id === markSessionId);
  const isClosed = markSession?.status === "CLOSED";
  const canEdit = !isClosed || (user?.isSuperAdmin && superAdminEditing);

  const { data: sessionPlayers = [] } = useQuery({
    queryKey: ["/api/players/team", markSession?.teamId],
    queryFn: () => api.getPlayersByTeam(markSession!.teamId),
    enabled: !!markSession?.teamId,
  });

  const { data: existingRecords = [] } = useQuery({
    queryKey: ["/api/attendance/sessions/records", markSessionId],
    queryFn: () => api.getAttendanceRecords(markSessionId!),
    enabled: !!markSessionId,
  });

  const [attendance, setAttendance] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingRecords.length > 0) {
      const loaded: Record<string, string> = {};
      existingRecords.forEach((r: any) => { loaded[r.playerId] = r.status; });
      setAttendance(loaded);
    } else if (sessionPlayers.length > 0) {
      const defaultAtt: Record<string, string> = {};
      sessionPlayers.forEach((p: any) => { defaultAtt[p.id] = "PRESENT"; });
      setAttendance(defaultAtt);
    }
  }, [existingRecords, sessionPlayers]);

  const saveAndCloseMut = useMutation({
    mutationFn: () => {
      const lines = sessionPlayers.map((p: any) => ({
        playerId: p.id,
        status: attendance[p.id] || "PRESENT",
      }));
      if (superAdminEditing && isClosed) {
        return api.patchAttendanceSession(markSessionId!, { lines });
      }
      return api.saveAndCloseAttendance(markSessionId!, lines);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions/records", markSessionId] });
      toast({ title: superAdminEditing ? "Attendance updated" : "Attendance saved & closed" });
      setMarkSessionId(null);
      setAttendance({});
      setSuperAdminEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePlayer = (playerId: string) => {
    setScheduleForm(prev => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter(id => id !== playerId)
        : [...prev.playerIds, playerId],
    }));
  };

  const filteredPlayers = scheduleForm.teamId
    ? allPlayers.filter((p: any) => p.teamId === scheduleForm.teamId)
    : allPlayers;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-attendance-title">Attendance</h1>
            <p className="text-afrocat-muted mt-1">Track training and match attendance</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => autoGenMut.mutate()}
              disabled={autoGenMut.isPending}
              className="border-afrocat-border text-afrocat-teal"
              data-testid="button-auto-generate"
            >
              {autoGenMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              Auto-Generate Week
            </Button>

            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-afrocat-border text-afrocat-gold" data-testid="button-schedule-training">
                  <Send className="mr-2 h-4 w-4" /> Schedule Training
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-afrocat-card border-afrocat-border text-afrocat-text">
                <DialogHeader><DialogTitle className="text-afrocat-text font-display">Schedule Custom Training</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); scheduleMut.mutate(); }} className="space-y-4">
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Team (or select individual players below)</Label>
                    <Select value={scheduleForm.teamId} onValueChange={v => setScheduleForm({ ...scheduleForm, teamId: v, playerIds: [] })}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-schedule-team"><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Date</Label>
                    <Input type="date" value={scheduleForm.sessionDate} onChange={e => setScheduleForm({ ...scheduleForm, sessionDate: e.target.value })} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-schedule-date" />
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Type</Label>
                    <Select value={scheduleForm.sessionType} onValueChange={v => setScheduleForm({ ...scheduleForm, sessionType: v })}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRAINING">Training</SelectItem>
                        <SelectItem value="MATCH">Match</SelectItem>
                        <SelectItem value="GYM">Gym</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Notes (optional)</Label>
                    <Input value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} placeholder="e.g. Bring shin guards" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-schedule-notes" />
                  </div>
                  {!scheduleForm.teamId && (
                    <div>
                      <Label className="text-afrocat-muted text-xs uppercase">Select Individual Players</Label>
                      <div className="max-h-48 overflow-y-auto border border-afrocat-border rounded-lg p-2 space-y-1 mt-1">
                        {filteredPlayers.map((p: any) => (
                          <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-afrocat-white-5 cursor-pointer text-sm text-afrocat-text">
                            <input
                              type="checkbox"
                              checked={scheduleForm.playerIds.includes(p.id)}
                              onChange={() => togglePlayer(p.id)}
                              className="rounded"
                            />
                            #{p.jerseyNo} {p.firstName} {p.lastName}
                          </label>
                        ))}
                      </div>
                      {scheduleForm.playerIds.length > 0 && (
                        <p className="text-xs text-afrocat-teal mt-1">{scheduleForm.playerIds.length} player(s) selected</p>
                      )}
                    </div>
                  )}
                  <Button type="submit" disabled={scheduleMut.isPending || (!scheduleForm.teamId && scheduleForm.playerIds.length === 0)} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-confirm-schedule">
                    {scheduleMut.isPending ? "Scheduling..." : "Schedule & Notify Players"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-afrocat-teal hover:bg-afrocat-teal/80" data-testid="button-add-session"><Plus className="mr-2 h-4 w-4" /> New Session</Button></DialogTrigger>
              <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text">
                <DialogHeader><DialogTitle className="text-afrocat-text font-display">New Attendance Session</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Team</Label>
                    <Select value={form.teamId} onValueChange={v => setForm({...form, teamId: v})}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Date</Label>
                    <Input type="date" value={form.sessionDate} onChange={e => setForm({...form, sessionDate: e.target.value})} required className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
                  </div>
                  <div>
                    <Label className="text-afrocat-muted text-xs uppercase">Type</Label>
                    <Select value={form.sessionType} onValueChange={v => setForm({...form, sessionType: v})}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRAINING">Training</SelectItem>
                        <SelectItem value="MATCH">Match</SelectItem>
                        <SelectItem value="GYM">Gym</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={createMut.isPending} className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80">{createMut.isPending ? "Creating..." : "Create"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {markSessionId && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-afrocat-text">Mark Attendance — {markSession?.sessionDate} ({markSession?.sessionType})</h3>
                <div className="flex items-center gap-2">
                  {isClosed && (
                    <Badge className="bg-afrocat-red-soft text-afrocat-red border-0 flex items-center gap-1" data-testid="badge-attendance-closed">
                      <Lock className="h-3 w-3" /> Attendance Closed
                    </Badge>
                  )}
                  {!isClosed && (
                    <Badge className="bg-afrocat-green-soft text-afrocat-green border-0" data-testid="badge-attendance-open">Open</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5">
              {isClosed && !superAdminEditing && (
                <div className="mb-4 p-3 rounded-lg bg-afrocat-red-soft border border-afrocat-red/20 flex items-center justify-between" data-testid="text-attendance-locked-notice">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-afrocat-red" />
                    <div>
                      <p className="text-sm font-medium text-afrocat-red">Attendance is closed and locked.</p>
                      <p className="text-xs text-afrocat-muted mt-0.5">
                        {user?.isSuperAdmin ? "As Super Admin, you can edit this attendance." : "Only Super Admin can edit this attendance."}
                      </p>
                    </div>
                  </div>
                  {user?.isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-afrocat-gold text-afrocat-gold hover:bg-afrocat-gold-soft"
                      onClick={() => setSuperAdminEditing(true)}
                      data-testid="button-superadmin-edit"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit Attendance
                    </Button>
                  )}
                </div>
              )}

              {superAdminEditing && isClosed && (
                <div className="mb-4 p-3 rounded-lg bg-afrocat-gold-soft border border-afrocat-gold/20 flex items-center gap-2" data-testid="text-superadmin-editing">
                  <ShieldCheck className="h-4 w-4 text-afrocat-gold" />
                  <p className="text-sm font-medium text-afrocat-gold">Super Admin editing mode — changes will be saved to this locked session.</p>
                </div>
              )}

              {sessionPlayers.length === 0 ? (
                <p className="text-afrocat-muted">No players found for this team.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {sessionPlayers.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-afrocat-border pb-2 last:border-0" data-testid={`row-player-attendance-${p.id}`}>
                        <span className="font-medium text-afrocat-text">#{p.jerseyNo} {p.firstName} {p.lastName}</span>
                        <Select
                          value={attendance[p.id] || "PRESENT"}
                          onValueChange={v => setAttendance({...attendance, [p.id]: v})}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className={`w-[130px] border-afrocat-border ${!canEdit ? 'opacity-50' : ''}`} data-testid={`select-status-${p.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENT">Present</SelectItem>
                            <SelectItem value="LATE">Late</SelectItem>
                            <SelectItem value="ABSENT">Absent</SelectItem>
                            <SelectItem value="EXCUSED">Excused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {canEdit && (
                      <Button
                        onClick={() => saveAndCloseMut.mutate()}
                        disabled={saveAndCloseMut.isPending}
                        className="bg-afrocat-teal hover:bg-afrocat-teal/80"
                        data-testid="button-save-attendance"
                      >
                        {saveAndCloseMut.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                        ) : superAdminEditing ? (
                          <><ShieldCheck className="h-4 w-4 mr-2" /> Update Attendance</>
                        ) : (
                          <><Lock className="h-4 w-4 mr-2" /> Save & Close Attendance</>
                        )}
                      </Button>
                    )}
                    <Button variant="outline" className="border-afrocat-border text-afrocat-text" onClick={() => { setMarkSessionId(null); setSuperAdminEditing(false); }}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="afrocat-card overflow-hidden">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
            <h3 className="font-display font-bold text-afrocat-text flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-afrocat-teal" /> Training Schedule Rules
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-afrocat-teal-soft border border-afrocat-teal/20">
                <h4 className="font-bold text-sm text-afrocat-teal mb-1">Men's Teams</h4>
                <p className="text-xs text-afrocat-muted">Tuesday & Thursday</p>
              </div>
              <div className="p-3 rounded-xl bg-afrocat-gold-soft border border-afrocat-gold/20">
                <h4 className="font-bold text-sm text-afrocat-gold mb-1">Women's Teams</h4>
                <p className="text-xs text-afrocat-muted">Monday & Thursday</p>
              </div>
              <div className="p-3 rounded-xl bg-afrocat-green-soft border border-afrocat-green/20">
                <h4 className="font-bold text-sm text-afrocat-green mb-1">All Teams</h4>
                <p className="text-xs text-afrocat-muted">Friday (Combined)</p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-afrocat-muted">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-afrocat-muted">No attendance sessions yet. Use "Auto-Generate Week" or create one manually.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((s: any) => {
              const team = teams.find((t: any) => t.id === s.teamId);
              const closed = s.status === "CLOSED";
              return (
                <div
                  key={s.id}
                  className={`afrocat-card p-5 cursor-pointer hover:border-afrocat-teal/30 transition-all ${closed ? 'opacity-80' : ''}`}
                  onClick={() => { setMarkSessionId(s.id); setSuperAdminEditing(false); }}
                  data-testid={`card-session-${s.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <CalendarCheck className="h-5 w-5 text-afrocat-teal" />
                      <span className="font-semibold text-afrocat-text">{s.sessionDate}</span>
                    </div>
                    {closed ? (
                      <Badge className="bg-afrocat-red-soft text-afrocat-red border-0 text-[10px] flex items-center gap-1" data-testid={`badge-closed-${s.id}`}>
                        <Lock className="h-2.5 w-2.5" /> Closed
                      </Badge>
                    ) : (
                      <Badge className="bg-afrocat-green-soft text-afrocat-green border-0 text-[10px]" data-testid={`badge-open-${s.id}`}>Open</Badge>
                    )}
                  </div>
                  <p className="text-sm text-afrocat-muted">{team?.name || "Team"} • {s.sessionType}</p>
                  {s.notes && <p className="text-xs text-afrocat-muted mt-1 italic">{s.notes}</p>}
                  {s.lockedAt && (
                    <p className="text-[10px] text-afrocat-muted mt-2 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Locked {new Date(s.lockedAt).toLocaleString()}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`mt-3 w-full border-afrocat-border ${closed ? 'text-afrocat-muted' : 'text-afrocat-teal'}`}
                    data-testid={`button-mark-attendance-${s.id}`}
                  >
                    {closed ? "View Attendance" : "Mark Attendance"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <ExcuseRequestSection user={user} sessions={sessions} />
      </div>
    </Layout>
  );
}

function ExcuseRequestSection({ user, sessions }: { user: any; sessions: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPlayer = user?.role === "PLAYER" || user?.playerId;
  const isManager = user && (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "COACH" || user.isSuperAdmin);

  const [showForm, setShowForm] = useState(false);
  const [excuseForm, setExcuseForm] = useState({ sessionId: "", sessionDate: "", excuseType: "EXCUSE", reason: "" });

  const { data: myRequests = [] } = useQuery({ queryKey: ["/api/attendance/excuse-requests/mine"], queryFn: api.getMyExcuseRequests, enabled: !!isPlayer });
  const { data: allRequests = [] } = useQuery({ queryKey: ["/api/attendance/excuse-requests"], queryFn: api.getExcuseRequests, enabled: !!isManager });

  const submitMut = useMutation({
    mutationFn: (data: any) => api.submitExcuseRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/excuse-requests/mine"] });
      toast({ title: "Request Submitted" });
      setShowForm(false);
      setExcuseForm({ sessionId: "", sessionDate: "", excuseType: "EXCUSE", reason: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveExcuseRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/attendance/excuse-requests"] }); toast({ title: "Approved" }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.rejectExcuseRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/attendance/excuse-requests"] }); toast({ title: "Rejected" }); },
  });

  const pendingRequests = allRequests.filter((r: any) => r.status === "PENDING");

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-afrocat-text flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-afrocat-gold" /> Excuse / Late Requests
        </h2>
        {isPlayer && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold text-white font-bold text-sm cursor-pointer" data-testid="button-request-excuse">
            <Plus className="w-4 h-4" /> Request Excuse / Late
          </button>
        )}
      </div>

      {isManager && pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-afrocat-muted uppercase">Pending Approval ({pendingRequests.length})</h3>
          {pendingRequests.map((r: any) => (
            <div key={r.id} className="afrocat-card p-4 flex items-center gap-3" data-testid={`excuse-pending-${r.id}`}>
              <div className="flex-1">
                <div className="font-bold text-sm text-afrocat-text">{r.playerName}</div>
                <div className="text-[10px] text-afrocat-muted">{r.excuseType} • {r.sessionDate || "Session"} • {r.reason}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400">{r.excuseType}</span>
              <div className="flex gap-1">
                <button onClick={() => approveMut.mutate(r.id)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer" data-testid={`button-approve-excuse-${r.id}`}><Check className="w-4 h-4" /></button>
                <button onClick={() => rejectMut.mutate(r.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isPlayer && myRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-afrocat-muted uppercase">My Requests</h3>
          {myRequests.map((r: any) => (
            <div key={r.id} className="afrocat-card p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm text-afrocat-text">{r.excuseType}: {r.reason}</div>
                <div className="text-[10px] text-afrocat-muted">{r.sessionDate || "Session"} • {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                r.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                r.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-afrocat-text">Request Excuse / Late</h3>
            <Select value={excuseForm.excuseType} onValueChange={(v) => setExcuseForm({ ...excuseForm, excuseType: v })}>
              <SelectTrigger data-testid="select-excuse-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCUSE">Excuse (Full Absence)</SelectItem>
                <SelectItem value="LATE">Late Arrival</SelectItem>
              </SelectContent>
            </Select>
            {sessions.length > 0 && (
              <Select value={excuseForm.sessionId} onValueChange={(v) => setExcuseForm({ ...excuseForm, sessionId: v })}>
                <SelectTrigger><SelectValue placeholder="Select session (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No specific session</SelectItem>
                  {sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.sessionDate} - {s.sessionType}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div>
              <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Or enter date</label>
              <input type="date" value={excuseForm.sessionDate} onChange={(e) => setExcuseForm({ ...excuseForm, sessionDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text focus:outline-none focus:ring-1 focus:ring-afrocat-teal" />
            </div>
            <div>
              <label className="text-xs font-semibold text-afrocat-muted uppercase mb-1 block">Reason</label>
              <textarea value={excuseForm.reason} onChange={(e) => setExcuseForm({ ...excuseForm, reason: e.target.value })} rows={3} placeholder="Explain your reason..."
                className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none" data-testid="input-excuse-reason" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
              <button
                onClick={() => {
                  if (!excuseForm.reason.trim()) return toast({ title: "Reason required", variant: "destructive" });
                  submitMut.mutate({
                    sessionId: excuseForm.sessionId && excuseForm.sessionId !== "NONE" ? excuseForm.sessionId : undefined,
                    sessionDate: excuseForm.sessionDate || undefined,
                    excuseType: excuseForm.excuseType,
                    reason: excuseForm.reason,
                  });
                }}
                disabled={submitMut.isPending}
                className="px-4 py-2 rounded-xl bg-afrocat-gold text-white font-bold text-sm cursor-pointer disabled:opacity-50"
                data-testid="button-submit-excuse"
              >
                {submitMut.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
