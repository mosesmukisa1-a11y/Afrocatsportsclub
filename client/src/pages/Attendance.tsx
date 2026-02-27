import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CalendarCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Attendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["/api/attendance/sessions"], queryFn: () => api.getAttendanceSessions() });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", sessionDate: "", sessionType: "TRAINING" as string, notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createAttendanceSession(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/attendance/sessions"] }); setOpen(false); toast({ title: "Session created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [markSessionId, setMarkSessionId] = useState<string | null>(null);
  const markSession = sessions.find((s: any) => s.id === markSessionId);
  const { data: sessionPlayers = [] } = useQuery({
    queryKey: ["/api/players/team", markSession?.teamId],
    queryFn: () => api.getPlayersByTeam(markSession!.teamId),
    enabled: !!markSession?.teamId,
  });

  const [attendance, setAttendance] = useState<Record<string, string>>({});

  const submitAttendance = useMutation({
    mutationFn: () => {
      const records = sessionPlayers.map((p: any) => ({
        playerId: p.id,
        status: attendance[p.id] || "PRESENT",
      }));
      return api.submitAttendanceRecords(markSessionId!, records);
    },
    onSuccess: () => { toast({ title: "Attendance recorded" }); setMarkSessionId(null); setAttendance({}); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Attendance</h1>
            <p className="text-muted-foreground mt-1">Track training and match attendance</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-session"><Plus className="mr-2 h-4 w-4" /> New Session</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Attendance Session</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                <div><Label>Team</Label>
                  <Select value={form.teamId} onValueChange={v => setForm({...form, teamId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                    <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.sessionDate} onChange={e => setForm({...form, sessionDate: e.target.value})} required /></div>
                <div><Label>Type</Label>
                  <Select value={form.sessionType} onValueChange={v => setForm({...form, sessionType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRAINING">Training</SelectItem>
                      <SelectItem value="MATCH">Match</SelectItem>
                      <SelectItem value="GYM">Gym</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mark Attendance Modal */}
        {markSessionId && (
          <Card className="border-2 border-primary">
            <CardHeader><CardTitle>Mark Attendance — {markSession?.sessionDate} ({markSession?.sessionType})</CardTitle></CardHeader>
            <CardContent>
              {sessionPlayers.length === 0 ? (
                <p className="text-muted-foreground">No players found for this team.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {sessionPlayers.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <span className="font-medium">#{p.jerseyNo} {p.firstName} {p.lastName}</span>
                        <Select value={attendance[p.id] || "PRESENT"} onValueChange={v => setAttendance({...attendance, [p.id]: v})}>
                          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
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
                    <Button onClick={() => submitAttendance.mutate()} disabled={submitAttendance.isPending}>
                      {submitAttendance.isPending ? "Saving..." : "Save Attendance"}
                    </Button>
                    <Button variant="outline" onClick={() => setMarkSessionId(null)}>Cancel</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No attendance sessions yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((s: any) => {
              const team = teams.find((t: any) => t.id === s.teamId);
              return (
                <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMarkSessionId(s.id)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{s.sessionDate}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{team?.name || "Team"} • {s.sessionType}</p>
                    <Button variant="outline" size="sm" className="mt-3 w-full" data-testid={`button-mark-attendance-${s.id}`}>Mark Attendance</Button>
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
