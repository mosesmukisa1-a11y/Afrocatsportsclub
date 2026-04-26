import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, KeyRound, CheckCircle2, ShieldCheck } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

type Step = "email" | "otp" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.sendOtp(email.trim());
      setStep("otp");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      toast({ title: "Enter the full 6-digit code", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.verifyOtp({ email, otp: code, newPassword });
      setStep("done");
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-afrocat-glow p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
          <h2 className="text-xl font-display font-bold text-afrocat-teal tracking-tight">Afrocat Volleyball Club</h2>
        </div>
        {children}
      </div>
    </div>
  );

  if (step === "done") return (
    <Wrapper>
      <div className="afrocat-card overflow-hidden">
        <div className="pt-10 pb-6 px-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-afrocat-teal-soft flex items-center justify-center mb-5">
            <CheckCircle2 className="h-8 w-8 text-afrocat-teal" />
          </div>
          <h3 className="text-xl font-display font-bold text-afrocat-text">Password Reset!</h3>
          <p className="text-sm text-afrocat-muted mt-3">Your password has been updated. You can now sign in with your new password.</p>
          <Button onClick={() => setLocation("/login")} className="mt-6 w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-go-login">
            Go to Sign In
          </Button>
        </div>
      </div>
    </Wrapper>
  );

  if (step === "otp") return (
    <Wrapper>
      <div className="afrocat-card overflow-hidden">
        <div className="text-center pt-8 pb-4 px-6">
          <div className="mx-auto w-12 h-12 bg-afrocat-teal-soft rounded-full flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-afrocat-teal" />
          </div>
          <h3 className="text-2xl font-display font-bold text-afrocat-text">Enter Your Code</h3>
          <p className="text-sm text-afrocat-muted mt-1">
            We sent a 6-digit code to <span className="text-afrocat-text font-medium">{email}</span>
          </p>
          <p className="text-xs text-afrocat-muted mt-1">Check your inbox — the code expires in 15 minutes.</p>
        </div>
        <form onSubmit={handleVerify} className="px-6 pb-8 space-y-5">
          {/* OTP digit boxes */}
          <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                data-testid={`input-otp-${i}`}
                className="w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-afrocat-white-5 text-afrocat-text outline-none transition-colors
                  border-afrocat-border focus:border-afrocat-teal"
              />
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-afrocat-muted text-sm">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              data-testid="input-new-password"
              className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-afrocat-muted text-sm">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              data-testid="input-confirm-password"
              className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold" data-testid="button-verify-otp">
            {loading ? "Resetting..." : "Reset Password"}
          </Button>

          <div className="text-center space-y-2">
            <button type="button" onClick={() => api.sendOtp(email).then(() => toast({ title: "New code sent!" }))}
              className="text-xs text-afrocat-teal hover:underline cursor-pointer" data-testid="button-resend-otp">
              Didn't receive it? Resend code
            </button>
            <br />
            <button type="button" onClick={() => setStep("email")}
              className="flex items-center justify-center gap-1 text-xs text-afrocat-muted hover:text-afrocat-text w-full cursor-pointer" data-testid="link-change-email">
              <ArrowLeft className="h-3 w-3" /> Use a different email
            </button>
          </div>
        </form>
      </div>
    </Wrapper>
  );

  return (
    <Wrapper>
      <div className="afrocat-card overflow-hidden">
        <div className="text-center pt-8 pb-6 px-6">
          <div className="mx-auto w-12 h-12 bg-afrocat-teal-soft rounded-full flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-afrocat-teal" />
          </div>
          <h3 className="text-2xl font-display font-bold text-afrocat-text">Forgot Password?</h3>
          <p className="text-sm text-afrocat-muted mt-1">Enter your email and we'll send you a reset code instantly.</p>
        </div>
        <div className="px-6 pb-8">
          <form onSubmit={handleSendOtp} className="space-y-4">
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
            <Button type="submit" className="w-full mt-4 bg-afrocat-teal hover:bg-afrocat-teal-dark text-white font-semibold" disabled={loading} data-testid="button-send-otp">
              {loading ? "Sending code..." : <><Mail className="h-4 w-4 mr-2" /> Send Reset Code</>}
            </Button>
          </form>
        </div>
        <div className="border-t border-afrocat-border px-6 py-4 bg-afrocat-white-3 rounded-b-[18px]">
          <button onClick={() => setLocation("/login")}
            className="flex items-center justify-center gap-2 w-full text-sm text-afrocat-muted hover:text-afrocat-text transition-colors cursor-pointer"
            data-testid="link-back-login">
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </button>
        </div>
      </div>
    </Wrapper>
  );
}
