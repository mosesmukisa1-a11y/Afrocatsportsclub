import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("admin@afrocat.test");
  const [password, setPassword] = useState("Passw0rd!");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mustChangePassword) {
        setLocation("/change-password");
      } else {
        setLocation("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email: string) => {
    setEmail(email);
    setPassword("Passw0rd!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center afrocat-page p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-32 h-32 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-ac-teal tracking-tight">Afrocat Sports Club</h2>
          <p className="text-xs text-ac-muted mt-1">One Team One Dream — Passion Discipline Victory</p>
        </div>
        
        <div className="afrocat-card p-0 overflow-hidden">
          <div className="space-y-1 text-center pt-8 pb-6 px-6">
            <h3 className="text-3xl font-display font-bold tracking-tight text-ac-text">Welcome Back</h3>
            <p className="text-sm text-ac-muted">Sign in to the Afrocat Club Portal</p>
          </div>
          <div className="px-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-ac-muted text-sm">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email"
                  className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-ac-muted text-sm">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-password"
                  className="bg-ac-white-5 border-ac-border text-ac-text placeholder:text-ac-muted" />
              </div>
              <Button type="submit" className="w-full mt-6 bg-ac-teal hover:bg-ac-teal-dark text-white font-semibold" disabled={loading} data-testid="button-login">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
          <div className="flex flex-col border-t border-ac-border px-6 py-4 bg-ac-white-3 rounded-b-[18px]">
            <p className="text-sm text-center text-ac-muted mb-3">
              New player?{" "}
              <button onClick={() => setLocation("/register")} className="text-ac-gold font-semibold hover:underline cursor-pointer" data-testid="link-register">
                Register here
              </button>
            </p>
            <div className="text-sm text-center text-ac-muted mb-3">Quick login as:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "Admin", email: "admin@afrocat.test" },
                { label: "Coach", email: "coach@afrocat.test" },
                { label: "Stats", email: "stats@afrocat.test" },
                { label: "Finance", email: "finance@afrocat.test" },
                { label: "Medical", email: "medical@afrocat.test" },
                { label: "Player", email: "player1@afrocat.test" },
              ].map(r => (
                <button key={r.email} onClick={() => quickLogin(r.email)}
                  className="text-xs px-2 py-1 bg-ac-white-5 border border-ac-border rounded-md hover:bg-ac-teal/15 hover:border-ac-teal/30 hover:text-ac-teal transition-colors cursor-pointer text-ac-muted"
                  data-testid={`button-quick-login-${r.label.toLowerCase()}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
