import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
          <h2 className="text-xl font-display font-bold text-primary tracking-tight">Afrocat Sports Club</h2>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-amber-600" />
            </div>
            <CardTitle className="text-2xl font-display font-bold">Change Password</CardTitle>
            <CardDescription>
              {user ? `You must set a new password before continuing, ${user.fullName}.` : "Set a new password to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Current / Temporary Password</Label>
                <Input
                  id="oldPassword" type="password" value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)} required
                  data-testid="input-old-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required
                  data-testid="input-confirm-password"
                />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={loading} data-testid="button-change-password">
                <ShieldCheck className="w-4 h-4 mr-2" />
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
