import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    api.verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
        setRequiresApproval(res.requiresApproval);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Verification failed.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afrocat Logo" className="w-24 h-24 object-contain mb-4" />
          <h2 className="text-xl font-display font-bold text-primary tracking-tight">Afrocat Volleyball Club</h2>
        </div>
        <Card className="border-none shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground" data-testid="text-verifying">Verifying your email...</p>
              </>
            )}
            {status === "success" && (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold" data-testid="text-verify-success">Email Verified!</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-verify-message">{message}</p>
                {!requiresApproval && (
                  <Button onClick={() => setLocation("/")} className="mt-4" data-testid="button-goto-login">
                    Go to Login
                  </Button>
                )}
                {requiresApproval && (
                  <div className="bg-amber-50 rounded-lg p-4 text-sm text-left mt-4">
                    <p className="font-medium text-amber-800">Your account is awaiting approval</p>
                    <p className="text-amber-700 mt-1">You will be able to log in once an administrator approves your registration.</p>
                  </div>
                )}
              </>
            )}
            {status === "error" && (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold" data-testid="text-verify-error">Verification Failed</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-verify-error-message">{message}</p>
              </>
            )}
            <Button variant="outline" onClick={() => setLocation("/")} className="mt-4" data-testid="button-back-login">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
