import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  UserCheck, UserX, Mail, Shield, CheckCircle, XCircle,
  Clock, Settings, Users, ShieldCheck, FileEdit, ArrowRight
} from "lucide-react";

const POSITIONS = ["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"];

function ApprovalBadge({ status }: { status: string }) {
  if (status === "APPROVED") return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export default function AdminRegistrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [overrideTeam, setOverrideTeam] = useState<Record<string, string>>({});
  const [overridePosition, setOverridePosition] = useState<Record<string, string>>({});
  const [overrideJersey, setOverrideJersey] = useState<Record<string, string>>({});

  const { data: pending = [] } = useQuery({
    queryKey: ["/api/admin/registrations/pending"],
    queryFn: api.getPendingRegistrations,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: api.getTeams,
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/admin/security-settings"],
    queryFn: api.getSecuritySettings,
  });

  const { data: updateRequests = [] } = useQuery({
    queryKey: ["/api/player-update-requests/pending"],
    queryFn: api.getPendingUpdateRequests,
  });

  const [updateReviewNote, setUpdateReviewNote] = useState<Record<string, string>>({});

  const approveMut = useMutation({
    mutationFn: (userId: string) => api.approveRegistration(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Registration approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => api.rejectRegistration(userId, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Registration rejected" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const verifyEmailMut = useMutation({
    mutationFn: (userId: string) => api.adminVerifyEmail(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Email verified by admin" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveTeamMut = useMutation({
    mutationFn: ({ playerId, teamId }: { playerId: string; teamId: string }) => api.approveTeam(playerId, teamId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Team approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approvePositionMut = useMutation({
    mutationFn: ({ playerId, position }: { playerId: string; position: string }) => api.approvePosition(playerId, position),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Position approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveJerseyMut = useMutation({
    mutationFn: ({ playerId, jerseyNo }: { playerId: string; jerseyNo: number }) => api.approveJersey(playerId, jerseyNo),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations/pending"] }); toast({ title: "Jersey approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: (data: any) => api.updateSecuritySettings(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/security-settings"] }); toast({ title: "Settings updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveUpdateMut = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) => api.approveUpdateRequest(id, reviewNote),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/player-update-requests/pending"] }); toast({ title: "Update request approved and applied" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectUpdateMut = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) => api.rejectUpdateRequest(id, reviewNote),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/player-update-requests/pending"] }); toast({ title: "Update request rejected" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const teamNameMap = new Map(teams.map((t: any) => [t.id, t.name]));

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Registration Management</h1>
          <p className="text-muted-foreground mt-1">Approve or reject player registrations and manage security settings</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              <Users className="h-4 w-4 mr-2" />Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="update-requests" data-testid="tab-update-requests">
              <FileEdit className="h-4 w-4 mr-2" />Profile Updates ({updateRequests.length})
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />Security Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pending.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No pending registrations</p>
                </CardContent>
              </Card>
            )}

            {pending.map((reg: any) => (
              <Card key={reg.userId} data-testid={`card-registration-${reg.userId}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{reg.fullName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {reg.emailVerified ? (
                        <Badge className="bg-green-100 text-green-700"><Mail className="h-3 w-3 mr-1" />Email Verified</Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-amber-600"><Mail className="h-3 w-3 mr-1" />Unverified</Badge>
                          <Button size="sm" variant="ghost" onClick={() => verifyEmailMut.mutate(reg.userId)} data-testid={`button-verify-email-${reg.userId}`}>
                            Verify
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Team</span>
                        <ApprovalBadge status={reg.teamApprovalStatus} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requested: {reg.requestedTeamId ? (teamNameMap.get(reg.requestedTeamId) || "Unknown") : "None"}
                      </p>
                      {reg.teamApprovalStatus === "PENDING" && reg.playerId && (
                        <div className="space-y-2 pt-1">
                          <Select value={overrideTeam[reg.playerId] || reg.requestedTeamId || ""} onValueChange={v => setOverrideTeam(p => ({ ...p, [reg.playerId]: v }))}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-override-team-${reg.userId}`}>
                              <SelectValue placeholder="Assign team" />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs flex-1" onClick={() => approveTeamMut.mutate({ playerId: reg.playerId, teamId: overrideTeam[reg.playerId] || reg.requestedTeamId })} disabled={!overrideTeam[reg.playerId] && !reg.requestedTeamId} data-testid={`button-approve-team-${reg.userId}`}>
                              <CheckCircle className="h-3 w-3 mr-1" />Approve
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Position</span>
                        <ApprovalBadge status={reg.positionApprovalStatus} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requested: {reg.requestedPosition ? reg.requestedPosition.charAt(0) + reg.requestedPosition.slice(1).toLowerCase() : "None"}
                      </p>
                      {reg.positionApprovalStatus === "PENDING" && reg.playerId && (
                        <div className="space-y-2 pt-1">
                          <Select value={overridePosition[reg.playerId] || reg.requestedPosition || ""} onValueChange={v => setOverridePosition(p => ({ ...p, [reg.playerId]: v }))}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-override-position-${reg.userId}`}>
                              <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent>
                              {POSITIONS.map(p => <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 text-xs w-full" onClick={() => approvePositionMut.mutate({ playerId: reg.playerId, position: overridePosition[reg.playerId] || reg.requestedPosition })} disabled={!overridePosition[reg.playerId] && !reg.requestedPosition} data-testid={`button-approve-position-${reg.userId}`}>
                            <CheckCircle className="h-3 w-3 mr-1" />Approve
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Jersey #</span>
                        <ApprovalBadge status={reg.jerseyApprovalStatus} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requested: {reg.requestedJerseyNo || "None"}
                      </p>
                      {reg.jerseyApprovalStatus === "PENDING" && reg.playerId && (
                        <div className="space-y-2 pt-1">
                          <Input type="number" min={1} max={99} className="h-8 text-xs" placeholder="Jersey #" value={overrideJersey[reg.playerId] || reg.requestedJerseyNo || ""} onChange={e => setOverrideJersey(p => ({ ...p, [reg.playerId]: e.target.value }))} data-testid={`input-override-jersey-${reg.userId}`} />
                          <Button size="sm" className="h-7 text-xs w-full" onClick={() => approveJerseyMut.mutate({ playerId: reg.playerId, jerseyNo: parseInt(overrideJersey[reg.playerId] || reg.requestedJerseyNo) })} disabled={!overrideJersey[reg.playerId] && !reg.requestedJerseyNo} data-testid={`button-approve-jersey-${reg.userId}`}>
                            <CheckCircle className="h-3 w-3 mr-1" />Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button onClick={() => approveMut.mutate(reg.userId)} className="flex-1" data-testid={`button-approve-registration-${reg.userId}`}>
                      <UserCheck className="h-4 w-4 mr-2" />Approve Registration
                    </Button>
                    <div className="flex items-center gap-1 flex-1">
                      <Input placeholder="Reason (optional)" className="h-9 text-sm" value={rejectReason[reg.userId] || ""} onChange={e => setRejectReason(p => ({ ...p, [reg.userId]: e.target.value }))} data-testid={`input-reject-reason-${reg.userId}`} />
                      <Button variant="destructive" onClick={() => rejectMut.mutate({ userId: reg.userId, reason: rejectReason[reg.userId] })} data-testid={`button-reject-registration-${reg.userId}`}>
                        <UserX className="h-4 w-4 mr-1" />Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="update-requests" className="space-y-4 mt-4">
            {updateRequests.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileEdit className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No pending profile update requests</p>
                </CardContent>
              </Card>
            )}

            {updateRequests.map((req: any) => {
              const patchJson = typeof req.patchJson === "string" ? JSON.parse(req.patchJson) : (req.patchJson || {});
              const fieldLabels: Record<string, string> = {
                firstName: "First Name", lastName: "Last Name", gender: "Gender",
                dob: "Date of Birth", phone: "Phone", email: "Email",
                homeAddress: "Home Address", town: "Town", region: "Region",
                nationality: "Nationality", idNumber: "ID Number",
                nextOfKinName: "Next of Kin Name", nextOfKinRelation: "Next of Kin Relation",
                nextOfKinPhone: "Next of Kin Phone", nextOfKinAddress: "Next of Kin Address",
                emergencyContactName: "Emergency Contact", emergencyContactPhone: "Emergency Phone",
                medicalNotes: "Medical Notes", allergies: "Allergies", bloodGroup: "Blood Group",
                position: "Position", requestedPosition: "Requested Position",
                requestedTeamId: "Requested Team", requestedJerseyNo: "Requested Jersey",
                heightCm: "Height (cm)", weightKg: "Weight (kg)",
                maritalStatus: "Marital Status", facebookName: "Facebook Name",
                photoUrl: "Photo URL",
              };

              return (
                <Card key={req.id} data-testid={`card-update-request-${req.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-update-player-name-${req.id}`}>
                          {req.playerName || `Player #${req.playerId}`}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground" data-testid={`text-update-submitted-date-${req.id}`}>
                          Submitted: {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : "Unknown"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        <Clock className="h-3 w-3 mr-1" />Pending Review
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 text-sm font-medium grid grid-cols-3">
                        <span>Field</span>
                        <span>Current Value</span>
                        <span>Requested Value</span>
                      </div>
                      {Object.entries(patchJson).map(([field, newValue]: [string, any]) => {
                        const label = fieldLabels[field] || field;
                        const currentValue = req.currentValues?.[field];
                        let displayCurrent = currentValue ?? "—";
                        let displayNew = newValue ?? "—";
                        if (field === "requestedTeamId") {
                          displayCurrent = teamNameMap.get(String(currentValue)) || String(displayCurrent);
                          displayNew = teamNameMap.get(String(newValue)) || String(displayNew);
                        }
                        return (
                          <div key={field} className="px-4 py-2 text-sm grid grid-cols-3 border-t items-center" data-testid={`diff-field-${field}-${req.id}`}>
                            <span className="font-medium text-muted-foreground">{label}</span>
                            <span className="text-red-600 line-through">{String(displayCurrent)}</span>
                            <div className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-green-600 shrink-0" />
                              <span className="text-green-700 font-medium">{String(displayNew)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Review Note (optional)</Label>
                      <Textarea
                        placeholder="Add a note for the player..."
                        className="text-sm"
                        value={updateReviewNote[req.id] || ""}
                        onChange={e => setUpdateReviewNote(p => ({ ...p, [req.id]: e.target.value }))}
                        data-testid={`input-update-review-note-${req.id}`}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        className="flex-1"
                        onClick={() => approveUpdateMut.mutate({ id: req.id, reviewNote: updateReviewNote[req.id] || undefined })}
                        disabled={approveUpdateMut.isPending}
                        data-testid={`button-approve-update-${req.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />Approve & Apply Changes
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => rejectUpdateMut.mutate({ id: req.id, reviewNote: updateReviewNote[req.id] || undefined })}
                        disabled={rejectUpdateMut.isPending}
                        data-testid={`button-reject-update-${req.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-2" />Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Require Email Verification</Label>
                      <p className="text-xs text-muted-foreground">Players must verify their email before login</p>
                    </div>
                    <Switch checked={settings?.requireEmailVerification ?? true} onCheckedChange={v => settingsMut.mutate({ requireEmailVerification: v })} data-testid="switch-require-email" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Require Admin Approval</Label>
                      <p className="text-xs text-muted-foreground">Players cannot login until approved by management</p>
                    </div>
                    <Switch checked={settings?.requireAdminApproval ?? true} onCheckedChange={v => settingsMut.mutate({ requireAdminApproval: v })} data-testid="switch-require-approval" />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Auto-Approve on Registration Approval</p>
                    <div className="space-y-3 pl-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Auto-approve team requests</Label>
                        <Switch checked={settings?.autoApproveTeamRequests ?? false} onCheckedChange={v => settingsMut.mutate({ autoApproveTeamRequests: v })} data-testid="switch-auto-team" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Auto-approve position</Label>
                        <Switch checked={settings?.autoApprovePosition ?? false} onCheckedChange={v => settingsMut.mutate({ autoApprovePosition: v })} data-testid="switch-auto-position" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Auto-approve jersey number</Label>
                        <Switch checked={settings?.autoApproveJersey ?? false} onCheckedChange={v => settingsMut.mutate({ autoApproveJersey: v })} data-testid="switch-auto-jersey" />
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <Label className="font-medium">Allowed Email Domains</Label>
                    <p className="text-xs text-muted-foreground mb-2">Comma-separated domains (leave empty for any)</p>
                    <Input placeholder="e.g. gmail.com,yahoo.com" defaultValue={settings?.allowedEmailDomains || ""} onBlur={e => settingsMut.mutate({ allowedEmailDomains: e.target.value || null })} data-testid="input-allowed-domains" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
