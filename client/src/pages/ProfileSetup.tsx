import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { User, Phone, Heart, Shield, Camera, CheckCircle, Info, AlertTriangle, Ruler, Weight } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function isWeightOverdue(lastWeightUpdatedAt: string | null | undefined): boolean {
  if (!lastWeightUpdatedAt) return true;
  const lastUpdate = new Date(lastWeightUpdatedAt);
  const now = new Date();
  const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 90;
}

export default function ProfileSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/players/me"],
    queryFn: api.getMyProfile,
    enabled: !!user,
    retry: false,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/public/teams"],
    queryFn: api.getPublicTeams,
  });

  const { data: teamGenderRules = {} } = useQuery({
    queryKey: ["/api/team-gender-rules"],
    queryFn: api.getTeamGenderRules,
  });

  const isApproved = profile?.registrationStatus === "APPROVED";

  const [form, setForm] = useState({
    firstName: "", lastName: "", gender: "", dob: "", phone: "", email: "",
    homeAddress: "", town: "", region: "", nationality: "", idNumber: "",
    nextOfKinName: "", nextOfKinRelation: "", nextOfKinPhone: "", nextOfKinAddress: "",
    emergencyContactName: "", emergencyContactPhone: "",
    medicalNotes: "", allergies: "", bloodGroup: "", photoUrl: "",
    heightCm: "" as string | number, weightKg: "" as string | number,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || "", lastName: profile.lastName || "",
        gender: profile.gender || "", dob: profile.dob || "",
        phone: profile.phone || "", email: profile.email || user?.email || "",
        homeAddress: profile.homeAddress || "", town: profile.town || "",
        region: profile.region || "", nationality: profile.nationality || "",
        idNumber: profile.idNumber || "",
        nextOfKinName: profile.nextOfKinName || "", nextOfKinRelation: profile.nextOfKinRelation || "",
        nextOfKinPhone: profile.nextOfKinPhone || "", nextOfKinAddress: profile.nextOfKinAddress || "",
        emergencyContactName: profile.emergencyContactName || "", emergencyContactPhone: profile.emergencyContactPhone || "",
        medicalNotes: profile.medicalNotes || "", allergies: profile.allergies || "",
        bloodGroup: profile.bloodGroup || "", photoUrl: profile.photoUrl || "",
        heightCm: profile.heightCm || "", weightKg: profile.weightKg || "",
      });
    }
  }, [profile, user?.email]);

  const age = calculateAge(form.dob as string);
  const weightOverdue = isWeightOverdue(profile?.lastWeightUpdatedAt);

  const currentTeamName = useMemo(() => {
    const teamId = profile?.teamId || profile?.requestedTeamId;
    if (!teamId) return null;
    const team = teams.find((t: any) => t.id === teamId);
    return team?.name || null;
  }, [profile, teams]);

  const genderLockedByTeam = useMemo(() => {
    if (!currentTeamName) return null;
    const rule = teamGenderRules[currentTeamName];
    if (!rule) return null;
    return rule;
  }, [currentTeamName, teamGenderRules]);

  useEffect(() => {
    if (genderLockedByTeam && form.gender !== genderLockedByTeam) {
      setForm(prev => ({ ...prev, gender: genderLockedByTeam }));
    }
  }, [genderLockedByTeam]);

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updateMyProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players/me"] });
      if (isApproved) {
        toast({ title: "Update submitted for admin approval", description: "Your changes will be reviewed by management." });
      } else {
        toast({ title: "Profile saved!", description: "Your information has been updated." });
      }
      setLocation("/dashboard");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.heightCm !== "" && payload.heightCm !== undefined) {
      payload.heightCm = parseInt(String(payload.heightCm), 10);
    } else {
      delete payload.heightCm;
    }
    if (payload.weightKg !== "" && payload.weightKg !== undefined) {
      payload.weightKg = parseInt(String(payload.weightKg), 10);
    } else {
      delete payload.weightKg;
    }
    updateMut.mutate(payload);
  };

  const set = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

  if (isLoading) return <Layout><div className="text-center py-16">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Complete Your Profile</h1>
          <p className="text-muted-foreground mt-2">Please fill in your details to complete your registration</p>
        </div>

        {isApproved && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" data-testid="banner-approval-required">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Profile changes require admin approval</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Your profile has been approved. Any changes you make will be submitted for review by management before being applied.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" /> Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>First Name *</Label><Input value={form.firstName} onChange={e => set("firstName", e.target.value)} required data-testid="input-firstName" /></div>
                <div><Label>Last Name *</Label><Input value={form.lastName} onChange={e => set("lastName", e.target.value)} required data-testid="input-lastName" /></div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={v => set("gender", v)} disabled={!!genderLockedByTeam}>
                    <SelectTrigger data-testid="select-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  {genderLockedByTeam && (
                    <p className="text-[10px] text-muted-foreground mt-1">Gender is set by your team ({currentTeamName})</p>
                  )}
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} data-testid="input-dob" />
                  {age !== null && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-computed-age">Age: {age} years</p>
                  )}
                </div>
                <div><Label>Nationality</Label><Input value={form.nationality} onChange={e => set("nationality", e.target.value)} data-testid="input-nationality" /></div>
                <div><Label>ID/Passport Number</Label><Input value={form.idNumber} onChange={e => set("idNumber", e.target.value)} data-testid="input-idNumber" /></div>
              </div>
              <div className="mt-4">
                <Label className="flex items-center gap-1 mb-2"><Camera className="h-3 w-3" /> Profile Photo</Label>
                <CameraCapture
                  onCapture={(dataUrl) => set("photoUrl", dataUrl)}
                  onClose={() => {}}
                  currentPhoto={form.photoUrl as string || null}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Ruler className="h-4 w-4 text-primary" /> Physical Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Height (cm) *</Label>
                  <Input
                    type="number"
                    min={50}
                    max={250}
                    value={form.heightCm}
                    onChange={e => set("heightCm", e.target.value)}
                    placeholder="e.g. 175"
                    data-testid="input-heightCm"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <span>Weight (kg) *</span>
                    {weightOverdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0" data-testid="badge-weight-overdue">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        Overdue
                      </Badge>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={20}
                    max={200}
                    value={form.weightKg}
                    onChange={e => set("weightKg", e.target.value)}
                    placeholder="e.g. 70"
                    data-testid="input-weightKg"
                  />
                  {profile?.lastWeightUpdatedAt ? (
                    <p className={`text-[10px] mt-1 ${weightOverdue ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-last-weight-update">
                      Last updated: {new Date(profile.lastWeightUpdatedAt).toLocaleDateString()}
                      {weightOverdue && " — Please update your weight"}
                    </p>
                  ) : (
                    <p className="text-[10px] mt-1 text-destructive" data-testid="text-last-weight-update">
                      Weight has never been recorded
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4 text-primary" /> Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} data-testid="input-phone" /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} data-testid="input-playerEmail" /></div>
              </div>
              <div><Label>Home Address</Label><Input value={form.homeAddress} onChange={e => set("homeAddress", e.target.value)} data-testid="input-homeAddress" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Town</Label><Input value={form.town} onChange={e => set("town", e.target.value)} data-testid="input-town" /></div>
                <div><Label>Region</Label><Input value={form.region} onChange={e => set("region", e.target.value)} data-testid="input-region" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-primary" /> Next of Kin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={form.nextOfKinName} onChange={e => set("nextOfKinName", e.target.value)} data-testid="input-nextOfKinName" /></div>
                <div><Label>Relationship</Label><Input value={form.nextOfKinRelation} onChange={e => set("nextOfKinRelation", e.target.value)} data-testid="input-nextOfKinRelation" /></div>
                <div><Label>Phone</Label><Input value={form.nextOfKinPhone} onChange={e => set("nextOfKinPhone", e.target.value)} data-testid="input-nextOfKinPhone" /></div>
                <div><Label>Address</Label><Input value={form.nextOfKinAddress} onChange={e => set("nextOfKinAddress", e.target.value)} data-testid="input-nextOfKinAddress" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} data-testid="input-emergencyContactName" /></div>
                <div><Label>Phone</Label><Input value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} data-testid="input-emergencyContactPhone" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-red-400" /> Medical (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Blood Group</Label>
                  <Select value={form.bloodGroup} onValueChange={v => set("bloodGroup", v)}>
                    <SelectTrigger data-testid="select-bloodGroup"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Allergies</Label><Input value={form.allergies} onChange={e => set("allergies", e.target.value)} data-testid="input-allergies" /></div>
              </div>
              <div><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={e => set("medicalNotes", e.target.value)} rows={3} data-testid="input-medicalNotes" /></div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setLocation("/dashboard")} data-testid="button-skip">
              Skip for now
            </Button>
            <Button type="submit" disabled={updateMut.isPending} data-testid="button-save-profile">
              <CheckCircle className="mr-2 h-4 w-4" />
              {updateMut.isPending ? "Saving..." : isApproved ? "Submit for Approval" : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
