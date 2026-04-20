import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    if (newPassword === oldPassword) {
      toast({ title: "Error", description: "New password must differ from current password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({ oldPassword, newPassword });
      setDone(true);
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="afrocat-card p-10 text-center">
            <div className="mx-auto w-16 h-16 bg-afrocat-green-soft rounded-full flex items-center justify-center mb-5">
              <CheckCircle2 className="w-8 h-8 text-afrocat-green" />
            </div>
            <h2 className="text-2xl font-display font-bold text-afrocat-text mb-2">Password Updated</h2>
            <p className="text-afrocat-muted mb-6">Your password has been changed successfully.</p>
            <Button
              onClick={() => setLocation("/dashboard")}
              className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white"
              data-testid="button-back-dashboard"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight">Change Password</h1>
          <p className="text-afrocat-muted mt-1">
            {user?.mustChangePassword
              ? `You must set a new password before continuing, ${user.fullName}.`
              : "Update your account password at any time."}
          </p>
        </div>

        <div className="afrocat-card overflow-hidden">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-6 py-4 rounded-t-[18px] flex items-center gap-3">
            <div className="w-8 h-8 bg-afrocat-teal-soft rounded-full flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-afrocat-teal" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-afrocat-text">Security Update</h3>
              {user?.mustChangePassword && (
                <p className="text-[11px] text-afrocat-gold">Action required — please change your password to continue</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="oldPassword" className="text-afrocat-muted text-sm">
                {user?.mustChangePassword ? "Current / Temporary Password" : "Current Password"}
              </Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  data-testid="input-old-password"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted pr-10"
                />
                <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-afrocat-muted hover:text-afrocat-text" tabIndex={-1}>
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-afrocat-muted text-sm">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  data-testid="input-new-password"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted pr-10"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-afrocat-muted hover:text-afrocat-text" tabIndex={-1}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="flex gap-1 mt-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPassword.length >= 12 ? "bg-afrocat-green" :
                      newPassword.length >= 10 && i < 3 ? "bg-afrocat-teal" :
                      newPassword.length >= 8 && i < 2 ? "bg-afrocat-gold" :
                      newPassword.length >= 6 && i < 1 ? "bg-afrocat-red" :
                      "bg-afrocat-white-5"
                    }`} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-afrocat-muted text-sm">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  data-testid="input-confirm-password"
                  className={`bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted pr-10 ${confirmPassword && confirmPassword !== newPassword ? "border-afrocat-red" : ""}`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-afrocat-muted hover:text-afrocat-text" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-afrocat-red">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold"
              disabled={loading}
              data-testid="button-change-password"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>

        {!user?.mustChangePassword && (
          <p className="text-xs text-afrocat-muted text-center mt-4">
            Forgot your current password? Log out and use "Forgot Password" on the login page.
          </p>
        )}
      </div>
    </Layout>
  );
}
