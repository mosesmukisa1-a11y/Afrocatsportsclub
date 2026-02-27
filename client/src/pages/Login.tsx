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
      await login(email, password);
      setLocation("/dashboard");
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-32 h-32 object-contain mb-4 animate-in zoom-in-50 duration-500" />
          <h2 className="text-2xl font-display font-bold text-primary tracking-tight">Afrocat Sports Club</h2>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-display font-bold tracking-tight">Welcome Back</CardTitle>
            <CardDescription>Sign in to the Afrocat Club Portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-password" />
              </div>
              <Button type="submit" className="w-full mt-6" disabled={loading} data-testid="button-login">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t px-6 py-4 bg-muted/50 rounded-b-xl">
            <p className="text-sm text-center text-muted-foreground mb-3">
              New player?{" "}
              <button onClick={() => setLocation("/register")} className="text-primary font-semibold hover:underline cursor-pointer" data-testid="link-register">
                Register here
              </button>
            </p>
            <div className="text-sm text-center text-muted-foreground mb-3">Quick login as:</div>
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
                  className="text-xs px-2 py-1 bg-background border rounded-md hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer"
                  data-testid={`button-quick-login-${r.label.toLowerCase()}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
