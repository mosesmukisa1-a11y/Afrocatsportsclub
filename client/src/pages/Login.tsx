import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simply redirect to dashboard for the mockup
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-3xl shadow-lg">
            AC
          </div>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-display font-bold tracking-tight">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to the Afrocat Club Portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@afrocat.club" 
                  defaultValue="admin@afrocat.club"
                  required 
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  defaultValue="password123"
                  required 
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full mt-6" data-testid="button-login">
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t px-6 py-4 bg-muted/50 rounded-b-xl">
            <div className="text-sm text-center text-muted-foreground mb-4">
              Demo Credentials available for:
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs px-2 py-1 bg-background border rounded-md">Admin</span>
              <span className="text-xs px-2 py-1 bg-background border rounded-md">Coach</span>
              <span className="text-xs px-2 py-1 bg-background border rounded-md">Player</span>
              <span className="text-xs px-2 py-1 bg-background border rounded-md">Medical</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}