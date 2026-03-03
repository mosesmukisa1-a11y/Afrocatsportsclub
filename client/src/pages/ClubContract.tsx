import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  ScrollText, CheckCircle, AlertTriangle, Loader2, FileText,
  Shield, UserCheck, Baby, Download
} from "lucide-react";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function ClubContract() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contractStatus, isLoading } = useQuery({
    queryKey: ["/api/contract/status"],
    queryFn: api.getClubContractStatus,
    enabled: !!user,
  });

  const { data: playerProfile } = useQuery({
    queryKey: ["/api/players/me"],
    queryFn: api.getMyProfile,
    enabled: !!user && user.role === "PLAYER",
  });

  const isMinor = (() => {
    if (!playerProfile?.dob) return false;
    const birth = new Date(playerProfile.dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age < 18;
  })();

  const [formData, setFormData] = useState({
    accepterFullName: "",
    guardianIdNumber: "",
    guardianPhoneNumber: "",
    agreed: false,
  });

  const acceptMut = useMutation({
    mutationFn: () => api.acceptClubContract({
      accepterFullName: formData.accepterFullName,
      acceptedBy: isMinor ? "GUARDIAN" : "SELF",
      guardianIdNumber: isMinor ? formData.guardianIdNumber : undefined,
      guardianPhoneNumber: isMinor ? formData.guardianPhoneNumber : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Contract Confirmed!", description: "Thank you for confirming the club contract." });
      qc.invalidateQueries({ queryKey: ["/api/contract/status"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isAccepted = contractStatus?.accepted === true;

  const canSubmit = formData.agreed && formData.accepterFullName.trim() &&
    (!isMinor || (formData.guardianIdNumber.trim() && formData.guardianPhoneNumber.trim()));

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-afrocat-teal" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Afrocat Logo" className="w-14 h-14 object-contain" data-testid="img-afrocat-logo" />
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-page-title">
                Club Contract
              </h1>
              <p className="text-sm text-afrocat-muted italic mt-0.5">
                Afrocat Volleyball Club — Official Application & Contract
              </p>
            </div>
            {isAccepted ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-afrocat-green-soft text-afrocat-green text-xs font-bold" data-testid="badge-contract-accepted">
                <CheckCircle className="w-3.5 h-3.5" /> Confirmed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-afrocat-red-soft text-afrocat-red text-xs font-bold" data-testid="badge-contract-pending">
                <AlertTriangle className="w-3.5 h-3.5" /> Not Confirmed
              </span>
            )}
          </div>
        </div>

        {isAccepted && (
          <div className="afrocat-card border border-afrocat-green/30 p-5" data-testid="card-confirmed">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-afrocat-green" />
              <div className="flex-1">
                <p className="font-bold text-afrocat-green">Contract Confirmed</p>
                <p className="text-xs text-afrocat-muted">
                  Confirmed on {new Date(contractStatus.acceptedAt).toLocaleDateString()} at {new Date(contractStatus.acceptedAt).toLocaleTimeString()}
                </p>
                <p className="text-xs text-afrocat-muted">
                  By: {contractStatus.accepterFullName} ({contractStatus.acceptedBy === "GUARDIAN" ? "Parent/Guardian" : "Self"})
                </p>
              </div>
              {contractStatus.signedPdfUrl && (
                <a
                  href={contractStatus.signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-teal hover:bg-afrocat-teal/80 text-white text-sm font-bold transition-colors"
                  data-testid="link-download-signed-pdf"
                >
                  <Download className="w-4 h-4" /> Download Signed PDF
                </a>
              )}
            </div>
          </div>
        )}

        <div className="afrocat-card overflow-hidden" data-testid="card-contract-pdf">
          <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px]">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal">
              <FileText className="w-5 h-5" /> Official Contract Document
            </h3>
          </div>
          <div className="p-5">
            <iframe
              src="/contracts/afrocat-volleyball-contract.pdf"
              className="w-full h-[70vh] rounded-lg border border-afrocat-border"
              title="Afrocat Volleyball Club Contract"
              data-testid="iframe-contract-pdf"
            />
            <p className="text-xs text-afrocat-muted mt-3 text-center">
              Please read the entire contract document above before confirming below.
            </p>
          </div>
        </div>

        {!isAccepted && (
          <div className="afrocat-card overflow-hidden" data-testid="card-confirmation-form">
            <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold">
                {isMinor ? (
                  <><Baby className="w-5 h-5" /> Parent/Guardian Confirmation Required</>
                ) : (
                  <><UserCheck className="w-5 h-5" /> Confirm Contract</>
                )}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mb-1">Sport</div>
                <div className="text-sm font-bold text-afrocat-teal flex items-center gap-2" data-testid="text-sport">
                  <Shield className="w-4 h-4" /> VOLLEYBALL
                </div>
              </div>

              {isMinor && (
                <div className="p-3 rounded-xl bg-afrocat-red-soft border border-afrocat-red/20">
                  <p className="text-sm text-afrocat-red font-semibold flex items-center gap-2">
                    <Baby className="w-4 h-4" /> This player is under 18. A parent or guardian must complete the confirmation.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">
                  {isMinor ? "Parent/Guardian Full Name *" : "Full Name *"}
                </label>
                <input
                  type="text"
                  value={formData.accepterFullName}
                  onChange={e => setFormData(f => ({ ...f, accepterFullName: e.target.value }))}
                  placeholder={isMinor ? "Guardian full name" : user?.fullName || "Your full name"}
                  className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                  data-testid="input-accepter-name"
                />
              </div>

              {isMinor && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">
                      Guardian ID Number *
                    </label>
                    <input
                      type="text"
                      value={formData.guardianIdNumber}
                      onChange={e => setFormData(f => ({ ...f, guardianIdNumber: e.target.value }))}
                      placeholder="Guardian national ID number"
                      className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                      data-testid="input-guardian-id"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">
                      Guardian Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={formData.guardianPhoneNumber}
                      onChange={e => setFormData(f => ({ ...f, guardianPhoneNumber: e.target.value }))}
                      placeholder="+264..."
                      className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                      data-testid="input-guardian-phone"
                    />
                  </div>
                </>
              )}

              <label className="flex items-start gap-3 p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border cursor-pointer hover:bg-afrocat-white-5 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.agreed}
                  onChange={e => setFormData(f => ({ ...f, agreed: e.target.checked }))}
                  className="mt-0.5 w-5 h-5 rounded border-afrocat-border accent-afrocat-teal"
                  data-testid="checkbox-agree"
                />
                <span className="text-sm text-afrocat-text">
                  {isMinor
                    ? "I, as the parent/guardian of this minor, confirm that I have read and agree to the terms and conditions of the Afrocat Volleyball Club contract on their behalf."
                    : "I have read and agree to the terms and conditions of the Afrocat Volleyball Club contract."}
                </span>
              </label>

              <Button
                onClick={() => acceptMut.mutate()}
                disabled={!canSubmit || acceptMut.isPending}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80 w-full"
                data-testid="button-confirm-contract"
              >
                {acceptMut.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" /> Confirm Contract</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}