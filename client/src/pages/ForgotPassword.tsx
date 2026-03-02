import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Copy, Check, KeyRound, ExternalLink } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Please enter your email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await api.forgotPassword(email);
      setSubmitted(true);
      if (result.resetLink) {
        setResetLink(result.resetLink);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <div className="pt-8 pb-6 px-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-afrocat-teal-soft flex items-center justify-center mb-4">
                <Mail className="h-7 w-7 text-afrocat-teal" />
              </div>
              <h3 className="text-xl font-display font-bold text-afrocat-text" data-testid="text-forgot-success">Check Your Email</h3>
              <p className="text-sm text-afrocat-muted mt-2">
                If an account exists for <span className="text-afrocat-text font-medium">{email}</span>, a password reset link has been generated.
              </p>
            </div>

            {resetLink && (
              <div className="px-6 pb-6 space-y-3">
                <div className="p-3 rounded-lg bg-afrocat-gold-soft border border-afrocat-gold/20">
                  <p className="text-xs text-afrocat-gold font-medium mb-2">Your reset link (expires in 1 hour):</p>
                  <div className="flex gap-2">
                    <Input readOnly value={resetLink} className="text-xs bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-reset-link" />
                    <Button variant="outline" size="sm" onClick={handleCopy} className="border-afrocat-border shrink-0" data-testid="button-copy-reset-link">
                      {copied ? <Check className="h-4 w-4 text-afrocat-green" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold"
                  onClick={() => {
                    const url = new URL(resetLink);
                    setLocation(url.pathname + url.search);
                  }}
                  data-testid="button-go-reset"
                >
                  <KeyRound className="h-4 w-4 mr-2" /> Reset Password Now
                </Button>
              </div>
            )}

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
            <p className="text-sm text-afrocat-muted mt-1">Enter your email address and we'll generate a reset link for you.</p>
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
                {loading ? "Sending..." : "Send Reset Link"}
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
