import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, useSearch } from "wouter";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, CheckCircle2 } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tokenFromUrl = params.get("token") || "";
  const emailFromUrl = params.get("email") || "";
  const { toast } = useToast();

  const [email, setEmail] = useState(emailFromUrl);
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ email, token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
        <div className="afrocat-card w-full max-w-md overflow-hidden">
          <div className="py-12 px-6 text-center">
            <div className="mx-auto w-16 h-16 bg-afrocat-green-soft rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-afrocat-green" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2 text-afrocat-text">Password Reset Complete</h2>
            <p className="text-afrocat-muted mb-6">Your password has been updated. You can now sign in.</p>
            <Button onClick={() => setLocation("/login")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-go-login">Go to Login</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
          <h2 className="text-xl font-display font-bold text-afrocat-teal tracking-tight">Afrocat Sports Club</h2>
        </div>

        <div className="afrocat-card overflow-hidden">
          <div className="text-center pt-8 pb-6 px-6">
            <div className="mx-auto w-12 h-12 bg-afrocat-teal-soft rounded-full flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6 text-afrocat-teal" />
            </div>
            <h3 className="text-2xl font-display font-bold text-afrocat-text">Reset Password</h3>
            <p className="text-sm text-afrocat-muted mt-1">Set a new password for your account.</p>
          </div>
          <div className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-afrocat-muted text-sm">Email</Label>
                <Input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  data-testid="input-reset-email"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token" className="text-afrocat-muted text-sm">Reset Token</Label>
                <Input
                  id="token" type="text" value={token}
                  onChange={e => setToken(e.target.value)} required
                  placeholder="Paste reset token here"
                  data-testid="input-reset-token"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-afrocat-muted text-sm">New Password</Label>
                <Input
                  id="newPassword" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required
                  data-testid="input-reset-new-password"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-afrocat-muted text-sm">Confirm New Password</Label>
                <Input
                  id="confirmPassword" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required
                  data-testid="input-reset-confirm-password"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                />
              </div>
              <Button type="submit" className="w-full mt-4 bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold" disabled={loading} data-testid="button-reset-password">
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
