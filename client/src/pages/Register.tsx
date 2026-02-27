import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function Register() {
  const [, setLocation] = useLocation();
  const { register, user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      await register(fullName, email, password);
      toast({ title: "Welcome to Afrocat!", description: "Complete your profile to get started." });
      setLocation("/profile-setup");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-28 h-28 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-primary tracking-tight">Afrocat Volleyball Club</h2>
          <p className="text-sm text-muted-foreground mt-1">One Team One Dream — Passion Discipline Victory</p>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" data-testid="input-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required data-testid="input-confirm-password" />
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
