import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { FileText, Download, Plus, Filter, Users, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/afrocate_logo_1772226294597.png";
import { AFROCAT_LOGO_BASE64 } from "@/lib/logo-base64";

const docTypeLabels: Record<string, string> = {
  O2BIS: "O-2 Bis Form",
  TEAM_LIST: "Team List",
  MATCH_REPORT: "Match Report",
  REFEREE_FORM: "Referee Form",
  SCOUTING_FORM: "Scouting Form",
};

export default function Documents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "COACH";

  const [filterTeamId, setFilterTeamId] = useState<string>("");
  const [showO2bis, setShowO2bis] = useState(false);
  const [showTeamList, setShowTeamList] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.getTeams });
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: api.getMatches });
  const { data: documents = [] } = useQuery({
    queryKey: ["match-documents", filterTeamId],
    queryFn: () => api.getMatchDocuments(undefined, filterTeamId || undefined),
  });

  const [o2bisForm, setO2bisForm] = useState({
    teamId: "", matchId: "", opponent: "", matchDate: "", matchTime: "", venue: "", competition: "", coachName: "",
  });

  const [teamListForm, setTeamListForm] = useState({
    teamId: "", competition: "", season: new Date().getFullYear().toString(),
  });

  const generateO2bisMut = useMutation({
    mutationFn: api.generateO2bis,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["match-documents"] });
      setShowO2bis(false);
      toast({ title: "O-2 Bis Generated!", description: "Form is ready to view and print." });
      if (data?.data) {
        const w = window.open("", "_blank");
        if (w) { w.document.write(generateO2bisHTML(data.data)); w.document.close(); }
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateTeamListMut = useMutation({
    mutationFn: api.generateTeamList,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["match-documents"] });
      setShowTeamList(false);
      toast({ title: "Team List Generated!", description: "Document ready." });
      if (data?.data) {
        const w = window.open("", "_blank");
        if (w) { w.document.write(generateTeamListHTML(data.data)); w.document.close(); }
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleMatchSelect = (matchId: string) => {
    const match = matches.find((m: any) => m.id === matchId);
    if (match) {
      setO2bisForm(f => ({
        ...f, matchId, teamId: match.teamId, opponent: match.opponent,
        matchDate: match.matchDate, venue: match.venue, competition: match.competition,
      }));
    }
  };

  const o2bisDocs = documents.filter((d: any) => d.documentType === "O2BIS");
  const teamListDocs = documents.filter((d: any) => d.documentType === "TEAM_LIST");
  const otherDocs = documents.filter((d: any) => !["O2BIS", "TEAM_LIST"].includes(d.documentType));

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Afrocat Logo" className="w-14 h-14 object-contain" data-testid="img-afrocat-logo" />
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-page-title">
                Document Center
              </h1>
              <p className="text-sm text-afrocat-muted italic mt-0.5">
                NVF O-2 Bis forms, team lists & official documents
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => { setShowO2bis(!showO2bis); setShowTeamList(false); }}
                  className="bg-afrocat-teal hover:bg-afrocat-teal/80"
                  size="sm"
                  data-testid="button-generate-o2bis"
                >
                  <Plus className="w-4 h-4 mr-1" /> O-2 Bis
                </Button>
                <Button
                  onClick={() => { setShowTeamList(!showTeamList); setShowO2bis(false); }}
                  variant="outline"
                  size="sm"
                  className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5"
                  data-testid="button-generate-team-list"
                >
                  <Users className="w-4 h-4 mr-1" /> Team List
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Filter size={16} className="text-afrocat-muted" />
          <Select value={filterTeamId} onValueChange={setFilterTeamId}>
            <SelectTrigger className="w-[220px] bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-filter-team">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {showO2bis && isAdmin && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-teal-soft border-b border-afrocat-teal/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-teal">
                <FileText className="h-5 w-5" /> Generate NVF O-2 Bis Form
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Pre-fill from match (optional)</label>
                <Select onValueChange={handleMatchSelect}>
                  <SelectTrigger className="bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-o2bis-match">
                    <SelectValue placeholder="Select match to pre-fill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((m: any) => {
                      const team = teams.find((t: any) => t.id === m.teamId);
                      return <SelectItem key={m.id} value={m.id}>{m.matchDate} — {team?.name} vs {m.opponent}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Team *</label>
                  <Select value={o2bisForm.teamId} onValueChange={v => setO2bisForm(f => ({ ...f, teamId: v }))}>
                    <SelectTrigger className="bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-o2bis-team">
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Opponent *</label>
                  <input value={o2bisForm.opponent} onChange={e => setO2bisForm(f => ({ ...f, opponent: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-opponent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Date *</label>
                  <input type="date" value={o2bisForm.matchDate} onChange={e => setO2bisForm(f => ({ ...f, matchDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-date" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Time</label>
                  <input type="time" value={o2bisForm.matchTime} onChange={e => setO2bisForm(f => ({ ...f, matchTime: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-time" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Venue *</label>
                  <input value={o2bisForm.venue} onChange={e => setO2bisForm(f => ({ ...f, venue: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-venue" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Competition *</label>
                  <input value={o2bisForm.competition} onChange={e => setO2bisForm(f => ({ ...f, competition: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-competition" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Coach</label>
                  <input value={o2bisForm.coachName} onChange={e => setO2bisForm(f => ({ ...f, coachName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-o2bis-coach" />
                </div>
              </div>
              <Button
                onClick={() => generateO2bisMut.mutate({
                  teamId: o2bisForm.teamId, matchId: o2bisForm.matchId || null,
                  opponent: o2bisForm.opponent, matchDate: o2bisForm.matchDate,
                  matchTime: o2bisForm.matchTime || undefined, venue: o2bisForm.venue,
                  competition: o2bisForm.competition, coachName: o2bisForm.coachName || undefined,
                })}
                disabled={!o2bisForm.teamId || !o2bisForm.opponent || !o2bisForm.matchDate || !o2bisForm.venue || !o2bisForm.competition || generateO2bisMut.isPending}
                className="bg-afrocat-teal hover:bg-afrocat-teal/80"
                data-testid="button-submit-o2bis"
              >
                {generateO2bisMut.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : "Generate O-2 Bis"}
              </Button>
            </div>
          </div>
        )}

        {showTeamList && isAdmin && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-gold-soft border-b border-afrocat-gold/20 px-5 py-3 rounded-t-[18px]">
              <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-gold">
                <Users className="h-5 w-5" /> Generate Team List
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Team *</label>
                  <Select value={teamListForm.teamId} onValueChange={v => setTeamListForm(f => ({ ...f, teamId: v }))}>
                    <SelectTrigger className="bg-afrocat-card border-afrocat-border text-afrocat-text" data-testid="select-teamlist-team">
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Competition</label>
                  <input value={teamListForm.competition} onChange={e => setTeamListForm(f => ({ ...f, competition: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-teamlist-competition" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Season</label>
                  <input value={teamListForm.season} onChange={e => setTeamListForm(f => ({ ...f, season: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-teamlist-season" />
                </div>
              </div>
              <Button
                onClick={() => generateTeamListMut.mutate(teamListForm)}
                disabled={!teamListForm.teamId || generateTeamListMut.isPending}
                className="bg-afrocat-gold hover:bg-afrocat-gold/80 text-black"
                data-testid="button-submit-teamlist"
              >
                {generateTeamListMut.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : "Generate Team List"}
              </Button>
            </div>
          </div>
        )}

        {documents.length === 0 && (
          <div className="afrocat-card">
            <div className="py-16 text-center text-afrocat-muted">
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No documents yet</p>
              <p className="text-sm mt-1">Generate an O-2 Bis form or Team List to get started</p>
            </div>
          </div>
        )}

        {o2bisDocs.length > 0 && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <h3 className="text-base font-display font-bold text-afrocat-text flex items-center gap-2">
                <FileText className="h-5 w-5 text-afrocat-teal" /> O-2 Bis Forms ({o2bisDocs.length})
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {o2bisDocs.map((doc: any) => (
                <DocumentCard key={doc.id} doc={doc} teams={teams} matches={matches} />
              ))}
            </div>
          </div>
        )}

        {teamListDocs.length > 0 && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <h3 className="text-base font-display font-bold text-afrocat-text flex items-center gap-2">
                <Users className="h-5 w-5 text-afrocat-gold" /> Team Lists ({teamListDocs.length})
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {teamListDocs.map((doc: any) => (
                <DocumentCard key={doc.id} doc={doc} teams={teams} matches={matches} />
              ))}
            </div>
          </div>
        )}

        {otherDocs.length > 0 && (
          <div className="afrocat-card overflow-hidden">
            <div className="bg-afrocat-white-5 border-b border-afrocat-border px-5 py-3 rounded-t-[18px]">
              <h3 className="text-base font-display font-bold text-afrocat-text">Other Documents ({otherDocs.length})</h3>
            </div>
            <div className="p-4 space-y-3">
              {otherDocs.map((doc: any) => (
                <DocumentCard key={doc.id} doc={doc} teams={teams} matches={matches} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function DocumentCard({ doc, teams, matches }: { doc: any; teams: any[]; matches: any[] }) {
  const meta = doc.metadata as any;
  const team = teams.find((t: any) => t.id === doc.teamId);
  const match = matches.find((m: any) => m.id === doc.matchId);

  const openDoc = () => {
    const w = window.open("", "_blank");
    if (!w || !meta) return;
    if (doc.documentType === "O2BIS") {
      w.document.write(generateO2bisHTML(meta));
    } else if (doc.documentType === "TEAM_LIST") {
      w.document.write(generateTeamListHTML(meta));
    } else {
      w.document.write(`<pre>${JSON.stringify(meta, null, 2)}</pre>`);
    }
    w.document.close();
  };

  return (
    <div className="flex items-center justify-between p-4 bg-afrocat-white-3 rounded-lg border border-afrocat-border hover:bg-afrocat-white-5 transition-colors" data-testid={`card-document-${doc.id}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.documentType === "O2BIS" ? "bg-afrocat-teal-soft" : doc.documentType === "TEAM_LIST" ? "bg-afrocat-gold-soft" : "bg-afrocat-white-10"}`}>
          {doc.documentType === "TEAM_LIST" ? <Users size={20} className="text-afrocat-gold" /> : <FileText size={20} className="text-afrocat-teal" />}
        </div>
        <div>
          <h4 className="font-semibold text-sm text-afrocat-text" data-testid={`text-doc-title-${doc.id}`}>
            {docTypeLabels[doc.documentType] || doc.documentType}
          </h4>
          <p className="text-xs text-afrocat-muted">
            {team?.name || "Unknown"} {meta?.opponent ? `vs ${meta.opponent}` : ""} {meta?.matchDate ? `• ${meta.matchDate}` : ""}
            {doc.createdAt && ` • ${new Date(doc.createdAt).toLocaleDateString()}`}
          </p>
          {meta?.competition && <p className="text-xs text-afrocat-muted">{meta.competition}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {meta?.players && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-afrocat-teal-soft text-afrocat-teal">{meta.players.length} players</span>
        )}
        <Button variant="outline" size="sm" onClick={openDoc} className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5" data-testid={`button-view-${doc.id}`}>
          <Download size={14} className="mr-1" /> View / Print
        </Button>
      </div>
    </div>
  );
}

function generateO2bisHTML(data: any): string {
  const playersRows = (data.players || []).map((p: any, i: number) =>
    `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center;font-weight:bold">${p.jerseyNo || ""}</td>
      <td>${p.name}${p.isCaptain ? ' <span style="color:#c9a84c;font-weight:bold">(C)</span>' : ""}</td>
      <td style="text-align:center">${p.dob || ""}</td>
      <td style="text-align:center">${p.age || ""}</td>
      <td style="text-align:center">${p.country || "NAM"}</td>
      <td style="text-align:center">${p.gender || ""}</td>
      <td style="text-align:center">${p.position || ""}</td>
      <td></td>
    </tr>`
  ).join("");

  const officialsRows = (data.officials || []).map((o: any) =>
    `<tr>
      <td>${o.role?.replace(/_/g, " ") || ""}</td>
      <td>${o.name || ""}</td>
      <td></td>
      <td></td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>O-2 Bis - ${data.teamName || "Afrocat"}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #000; font-size: 11px; }
  .header { text-align: center; margin-bottom: 15px; }
  .header img.logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; }
  .header h1 { font-size: 16px; letter-spacing: 3px; margin-bottom: 2px; color: #0d6e6e; }
  .header h2 { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
  .header .subtitle { font-size: 10px; color: #666; letter-spacing: 1px; }
  .header .nvf-title { font-size: 14px; font-weight: bold; margin-top: 10px; border: 2px solid #000; display: inline-block; padding: 4px 20px; }
  .match-info { border: 1px solid #999; margin: 15px 0; }
  .match-info td { padding: 4px 8px; border: 1px solid #ccc; font-size: 11px; }
  .match-info .label { font-weight: bold; background: #f0f0f0; width: 120px; }
  table.players { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  table.players th { background: #0d6e6e; color: white; padding: 5px 4px; border: 1px solid #333; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
  table.players td { border: 1px solid #999; padding: 4px; }
  table.players tr:nth-child(even) { background: #f8f8f8; }
  .section-title { font-size: 12px; font-weight: bold; margin: 15px 0 5px; color: #0d6e6e; border-bottom: 2px solid #0d6e6e; padding-bottom: 3px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 30px; font-size: 10px; }
  .sig-block { border-top: 1px solid #333; padding-top: 5px; text-align: center; }
  .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { margin: 0; padding: 10px; } }
</style></head><body>
<div class="header">
  <img src="${AFROCAT_LOGO_BASE64}" alt="Afrocat Logo" class="logo" />
  <h1>AFROCAT VOLLEYBALL CLUB</h1>
  <div class="subtitle">One Team One Dream &mdash; Passion Discipline Victory</div>
  <div class="nvf-title">O-2 Bis &mdash; OFFICIAL TEAM COMPOSITION FORM</div>
</div>

<table class="match-info" style="width:100%;border-collapse:collapse">
  <tr>
    <td class="label">Association / Club:</td><td>${data.teamName || "Afrocat Volleyball Club"}</td>
    <td class="label">Opponent:</td><td>${data.opponent || ""}</td>
  </tr>
  <tr>
    <td class="label">Date:</td><td>${data.matchDate || ""} ${data.matchTime || ""}</td>
    <td class="label">Venue:</td><td>${data.venue || ""}</td>
  </tr>
  <tr>
    <td class="label">Competition:</td><td>${data.competition || ""}</td>
    <td class="label">Head Coach:</td><td>${data.coachName || ""}</td>
  </tr>
</table>

<div class="section-title">PLAYERS</div>
<table class="players">
  <thead><tr>
    <th style="width:30px">#</th>
    <th style="width:50px">Jersey No.</th>
    <th>Full Name</th>
    <th style="width:75px">Date of Birth</th>
    <th style="width:35px">Age</th>
    <th style="width:45px">Country</th>
    <th style="width:35px">M/F</th>
    <th style="width:60px">Position</th>
    <th style="width:80px">Signature</th>
  </tr></thead>
  <tbody>${playersRows || '<tr><td colspan="9" style="text-align:center;padding:10px">No players registered</td></tr>'}</tbody>
</table>

<div class="section-title">TEAM OFFICIALS</div>
<table class="players">
  <thead><tr><th>Role</th><th>Full Name</th><th style="width:80px">Licence No.</th><th style="width:80px">Signature</th></tr></thead>
  <tbody>${officialsRows || '<tr><td colspan="4" style="text-align:center;padding:10px">No officials listed</td></tr>'}</tbody>
</table>

<div class="signatures">
  <div class="sig-block">Team Captain<br/><br/>Sign: _______________<br/>Date: _______________</div>
  <div class="sig-block">Head Coach<br/><br/>Sign: _______________<br/>Date: _______________</div>
  <div class="sig-block">Match Commissioner<br/><br/>Sign: _______________<br/>Date: _______________</div>
</div>

<div class="footer">
  AFROCAT VOLLEYBALL CLUB &mdash; One Team One Dream &mdash; Passion Discipline Victory<br/>
  Generated: ${new Date().toLocaleString()} | NVF O-2 Bis Official Format
</div>
</body></html>`;
}

function generateTeamListHTML(data: any): string {
  const playersRows = (data.players || []).map((p: any, i: number) =>
    `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center;font-weight:bold">${p.jerseyNo || ""}</td>
      <td>${p.name}${p.isCaptain ? ' <span style="color:#c9a84c;font-weight:bold">(C)</span>' : ""}</td>
      <td style="text-align:center">${p.position || ""}</td>
      <td style="text-align:center">${p.dob || ""}</td>
      <td style="text-align:center">${p.age || ""}</td>
      <td style="text-align:center">${p.country || "NAM"}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>Team List - ${data.teamName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #000; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #0d6e6e; padding-bottom: 15px; }
  .header img.logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; }
  .header h1 { font-size: 18px; letter-spacing: 3px; color: #0d6e6e; }
  .header h2 { font-size: 14px; margin-top: 5px; }
  .header .subtitle { font-size: 10px; color: #666; letter-spacing: 1px; margin-top: 3px; }
  .info { font-size: 12px; margin-bottom: 15px; }
  .info div { margin: 3px 0; }
  .info strong { display: inline-block; min-width: 120px; color: #0d6e6e; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
  th { background: #0d6e6e; color: white; padding: 6px; border: 1px solid #333; text-transform: uppercase; font-size: 10px; }
  td { border: 1px solid #999; padding: 5px 6px; }
  tr:nth-child(even) { background: #f8f8f8; }
  .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
  @media print { body { margin: 0; padding: 10px; } }
</style></head><body>
<div class="header">
  <img src="${AFROCAT_LOGO_BASE64}" alt="Afrocat Logo" class="logo" />
  <h1>AFROCAT VOLLEYBALL CLUB</h1>
  <div class="subtitle">One Team One Dream &mdash; Passion Discipline Victory</div>
  <h2>OFFICIAL TEAM LIST</h2>
</div>
<div class="info">
  <div><strong>Team:</strong> ${data.teamName || ""}</div>
  <div><strong>Competition:</strong> ${data.competition || "N/A"}</div>
  <div><strong>Season:</strong> ${data.season || new Date().getFullYear()}</div>
  <div><strong>Total Players:</strong> ${data.players?.length || 0}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Jersey</th><th>Full Name</th><th>Position</th><th>DOB</th><th>Age</th><th>Country</th></tr></thead>
  <tbody>${playersRows}</tbody>
</table>
<div class="footer">
  AFROCAT VOLLEYBALL CLUB &mdash; One Team One Dream<br/>
  Generated: ${new Date().toLocaleString()}
</div>
</body></html>`;
}
