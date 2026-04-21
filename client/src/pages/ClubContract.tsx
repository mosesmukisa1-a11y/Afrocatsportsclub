import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  ScrollText, CheckCircle, AlertTriangle, Loader2, FileText,
  Shield, UserCheck, Baby, Download, Users, Zap, XCircle,
  Printer, ExternalLink, BookOpen, LayoutList
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

  const isAdmin = user?.role === "ADMIN";

  const { data: adminSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["/api/contract/admin/summary"],
    queryFn: api.getClubContractAdminSummary,
    enabled: isAdmin,
  });

  const bulkSignMut = useMutation({
    mutationFn: api.bulkAutoSignContract,
    onSuccess: (data) => {
      toast({ title: `Bulk sign complete`, description: `${data.signed} member(s) marked as signed.` });
      qc.invalidateQueries({ queryKey: ["/api/contract/admin/summary"] });
      refetchSummary();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [showUnsigned, setShowUnsigned] = useState(false);
  const [pdfView, setPdfView] = useState(false);

  const HANDBOOK_PDF_URL = "/afrocat-handbook-2026-2027.pdf";

  const handlePrint = () => {
    const win = window.open(HANDBOOK_PDF_URL, "_blank");
    if (win) setTimeout(() => win.print(), 800);
  };

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
                Player & Club Handbook 2026-2027
              </h1>
              <p className="text-sm text-afrocat-muted italic mt-0.5">
                Afrocat Sports Club — Official Member Handbook & Acknowledgment
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

        {isAdmin && adminSummary && (
          <div className="afrocat-card overflow-hidden" data-testid="card-admin-summary">
            <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px] flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold">
                <Users className="w-5 h-5" /> Admin — Contract Overview
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-afrocat-muted">
                  <span className="text-afrocat-green font-bold">{adminSummary.accepted}</span>/{adminSummary.totalActive} signed
                </span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-afrocat-green-soft text-center">
                  <div className="text-2xl font-bold text-afrocat-green" data-testid="text-admin-signed">{adminSummary.accepted}</div>
                  <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mt-1">Signed</div>
                </div>
                <div className="p-3 rounded-xl bg-afrocat-red-soft text-center">
                  <div className="text-2xl font-bold text-afrocat-red" data-testid="text-admin-unsigned">{adminSummary.notAccepted}</div>
                  <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mt-1">Not Signed</div>
                </div>
                <div className="p-3 rounded-xl bg-afrocat-white-3 text-center">
                  <div className="text-2xl font-bold text-afrocat-text" data-testid="text-admin-total">{adminSummary.totalActive}</div>
                  <div className="text-[10px] text-afrocat-muted uppercase tracking-wider mt-1">Total Active</div>
                </div>
              </div>

              {adminSummary.notAccepted > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      className="text-xs text-afrocat-muted hover:text-afrocat-text flex items-center gap-1"
                      onClick={() => setShowUnsigned(v => !v)}
                      data-testid="button-toggle-unsigned"
                    >
                      <XCircle className="w-3.5 h-3.5 text-afrocat-red" />
                      {showUnsigned ? "Hide" : "Show"} {adminSummary.notAccepted} unsigned member(s)
                    </button>
                  </div>
                  {showUnsigned && (
                    <div className="rounded-xl border border-afrocat-border divide-y divide-afrocat-border max-h-48 overflow-y-auto">
                      {(adminSummary.notAcceptedUsers || []).map((u: any) => (
                        <div key={u.id} className="px-3 py-2 flex items-center justify-between" data-testid={`row-unsigned-${u.id}`}>
                          <div>
                            <p className="text-sm font-medium text-afrocat-text">{u.fullName}</p>
                            <p className="text-[10px] text-afrocat-muted">{u.email} · {u.role}</p>
                          </div>
                          <XCircle className="w-4 h-4 text-afrocat-red opacity-60" />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      if (window.confirm(`This will mark the contract as accepted on behalf of all ${adminSummary.notAccepted} unsigned active member(s). Continue?`)) {
                        bulkSignMut.mutate();
                      }
                    }}
                    disabled={bulkSignMut.isPending}
                    className="w-full bg-afrocat-gold hover:bg-afrocat-gold/80 text-afrocat-bg font-bold"
                    data-testid="button-bulk-sign"
                  >
                    {bulkSignMut.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing all members...</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" /> Auto-Sign All {adminSummary.notAccepted} Unsigned Member(s)</>
                    )}
                  </Button>
                  <p className="text-[10px] text-afrocat-muted text-center">
                    Records the contract as accepted on behalf of all existing members who haven't yet signed.
                  </p>
                </div>
              )}

              {adminSummary.notAccepted === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-afrocat-green-soft">
                  <CheckCircle className="w-4 h-4 text-afrocat-green" />
                  <p className="text-sm text-afrocat-green font-medium">All active members have signed the contract.</p>
                </div>
              )}
            </div>
          </div>
        )}

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
          <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px] flex items-center justify-between flex-wrap gap-3">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal">
              <FileText className="w-5 h-5" /> Afrocat SC Player &amp; Club Handbook 2026-2027
            </h3>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-afrocat-teal/30 overflow-hidden text-xs">
                <button
                  onClick={() => setPdfView(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition-all cursor-pointer ${!pdfView ? "bg-afrocat-teal text-white" : "bg-transparent text-afrocat-muted hover:text-afrocat-teal"}`}
                  data-testid="button-view-inline"
                >
                  <LayoutList className="w-3 h-3" /> Handbook
                </button>
                <button
                  onClick={() => setPdfView(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-bold transition-all cursor-pointer ${pdfView ? "bg-afrocat-teal text-white" : "bg-transparent text-afrocat-muted hover:text-afrocat-teal"}`}
                  data-testid="button-view-pdf"
                >
                  <BookOpen className="w-3 h-3" /> PDF View
                </button>
              </div>
              {/* PDF actions */}
              <a
                href={HANDBOOK_PDF_URL}
                download="Afrocat-Handbook-2026-2027.pdf"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-teal/10 hover:bg-afrocat-teal/20 border border-afrocat-teal/20 text-afrocat-teal text-xs font-bold transition-all"
                data-testid="link-download-handbook-pdf"
              >
                <Download className="w-3 h-3" /> Download PDF
              </a>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afrocat-white-5 hover:bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted hover:text-afrocat-text text-xs font-bold transition-all cursor-pointer"
                data-testid="button-print-handbook"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>
          </div>
          <div className="p-5">
            {/* PDF Embed View */}
            {pdfView && (
              <div className="rounded-lg overflow-hidden border border-afrocat-border" data-testid="handbook-pdf-embed">
                <iframe
                  src={`${HANDBOOK_PDF_URL}#toolbar=1&navpanes=1&scrollbar=1`}
                  className="w-full"
                  style={{ height: "70vh", minHeight: 480 }}
                  title="Afrocat SC Player & Club Handbook 2026-2027"
                />
              </div>
            )}
            {/* Inline Content View */}
            {!pdfView && (
            <>
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-afrocat-border bg-afrocat-white-3 p-6 space-y-6 text-sm text-afrocat-text" data-testid="handbook-content">

              <div className="text-center space-y-1 pb-4 border-b border-afrocat-border">
                <p className="text-xs text-afrocat-muted uppercase tracking-widest">Windhoek, Namibia</p>
                <h2 className="text-lg font-display font-bold text-afrocat-teal">AFROCAT SC PLAYER & CLUB HANDBOOK 2026</h2>
                <p className="text-xs text-afrocat-muted italic">This handbook outlines the mission, values, policies, training structure, and expectations of Afrocat Sports Club as we build disciplined athletes and a positive volleyball culture.</p>
                <p className="text-xs font-bold text-afrocat-gold tracking-wider">ONE TEAM. ONE DREAM</p>
              </div>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Introduction</h3>
                <p className="text-afrocat-muted leading-relaxed">The Afrocat Sports Club (Afrocat SC) Volleyball Manual outlines the club's mission, values, policies, training structure, and expectations for players, coaches, parents, and officials. This document ensures consistency, professionalism, and a positive culture as our club grows locally and nationally.</p>
                <p className="text-xs text-afrocat-gold italic mt-2">Club Principle: A will to train is a will to play.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Vision & Mission</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border">
                    <p className="font-bold text-afrocat-text text-xs mb-1">VISION</p>
                    <p className="text-afrocat-muted leading-relaxed">To be a leading volleyball club that develops disciplined, skilled athletes while promoting teamwork, sportsmanship, and community engagement.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border">
                    <p className="font-bold text-afrocat-text text-xs mb-1">MISSION</p>
                    <p className="text-afrocat-muted leading-relaxed">To provide structured, high-quality volleyball training and competition opportunities for players of all ages and levels; fostering personal development, competitive excellence, and love for the sport.</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Club Values</h3>
                <div className="space-y-2">
                  {[
                    { v: "Respect", d: "For self, teammates, opponents, and officials." },
                    { v: "Integrity", d: "Honesty and accountability in all actions." },
                    { v: "Teamwork", d: "Collective effort always outweighs individual contributions." },
                    { v: "Discipline", d: "Consistent commitment to training, behavior, and club standards." },
                    { v: "Growth Mindset", d: "A learning-focused attitude on and off the court." },
                  ].map(({ v, d }) => (
                    <div key={v} className="flex gap-3 p-2 rounded-lg bg-afrocat-white-5">
                      <span className="font-bold text-afrocat-teal w-32 shrink-0">{v}</span>
                      <span className="text-afrocat-muted">{d}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Governance & Structure</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-afrocat-text mb-2 text-xs uppercase tracking-wider">Club Management</p>
                    <ul className="space-y-1 text-afrocat-muted">
                      {["Club Chairperson", "Development Director & Operations", "Technical Director", "Head Coach (Volleyball)", "Coaching Staff", "Team Managers", "Medical & Support Staff", "Volunteers & Admin"].map(r => (
                        <li key={r} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-afrocat-teal shrink-0" />{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-afrocat-text mb-2 text-xs uppercase tracking-wider">Committees</p>
                    <ul className="space-y-1 text-afrocat-muted">
                      {["Technical Committee", "Marketing Committee", "Events & Fundraising Committee"].map(r => (
                        <li key={r} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-afrocat-gold shrink-0" />{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Membership</h3>
                <p className="text-afrocat-muted leading-relaxed mb-2">Players must submit registration forms, medical consent, pay membership fees, and agree to the Athlete Code of Conduct.</p>
                <p className="text-afrocat-muted leading-relaxed mb-2"><span className="font-semibold text-afrocat-text">Fees:</span> Category 1 — Working Class. Category 2 — Non-working Class. Membership fee must be settled before the end of the season.</p>
                <p className="text-afrocat-muted leading-relaxed"><span className="font-semibold text-afrocat-text">Parents/Guardians</span> are expected to support positive behavior, attend orientation sessions, and respect all club stakeholders. Parents must sign membership forms and consent letters for athletes under 18.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Training & Curriculum</h3>
                <p className="text-xs text-afrocat-muted mb-2 font-semibold">Training Categories: Youth U10/U13/U15/U17 · Development/Beginner · Intermediate · Competitive/Elite · Select/National Pathway</p>
                <div className="rounded-lg overflow-hidden border border-afrocat-border">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-afrocat-white-5"><th className="text-left px-3 py-2 font-semibold text-afrocat-text">Programme</th><th className="text-left px-3 py-2 font-semibold text-afrocat-text">Days</th><th className="text-left px-3 py-2 font-semibold text-afrocat-text">Time</th></tr></thead>
                    <tbody className="divide-y divide-afrocat-border">
                      {[
                        ["School Team", "Tuesday & Thursday", "14h00–16h00"],
                        ["ASC Academy", "Wednesday & Friday", "14h00–16h00"],
                        ["Female Senior", "Monday & Wednesday", "16h00–19h30"],
                        ["Male Senior", "Tuesday & Thursday", "16h00–19h30"],
                        ["Combined Training", "Friday & Sunday", "16h00–19h30"],
                        ["National League Teams", "Saturday", "Time slot allocation"],
                      ].map(([p, d, t]) => (
                        <tr key={p}><td className="px-3 py-2 text-afrocat-text">{p}</td><td className="px-3 py-2 text-afrocat-muted">{d}</td><td className="px-3 py-2 text-afrocat-muted">{t}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-afrocat-muted mt-2 italic">Technical Focus: 5 stages of ASC development pathway — Serve & receive, passing, setting, attacking, blocking, defense, transitions, team systems.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Competition & Scheduling</h3>
                <p className="text-afrocat-muted leading-relaxed">Players must attend matches on time, wear the club uniform, and demonstrate sportsmanship at all times during travel, warm-up, matches, and post-match interactions.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Club Standards & Expectations</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { title: "Dress Code", items: ["Official Afrocat SC kit required", "Proper volleyball gear mandatory", "No jewelry", "Clean and appropriate clothing"] },
                    { title: "Punctuality", items: ["Arrive 10 minutes early", "Players are accountable for behavior, equipment, and commitment"] },
                    { title: "Communication", items: ["Email & WhatsApp are official platforms", "Volleyball-related content only", "Respectful language required"] },
                    { title: "Practice Attendance", items: ["Attendance is compulsory", "Absences must be communicated in advance", "A will to train is a will to play"] },
                  ].map(({ title, items }) => (
                    <div key={title} className="p-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border">
                      <p className="font-bold text-afrocat-text text-xs mb-2 uppercase tracking-wider">{title}</p>
                      <ul className="space-y-1">{items.map(i => <li key={i} className="text-afrocat-muted flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-afrocat-teal shrink-0" />{i}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Safety & Welfare / Equipment & Uniform</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <p className="text-afrocat-muted leading-relaxed p-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border">Emergency contacts are required for all players. Medical forms must be updated annually, and child safeguarding practices must be enforced throughout all club activities.</p>
                  <p className="text-afrocat-muted leading-relaxed p-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border">Club uniform is mandatory. Equipment provided by the club must be used responsibly, stored properly, and maintained with care.</p>
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Communication Protocols</h3>
                <p className="text-afrocat-muted leading-relaxed">Official notices are shared via email and WhatsApp. Training schedules, updates, and announcements may be shared daily or weekly, depending on club activity.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Discipline & Grievance Procedures</h3>
                <p className="text-afrocat-muted leading-relaxed">Reports should be submitted within 48 hours of an incident. Appeals are allowed through the appropriate club leadership structures.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Performance Evaluation</h3>
                <p className="text-afrocat-muted leading-relaxed">The club will conduct annual evaluations of players, coaches, and programmes in order to improve standards, support development, and strengthen performance culture. All members must create their profile in the Afrocat SC portal.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-3">Development Pathways</h3>
                <p className="text-afrocat-muted leading-relaxed mb-2">Players are given opportunities to progress into elite teams, attend training camps, and pursue national selection. Members should understand the ASC development pathway and the seasonal training calendar.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {["Youth", "Beginner", "Intermediate", "Competitive / Elite", "National Pathway"].map((s, i, arr) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-afrocat-teal-soft text-afrocat-teal text-xs font-semibold">{s}</span>
                      {i < arr.length - 1 && <span className="text-afrocat-muted">→</span>}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Volunteer & Staff Development</h3>
                <p className="text-afrocat-muted leading-relaxed">Ongoing training, learning opportunities, and certification are encouraged for coaches, staff, volunteers, and all personnel serving the club.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Sponsorship & Community Relations</h3>
                <p className="text-afrocat-muted leading-relaxed">Afrocat Sports Club values ethical partnerships that support both the club and the wider community. Sponsorships should strengthen development, visibility, and positive social impact.</p>
              </section>

              <section>
                <h3 className="font-display font-bold text-afrocat-teal uppercase tracking-wider text-xs mb-2">Amendments</h3>
                <p className="text-afrocat-muted leading-relaxed">This manual will be reviewed periodically and updated where necessary to reflect the growth, direction, and operational needs of Afrocat Sports Club.</p>
              </section>

              <section className="border-t border-afrocat-border pt-4">
                <h3 className="font-display font-bold text-afrocat-gold uppercase tracking-wider text-xs mb-3">Acknowledgment</h3>
                <p className="text-afrocat-muted leading-relaxed font-semibold">All members are expected to read, sign, and comply with this manual.</p>
                <p className="text-xs text-afrocat-muted mt-2 italic">By confirming below, you acknowledge that you have read the Afrocat SC Player & Club Handbook 2026-2027 in its entirety and agree to abide by all policies, expectations, and standards contained herein.</p>
              </section>

            </div>
            <p className="text-xs text-afrocat-muted mt-3 text-center">
              Please read the entire handbook above before confirming below.
            </p>
            </>
            )}
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
                    ? "I, as the parent/guardian of this minor, confirm that I have read the Afrocat SC Player & Club Handbook 2026-2027 in full and agree to all policies, expectations, and standards on their behalf."
                    : "I have read the Afrocat SC Player & Club Handbook 2026-2027 in full and agree to abide by all policies, expectations, and standards contained herein."}
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