import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Lock, ShieldCheck } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({ oldPassword, newPassword });
      toast({ title: "Password Changed", description: "Your password has been updated successfully." });
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center afrocat-page p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
          <h2 className="text-xl font-display font-bold text-ac-teal tracking-tight">Afrocat Sports Club</h2>
        </div>

        <div className="afrocat-card overflow-hidden">
          <div className="text-center pt-8 pb-6 px-6">
            <div className="mx-auto w-12 h-12 bg-ac-gold-soft rounded-full flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-ac-gold" />
            </div>
            <h3 className="text-2xl font-display font-bold text-ac-text">Change Password</h3>
            <p className="text-sm text-ac-muted mt-1">
              {user ? `You must set a new password before continuing, ${user.fullName}.` : "Set a new password to continue."}
            </p>
          </div>
          <div className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword" className="text-ac-muted text-sm">Current / Temporary Password</Label>
                <Input
                  id="oldPassword" type="password" value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)} required
                  data-testid="input-old-password"
                  className="bg-ac-white-5 border-ac-border text-ac-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-ac-muted text-sm">New Password</Label>
                <Input
                  id="newPassword" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required
                  data-testid="input-new-password"
                  className="bg-ac-white-5 border-ac-border text-ac-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-ac-muted text-sm">Confirm New Password</Label>
                <Input
                  id="confirmPassword" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required
                  data-testid="input-confirm-password"
                  className="bg-ac-white-5 border-ac-border text-ac-text"
                />
              </div>
              <Button type="submit" className="w-full mt-4 bg-ac-teal hover:bg-ac-teal-dark text-white font-semibold" disabled={loading} data-testid="button-change-password">
                <ShieldCheck className="w-4 h-4 mr-2" />
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
