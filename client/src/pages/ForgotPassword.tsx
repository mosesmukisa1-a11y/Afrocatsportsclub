import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, KeyRound, Clock, CheckCircle2 } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Please enter your email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
            <h2 className="text-xl font-display font-bold text-afrocat-teal tracking-tight">Afrocat Sports Club</h2>
          </div>

          <div className="afrocat-card overflow-hidden">
            <div className="pt-10 pb-6 px-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-afrocat-teal-soft flex items-center justify-center mb-5">
                <CheckCircle2 className="h-8 w-8 text-afrocat-teal" />
              </div>
              <h3 className="text-xl font-display font-bold text-afrocat-text" data-testid="text-forgot-success">
                Request Submitted
              </h3>
              <p className="text-sm text-afrocat-muted mt-3 leading-relaxed">
                Your password reset request for <span className="text-afrocat-text font-medium">{email}</span> has been submitted.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-left space-y-2">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-afrocat-gold mt-0.5 shrink-0" />
                  <p className="text-xs text-afrocat-muted">An admin will review and approve your request. Once approved, you will receive a reset link.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-afrocat-teal mt-0.5 shrink-0" />
                  <p className="text-xs text-afrocat-muted">If you have access to your club admin, ask them to check the User Management page.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-afrocat-border px-6 py-4 bg-afrocat-white-3 rounded-b-[18px]">
              <button
                onClick={() => setLocation("/login")}
                className="flex items-center justify-center gap-2 w-full text-sm text-afrocat-muted hover:text-afrocat-text transition-colors cursor-pointer"
                data-testid="link-back-login"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </button>
            </div>
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
            <h3 className="text-2xl font-display font-bold text-afrocat-text">Forgot Password?</h3>
            <p className="text-sm text-afrocat-muted mt-1">Enter your email address to submit a reset request. An admin will approve it.</p>
          </div>
          <div className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-afrocat-muted text-sm">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  data-testid="input-forgot-email"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted"
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-4 bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold"
                disabled={loading}
                data-testid="button-forgot-submit"
              >
                {loading ? "Submitting..." : "Submit Reset Request"}
              </Button>
            </form>
          </div>
          <div className="border-t border-afrocat-border px-6 py-4 bg-afrocat-white-3 rounded-b-[18px]">
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center justify-center gap-2 w-full text-sm text-afrocat-muted hover:text-afrocat-text transition-colors cursor-pointer"
              data-testid="link-back-login"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
