import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  ScrollText, CheckCircle, AlertTriangle, Calendar, DollarSign,
  Package, Truck, FileText, Loader2, PenLine, Shield
} from "lucide-react";

const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  FIRST_AID: "First Aid",
  PETROL: "Petrol",
  BALL: "Ball",
  TOURNAMENT: "Tournament",
  YEAR_END: "Year End",
  TOUR: "Tour",
  OTHER: "Other",
};

export default function MyContract() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showConfirmSign, setShowConfirmSign] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/contracts/my-contract"],
    queryFn: api.getMyContract,
    enabled: !!user,
  });

  const signMut = useMutation({
    mutationFn: () => api.playerSignContract(data?.contract?.id),
    onSuccess: () => {
      toast({ title: "Contract Signed!", description: "Thank you for confirming your contract." });
      qc.invalidateQueries({ queryKey: ["/api/contracts/my-contract"] });
      setShowConfirmSign(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const contract = data?.contract;
  const items = data?.items || [];
  const transport = data?.transport || [];
  const contributions = data?.contributions || [];
  const player = data?.player;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-afrocat-teal" />
        </div>
      </Layout>
    );
  }

  if (!contract) {
    return (
      <Layout>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="afrocat-card p-8 text-center">
            <ScrollText className="w-12 h-12 mx-auto mb-4 text-afrocat-muted opacity-40" />
            <h2 className="text-xl font-display font-bold text-afrocat-text mb-2" data-testid="text-no-contract">No Contract Found</h2>
            <p className="text-afrocat-muted">You don't have an active contract yet. Please contact the club administration.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isSigned = !!contract.signedByPlayer;
  const statusColor = contract.status === "ACTIVE" ? "text-afrocat-green" : contract.status === "DRAFT" ? "text-afrocat-gold" : "text-afrocat-red";
  const statusBg = contract.status === "ACTIVE" ? "bg-afrocat-green-soft" : contract.status === "DRAFT" ? "bg-afrocat-gold-soft" : "bg-afrocat-red-soft";

  const totalItemsValue = items.reduce((s: number, i: any) => s + (i.totalValue || 0), 0);
  const totalTransportValue = transport.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalContribPaid = contributions.filter((c: any) => c.status === "PAID").reduce((s: number, c: any) => s + (c.amount || 0), 0);
  const totalContribDue = contributions.filter((c: any) => c.status !== "PAID").reduce((s: number, c: any) => s + (c.amount || 0), 0);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-afrocat-teal-soft flex items-center justify-center">
              <ScrollText className="w-7 h-7 text-afrocat-teal" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-page-title">
                My Contract
              </h1>
              <p className="text-sm text-afrocat-muted italic mt-0.5">
                Review your contract details and obligations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusBg} ${statusColor}`} data-testid="badge-contract-status">
                {contract.status}
              </span>
              {isSigned ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-afrocat-green-soft text-afrocat-green text-xs font-bold" data-testid="badge-signed">
                  <CheckCircle className="w-3.5 h-3.5" /> Signed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-afrocat-red-soft text-afrocat-red text-xs font-bold" data-testid="badge-unsigned">
                  <AlertTriangle className="w-3.5 h-3.5" /> Not Signed
                </span>
              )}
            </div>
          </div>
        </div>

        {!isSigned && (
          <div className="afrocat-card border border-afrocat-gold/30 overflow-hidden" data-testid="card-sign-prompt">
            <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold">
                <PenLine className="w-5 h-5" /> Action Required
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-afrocat-text mb-4">
                Please review all the contract details below carefully. Once you are satisfied, click the button to confirm and sign your contract.
              </p>
              {!showConfirmSign ? (
                <Button
                  onClick={() => setShowConfirmSign(true)}
                  className="bg-afrocat-teal hover:bg-afrocat-teal/80"
                  data-testid="button-start-sign"
                >
                  <PenLine className="w-4 h-4 mr-2" /> I Have Read & Want to Sign
                </Button>
              ) : (
                <div className="p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border space-y-3">
                  <p className="text-sm font-semibold text-afrocat-text">
                    By clicking "Confirm & Sign", you acknowledge that you have read and agree to all the terms, obligations, and financial commitments outlined in this contract.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => signMut.mutate()}
                      disabled={signMut.isPending}
                      className="bg-afrocat-green hover:bg-afrocat-green/80"
                      data-testid="button-confirm-sign"
                    >
                      {signMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing...</> : <><CheckCircle className="w-4 h-4 mr-2" /> Confirm & Sign</>}
                    </Button>
                    <Button variant="outline" onClick={() => setShowConfirmSign(false)} className="border-afrocat-border text-afrocat-text" data-testid="button-cancel-sign">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isSigned && contract.playerSignedAt && (
          <div className="afrocat-card border border-afrocat-green/30 p-5" data-testid="card-signed-confirmation">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-afrocat-green" />
              <div>
                <p className="font-bold text-afrocat-green">Contract Signed</p>
                <p className="text-xs text-afrocat-muted">
                  Signed on {new Date(contract.playerSignedAt).toLocaleDateString()} at {new Date(contract.playerSignedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {contract.contractFileUrl && (
          <div className="afrocat-card overflow-hidden" data-testid="card-contract-document">
            <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal">
                <FileText className="w-5 h-5" /> Contract Document
              </h3>
            </div>
            <div className="p-5">
              {contract.contractFileUrl.match(/\.(pdf)$/i) ? (
                <iframe
                  src={contract.contractFileUrl}
                  className="w-full h-[600px] rounded-lg border border-afrocat-border"
                  title="Contract Document"
                  data-testid="iframe-contract-pdf"
                />
              ) : contract.contractFileUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                <img
                  src={contract.contractFileUrl}
                  alt="Contract Document"
                  className="max-w-full rounded-lg border border-afrocat-border"
                  data-testid="img-contract-document"
                />
              ) : (
                <a
                  href={contract.contractFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-teal-soft text-afrocat-teal font-semibold text-sm hover:bg-afrocat-teal/20 transition-colors"
                  data-testid="link-contract-download"
                >
                  <FileText className="w-4 h-4" /> View / Download Contract Document
                </a>
              )}
            </div>
          </div>
        )}

        <div className="afrocat-card overflow-hidden" data-testid="card-contract-details">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
              <Calendar className="w-5 h-5 text-afrocat-teal" /> Contract Details
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DetailField label="Player" value={player ? `${player.firstName} ${player.lastName}` : "—"} testId="text-player-name" />
              <DetailField label="Contract Type" value={contract.contractType} testId="text-contract-type" />
              <DetailField label="Status" value={contract.status} testId="text-contract-status" />
              <DetailField label="Start Date" value={contract.startDate} testId="text-start-date" />
              <DetailField label="End Date" value={contract.endDate} testId="text-end-date" />
              <DetailField label="Currency" value={contract.currency || "NAD"} testId="text-currency" />
            </div>
          </div>
        </div>

        <div className="afrocat-card overflow-hidden" data-testid="card-financial-terms">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
              <DollarSign className="w-5 h-5 text-afrocat-gold" /> Financial Terms
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FinanceCard label="Sign-On Fee" value={contract.signOnFee} testId="text-sign-on-fee" />
              <FinanceCard label="Weekly Transport" value={contract.weeklyTransport} testId="text-weekly-transport" />
              <FinanceCard label="Salary" value={contract.salaryAmount} testId="text-salary" />
              <FinanceCard label="Release Fee" value={contract.releaseFee} testId="text-release-fee" />
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mb-1">Membership Fee</div>
                <div className="text-sm font-bold text-afrocat-text" data-testid="text-membership-fee">
                  {contract.membershipFeePaid || 0} / {contract.membershipFeeRequired || 0}
                </div>
                <div className="text-[10px] text-afrocat-muted">Paid / Required</div>
              </div>
              <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
                <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mb-1">Development Fee</div>
                <div className="text-sm font-bold text-afrocat-text" data-testid="text-development-fee">
                  {contract.developmentFeePaid || 0} / {contract.developmentFeeRequired || 0}
                </div>
                <div className="text-[10px] text-afrocat-muted">Paid / Required</div>
              </div>
            </div>
          </div>
        </div>

        {contract.obligations && (
          <div className="afrocat-card overflow-hidden" data-testid="card-obligations">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
                <Shield className="w-5 h-5 text-afrocat-teal" /> Obligations & Terms
              </h3>
            </div>
            <div className="p-5">
              <div className="text-sm text-afrocat-text whitespace-pre-wrap leading-relaxed" data-testid="text-obligations">
                {contract.obligations}
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="afrocat-card overflow-hidden" data-testid="card-issued-items">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
                  <Package className="w-5 h-5 text-afrocat-gold" /> Issued Attire & Items
                </h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-gold-soft text-afrocat-gold" data-testid="text-items-total">
                  Total: N${totalItemsValue.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-afrocat-muted uppercase bg-afrocat-white-5 border-b border-afrocat-border">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-3 py-3 text-center">Size</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-center">Date Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b border-afrocat-border hover:bg-afrocat-white-3" data-testid={`row-item-${item.id}`}>
                      <td className="px-4 py-3 font-medium text-afrocat-text">{item.itemName}</td>
                      <td className="px-3 py-3 text-center text-afrocat-text">{item.size || "—"}</td>
                      <td className="px-3 py-3 text-center text-afrocat-text">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-afrocat-text">N${(item.unitValue || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-afrocat-gold">N${(item.totalValue || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-afrocat-muted">{item.dateIssued}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {transport.length > 0 && (
          <div className="afrocat-card overflow-hidden" data-testid="card-transport">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
                  <Truck className="w-5 h-5 text-afrocat-teal" /> Transport Benefits
                </h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-teal-soft text-afrocat-teal" data-testid="text-transport-total">
                  Total: N${totalTransportValue.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {transport.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`row-transport-${t.id}`}>
                  <div>
                    <p className="font-medium text-sm text-afrocat-text">{t.benefitType?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-afrocat-muted">{t.dateFrom}{t.dateTo ? ` — ${t.dateTo}` : ""} • {t.frequency}</p>
                  </div>
                  <span className="font-bold text-afrocat-teal">N${(t.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {contributions.length > 0 && (
          <div className="afrocat-card overflow-hidden" data-testid="card-contributions">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
                  <DollarSign className="w-5 h-5 text-afrocat-gold" /> Contributions
                </h3>
                <div className="flex gap-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-green-soft text-afrocat-green" data-testid="text-contrib-paid">
                    Paid: N${totalContribPaid.toFixed(2)}
                  </span>
                  {totalContribDue > 0 && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-red-soft text-afrocat-red" data-testid="text-contrib-due">
                      Due: N${totalContribDue.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {contributions.map((c: any) => {
                const stColor = c.status === "PAID" ? "bg-afrocat-green-soft text-afrocat-green" : c.status === "PARTIAL" ? "bg-afrocat-gold-soft text-afrocat-gold" : "bg-afrocat-red-soft text-afrocat-red";
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border" data-testid={`row-contrib-${c.id}`}>
                    <div>
                      <p className="font-medium text-sm text-afrocat-text">{CONTRIBUTION_TYPE_LABELS[c.contributionType] || c.contributionType}</p>
                      {c.description && <p className="text-xs text-afrocat-muted mt-0.5">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-afrocat-text">N${(c.amount || 0).toFixed(2)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stColor}`}>{c.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function DetailField({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border">
      <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold text-afrocat-text" data-testid={testId}>{value || "—"}</div>
    </div>
  );
}

function FinanceCard({ label, value, testId }: { label: string; value: number | null | undefined; testId: string }) {
  return (
    <div className="p-3 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
      <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold font-display text-afrocat-gold" data-testid={testId}>
        {value != null ? `N$${value.toFixed(2)}` : "—"}
      </div>
    </div>
  );
}
