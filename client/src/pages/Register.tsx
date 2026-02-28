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
import logo from "@assets/afrocate_logo_1772226294597.png";

const POSITIONS = ["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"];

export default function Register() {
  const [, setLocation] = useLocation();
  const { register, user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedTeamId, setRequestedTeamId] = useState("");
  const [requestedPosition, setRequestedPosition] = useState("");
  const [requestedJerseyNo, setRequestedJerseyNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/public/teams"],
    queryFn: api.getPublicTeams,
  });

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const extra: any = {};
      if (requestedTeamId) extra.requestedTeamId = requestedTeamId;
      if (requestedPosition) extra.requestedPosition = requestedPosition;
      if (requestedJerseyNo) extra.requestedJerseyNo = parseInt(requestedJerseyNo);

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
      <div className="min-h-screen flex items-center justify-center afrocat-page p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4" />
            <h2 className="text-2xl font-display font-bold text-ac-teal tracking-tight">Afrocat Volleyball Club</h2>
          </div>
          <div className="afrocat-card overflow-hidden">
            <div className="pt-8 pb-8 px-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-ac-green-soft flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-ac-green" />
              </div>
              <h3 className="text-xl font-bold text-ac-text" data-testid="text-register-success">Registration Submitted!</h3>
              <p className="text-ac-muted text-sm" data-testid="text-register-message">{registerMessage}</p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 bg-ac-teal-soft rounded-lg p-3 text-left">
                  <Mail className="h-5 w-5 text-ac-teal shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-ac-text">Check your email</p>
                    <p className="text-xs text-ac-muted">Verify your email address to continue</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-ac-gold-soft rounded-lg p-3 text-left">
                  <Clock className="h-5 w-5 text-ac-gold shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-ac-text">Await approval</p>
                    <p className="text-xs text-ac-muted">Your registration will be reviewed by management</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-4 border-ac-border text-ac-muted hover:bg-ac-white-5 hover:text-ac-text" onClick={() => setLocation("/")} data-testid="button-back-login">
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center afrocat-page p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-ac-teal tracking-tight">Afrocat Volleyball Club</h2>
          <p className="text-sm text-ac-muted mt-1">One Team One Dream — Passion Discipline Victory</p>
        </div>

        <div className="afrocat-card overflow-hidden">
          <div className="space-y-1 text-center pt-6 pb-4 px-6">
            <h3 className="text-2xl font-display font-bold tracking-tight text-ac-text">Player Registration</h3>
            <p className="text-sm text-ac-muted">Create your account to join the club</p>
          </div>
          <div className="px-6 pb-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-ac-muted text-sm">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. John Doe" data-testid="input-fullname"
                  className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-ac-muted text-sm">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" data-testid="input-email"
                  className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-ac-muted text-sm">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 chars" data-testid="input-password"
                    className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-ac-muted text-sm">Confirm</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required data-testid="input-confirm-password"
                    className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
                </div>
              </div>

              <div className="border-t border-ac-border pt-4 mt-2">
                <p className="text-xs text-ac-muted mb-3">Team & position preferences (final approval by Admin/Coach)</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-ac-muted text-sm">Preferred Team</Label>
                    <Select value={requestedTeamId} onValueChange={setRequestedTeamId}>
                      <SelectTrigger data-testid="select-team" className="bg-ac-white-5 border-ac-border text-ac-text">
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
                      <Label className="text-ac-muted text-sm">Position</Label>
                      <Select value={requestedPosition} onValueChange={setRequestedPosition}>
                        <SelectTrigger data-testid="select-position" className="bg-ac-white-5 border-ac-border text-ac-text">
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
                      <Label className="text-ac-muted text-sm">Jersey #</Label>
                      <Input type="number" min={1} max={99} value={requestedJerseyNo} onChange={e => setRequestedJerseyNo(e.target.value)} placeholder="1-99" data-testid="input-jersey"
                        className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full mt-4 bg-ac-teal hover:bg-ac-teal-dark text-white font-semibold" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : "Register as Player"}
              </Button>
            </form>
          </div>
          <div className="flex flex-col border-t border-ac-border px-6 py-4 bg-ac-white-3 rounded-b-[18px]">
            <p className="text-sm text-center text-ac-muted">
              Already have an account?{" "}
              <button onClick={() => setLocation("/")} className="text-ac-gold font-semibold hover:underline cursor-pointer" data-testid="link-login">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
