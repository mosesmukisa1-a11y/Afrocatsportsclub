import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Mail, Clock } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import logo from "@assets/afrocate_logo_1772226294597.png";

const POSITIONS = ["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"];
const ROLES = [
  { value: "PLAYER", label: "Player", desc: "Join as a club player" },
  { value: "COACH", label: "Coach", desc: "Register as a coach" },
  { value: "STATISTICIAN", label: "Statistician", desc: "Enter match stats & reports" },
  { value: "MEDICAL", label: "Medical Staff", desc: "Manage injuries & wellness" },
  { value: "FINANCE", label: "Finance", desc: "Manage club finances" },
];

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { register, user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("PLAYER");
  const [requestedTeamId, setRequestedTeamId] = useState("");
  const [requestedPosition, setRequestedPosition] = useState("");
  const [requestedJerseyNo, setRequestedJerseyNo] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  const age = dob ? calculateAge(dob) : null;
  const isMinor = age !== null && age < 17;
  const idRequired = !isMinor;

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/public/teams"],
    queryFn: api.getPublicTeams,
  });

  useEffect(() => {
    if (user) {
      const dest = user.role === "PLAYER" ? "/player-dashboard" : user.role === "STATISTICIAN" ? "/stats" : user.role === "FINANCE" ? "/finance" : user.role === "MEDICAL" ? "/injuries" : "/dashboard";
      setLocation(dest);
    }
  }, [user, setLocation]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) { toast({ title: "Full name is required", variant: "destructive" }); return; }
    if (!email.trim()) { toast({ title: "Email is required", variant: "destructive" }); return; }
    if (!phone.trim()) { toast({ title: "Phone number is required", variant: "destructive" }); return; }
    if (!dob) { toast({ title: "Date of birth is required", variant: "destructive" }); return; }
    if (!nationality.trim()) { toast({ title: "Nationality is required", variant: "destructive" }); return; }
    if (idRequired && !idNumber.trim()) { toast({ title: "ID/Passport number is required for ages 17+", variant: "destructive" }); return; }
    if (!photo) { toast({ title: "Photo is required. Please take a photo with your camera.", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (password.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }

    if (selectedRole === "PLAYER") {
      if (!requestedTeamId) { toast({ title: "Please select a team", variant: "destructive" }); return; }
      if (!requestedPosition) { toast({ title: "Please select a position", variant: "destructive" }); return; }
      if (!requestedJerseyNo) { toast({ title: "Please enter a jersey number", variant: "destructive" }); return; }
    }

    setLoading(true);
    try {
      const extra: any = {
        role: selectedRole,
        phone,
        dob,
        nationality,
        idNumber: idRequired ? idNumber : undefined,
        photo,
      };
      if (selectedRole === "PLAYER") {
        if (requestedTeamId) extra.requestedTeamId = requestedTeamId;
        if (requestedPosition) extra.requestedPosition = requestedPosition;
        if (requestedJerseyNo) extra.requestedJerseyNo = parseInt(requestedJerseyNo);
      }

      const result = await register(fullName, email, password, extra);
      setRegistered(true);
      setRegisterMessage(result.message);
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4" />
            <h2 className="text-2xl font-display font-bold text-afrocat-teal tracking-tight">Afrocat Volleyball Club</h2>
          </div>
          <div className="afrocat-card overflow-hidden">
            <div className="pt-8 pb-8 px-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-afrocat-green-soft flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-afrocat-green" />
              </div>
              <h3 className="text-xl font-bold text-afrocat-text" data-testid="text-register-success">Registration Submitted!</h3>
              <p className="text-afrocat-muted text-sm" data-testid="text-register-message">{registerMessage}</p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 bg-afrocat-teal-soft rounded-lg p-3 text-left">
                  <Mail className="h-5 w-5 text-afrocat-teal shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-afrocat-text">Check your email</p>
                    <p className="text-xs text-afrocat-muted">Verify your email address to continue</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-afrocat-gold-soft rounded-lg p-3 text-left">
                  <Clock className="h-5 w-5 text-afrocat-gold shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-afrocat-text">Await approval</p>
                    <p className="text-xs text-afrocat-muted">Your registration will be reviewed by management</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-4 border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text" onClick={() => setLocation("/login")} data-testid="button-back-login">
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-afrocat-teal tracking-tight">Afrocat Volleyball Club</h2>
          <p className="text-sm text-afrocat-muted mt-1">One Team One Dream — Passion Discipline Victory</p>
        </div>

        <div className="afrocat-card overflow-hidden">
          <div className="space-y-1 text-center pt-6 pb-4 px-6">
            <h3 className="text-2xl font-display font-bold tracking-tight text-afrocat-text">Join Afrocat</h3>
            <p className="text-sm text-afrocat-muted">Create your account to join the club</p>
          </div>
          <div className="px-6 pb-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-afrocat-muted text-sm">I want to join as</Label>
                <div className="grid grid-cols-2 gap-2" data-testid="select-role">
                  {ROLES.map(r => (
                    <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                      className={`text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${selectedRole === r.value
                        ? "border-afrocat-teal bg-afrocat-teal/15 text-afrocat-teal"
                        : "border-afrocat-border bg-afrocat-white-5 text-afrocat-muted hover:border-afrocat-teal/30"}`}
                      data-testid={`role-option-${r.value.toLowerCase()}`}>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-[10px] opacity-70">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-afrocat-border pt-4">
                <Label className="text-afrocat-muted text-sm mb-2 block">Profile Photo <span className="text-afrocat-red">*</span></Label>
                <CameraCapture
                  onCapture={(dataUrl) => { setPhoto(dataUrl || null); }}
                  onClose={() => {}}
                  currentPhoto={photo}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-afrocat-muted text-sm">Full Name <span className="text-afrocat-red">*</span></Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. John Doe" data-testid="input-fullname"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-afrocat-muted text-sm">Email <span className="text-afrocat-red">*</span></Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" data-testid="input-email"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-afrocat-muted text-sm">Phone Number <span className="text-afrocat-red">*</span></Label>
                <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+264 81 000 0000" data-testid="input-phone"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-afrocat-muted text-sm">Date of Birth <span className="text-afrocat-red">*</span></Label>
                  <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} required data-testid="input-dob"
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
                  {age !== null && (
                    <p className="text-[10px] text-afrocat-muted">Age: {age} years {isMinor && <span className="text-afrocat-gold">(Minor — ID not required)</span>}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality" className="text-afrocat-muted text-sm">Nationality <span className="text-afrocat-red">*</span></Label>
                  <Input id="nationality" value={nationality} onChange={e => setNationality(e.target.value)} required placeholder="e.g. Namibian" data-testid="input-nationality"
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber" className="text-afrocat-muted text-sm">
                  ID / Passport Number {idRequired ? <span className="text-afrocat-red">*</span> : <span className="text-afrocat-muted text-[10px]">(optional for under 17)</span>}
                </Label>
                <Input id="idNumber" value={idNumber} onChange={e => setIdNumber(e.target.value)} required={idRequired} placeholder="National ID or Passport number" data-testid="input-id-number"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-afrocat-muted text-sm">Password <span className="text-afrocat-red">*</span></Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 chars" data-testid="input-password"
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-afrocat-muted text-sm">Confirm <span className="text-afrocat-red">*</span></Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required data-testid="input-confirm-password"
                    className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
                </div>
              </div>

              {selectedRole === "PLAYER" && (
                <div className="border-t border-afrocat-border pt-4 mt-2">
                  <p className="text-xs text-afrocat-muted mb-3">Team & position preferences <span className="text-afrocat-red">*</span></p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-afrocat-muted text-sm">Preferred Team <span className="text-afrocat-red">*</span></Label>
                      <Select value={requestedTeamId} onValueChange={setRequestedTeamId}>
                        <SelectTrigger data-testid="select-team" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-afrocat-muted text-sm">Position <span className="text-afrocat-red">*</span></Label>
                        <Select value={requestedPosition} onValueChange={setRequestedPosition}>
                          <SelectTrigger data-testid="select-position" className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text">
                            <SelectValue placeholder="Position" />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITIONS.map(p => (
                              <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-afrocat-muted text-sm">Jersey # <span className="text-afrocat-red">*</span></Label>
                        <Input type="number" min={1} max={99} value={requestedJerseyNo} onChange={e => setRequestedJerseyNo(e.target.value)} required placeholder="1-99" data-testid="input-jersey"
                          className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full mt-4 bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : `Register as ${ROLES.find(r => r.value === selectedRole)?.label || "Player"}`}
              </Button>
            </form>
          </div>
          <div className="flex flex-col border-t border-afrocat-border px-6 py-4 bg-afrocat-white-3 rounded-b-[18px]">
            <p className="text-sm text-center text-afrocat-muted">
              Already have an account?{" "}
              <button onClick={() => setLocation("/login")} className="text-afrocat-gold font-semibold hover:underline cursor-pointer" data-testid="link-login">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
