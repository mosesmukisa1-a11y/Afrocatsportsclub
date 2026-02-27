import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4" />
            <h2 className="text-2xl font-display font-bold text-primary tracking-tight">Afrocat Volleyball Club</h2>
          </div>
          <Card className="border-none shadow-xl">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold" data-testid="text-register-success">Registration Submitted!</h3>
              <p className="text-muted-foreground text-sm" data-testid="text-register-message">{registerMessage}</p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3 text-left">
                  <Mail className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Check your email</p>
                    <p className="text-xs text-muted-foreground">Verify your email address to continue</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 rounded-lg p-3 text-left">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Await approval</p>
                    <p className="text-xs text-muted-foreground">Your registration will be reviewed by management</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-4" onClick={() => setLocation("/")} data-testid="button-back-login">
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-primary tracking-tight">Afrocat Volleyball Club</h2>
          <p className="text-sm text-muted-foreground mt-1">One Team One Dream — Passion Discipline Victory</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl font-display font-bold tracking-tight">Player Registration</CardTitle>
            <CardDescription>Create your account to join the club</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. John Doe" data-testid="input-fullname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" data-testid="input-email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 chars" data-testid="input-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required data-testid="input-confirm-password" />
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground mb-3">Team & position preferences (final approval by Admin/Coach)</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Preferred Team</Label>
                    <Select value={requestedTeamId} onValueChange={setRequestedTeamId}>
                      <SelectTrigger data-testid="select-team">
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
                      <Label>Position</Label>
                      <Select value={requestedPosition} onValueChange={setRequestedPosition}>
                        <SelectTrigger data-testid="select-position">
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
                      <Label>Jersey #</Label>
                      <Input type="number" min={1} max={99} value={requestedJerseyNo} onChange={e => setRequestedJerseyNo(e.target.value)} placeholder="1-99" data-testid="input-jersey" />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : "Register as Player"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t px-6 py-4 bg-muted/50 rounded-b-xl">
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => setLocation("/")} className="text-primary font-semibold hover:underline cursor-pointer" data-testid="link-login">
                Sign in
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
