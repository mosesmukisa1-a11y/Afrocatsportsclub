import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { FileText, Download, Plus, Filter } from "lucide-react";

const docTypeLabels: Record<string, string> = {
  O2BIS: "O-2bis Form",
  MATCH_REPORT: "Match Report",
  REFEREE_FORM: "Referee Form",
  SCOUTING_FORM: "Scouting Form",
};

export default function Documents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "COACH";

  const [filterTeamId, setFilterTeamId] = useState<string>("");
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.getTeams });
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: api.getMatches });
  const { data: documents = [] } = useQuery({
    queryKey: ["match-documents", filterTeamId],
    queryFn: () => api.getMatchDocuments(undefined, filterTeamId || undefined),
  });

  const [o2bisForm, setO2bisForm] = useState({
    teamId: "", matchId: "", opponent: "", matchDate: "", matchTime: "", venue: "", competition: "", coachName: "",
  });

  const generateMut = useMutation({
    mutationFn: api.generateO2bis,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match-documents"] });
      setShowGenerate(false);
    },
  });

  const handleGenerate = () => {
    generateMut.mutate({
      teamId: o2bisForm.teamId,
      matchId: o2bisForm.matchId || null,
      opponent: o2bisForm.opponent,
      matchDate: o2bisForm.matchDate,
      matchTime: o2bisForm.matchTime || undefined,
      venue: o2bisForm.venue,
      competition: o2bisForm.competition,
      coachName: o2bisForm.coachName || undefined,
    });
  };

  const handleMatchSelect = (matchId: string) => {
    const match = matches.find((m: any) => m.id === matchId);
    if (match) {
      setO2bisForm(f => ({
        ...f,
        matchId,
        teamId: match.teamId,
        opponent: match.opponent,
        matchDate: match.matchDate,
        venue: match.venue,
        competition: match.competition,
      }));
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Document Center</h1>
            <p className="text-muted-foreground mt-1">O-2bis forms, match reports, and official documents</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowGenerate(!showGenerate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-generate-o2bis">
              <Plus size={18} /> Generate O-2bis
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Filter size={18} className="text-muted-foreground" />
          <select value={filterTeamId} onChange={e => setFilterTeamId(e.target.value)} className="px-3 py-2 border rounded-lg bg-background min-w-[200px]" data-testid="select-filter-team">
            <option value="">All Teams</option>
            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {showGenerate && isAdmin && (
          <div className="bg-card border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><FileText size={18} /> Generate O-2bis Form</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-4">
                <label className="text-sm text-muted-foreground mb-1 block">Pre-fill from existing match (optional)</label>
                <select onChange={e => handleMatchSelect(e.target.value)} className="px-3 py-2 border rounded-lg bg-background w-full" data-testid="select-o2bis-match">
                  <option value="">Select match to pre-fill...</option>
                  {matches.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.matchDate} - vs {m.opponent} ({m.competition})</option>
                  ))}
                </select>
              </div>
              <select value={o2bisForm.teamId} onChange={e => setO2bisForm(f => ({ ...f, teamId: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="select-o2bis-team">
                <option value="">Select Team</option>
                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input placeholder="Opponent" value={o2bisForm.opponent} onChange={e => setO2bisForm(f => ({ ...f, opponent: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-opponent" />
              <input type="date" value={o2bisForm.matchDate} onChange={e => setO2bisForm(f => ({ ...f, matchDate: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-date" />
              <input type="time" value={o2bisForm.matchTime} onChange={e => setO2bisForm(f => ({ ...f, matchTime: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-time" />
              <input placeholder="Venue" value={o2bisForm.venue} onChange={e => setO2bisForm(f => ({ ...f, venue: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-venue" />
              <input placeholder="Competition" value={o2bisForm.competition} onChange={e => setO2bisForm(f => ({ ...f, competition: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-competition" />
              <input placeholder="Coach Name" value={o2bisForm.coachName} onChange={e => setO2bisForm(f => ({ ...f, coachName: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-o2bis-coach" />
            </div>
            <button onClick={handleGenerate} disabled={!o2bisForm.teamId || !o2bisForm.opponent || !o2bisForm.matchDate || !o2bisForm.venue || !o2bisForm.competition || generateMut.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50" data-testid="button-submit-o2bis">
              {generateMut.isPending ? "Generating..." : "Generate O-2bis"}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {documents.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No documents yet</p>
              <p className="text-sm">Generate an O-2bis form to get started</p>
            </div>
          )}
          {documents.map((doc: any) => {
            const meta = doc.metadata as any;
            const team = teams.find((t: any) => t.id === doc.teamId);

            return (
              <div key={doc.id} className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow" data-testid={`card-document-${doc.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{docTypeLabels[doc.documentType] || doc.documentType}</h4>
                      <p className="text-sm text-muted-foreground">
                        {team?.name || "Unknown Team"} {meta?.opponent ? `vs ${meta.opponent}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                    </span>
                    {doc.documentType === "O2BIS" && meta && (
                      <button
                        onClick={() => {
                          const w = window.open("", "_blank");
                          if (w) {
                            w.document.write(generateO2bisHTML(meta));
                            w.document.close();
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm hover:bg-accent/80"
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Download size={14} /> View / Print
                      </button>
                    )}
                  </div>
                </div>

                {doc.documentType === "O2BIS" && meta && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{meta.matchDate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Venue</p>
                      <p className="font-medium">{meta.venue}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Competition</p>
                      <p className="font-medium">{meta.competition}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Players</p>
                      <p className="font-medium">{meta.players?.length || 0} listed</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function generateO2bisHTML(data: any): string {
  const playersRows = (data.players || []).map((p: any, i: number) =>
    `<tr><td>${i + 1}</td><td>${p.jerseyNo}</td><td>${p.name}</td><td>${p.position}</td><td>${p.dob}</td><td></td></tr>`
  ).join("");

  const officialsRows = (data.officials || []).map((o: any) =>
    `<tr><td>${o.role.replace(/_/g, " ")}</td><td>${o.name}</td><td></td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>O-2bis - ${data.teamName}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; color: #0d6e6e; font-size: 18px; margin: 5px 0; }
  h2 { text-align: center; font-size: 14px; color: #666; margin: 5px 0; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #0d6e6e; padding-bottom: 15px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
  .info div { border-bottom: 1px solid #ddd; padding: 4px 0; }
  .info strong { display: inline-block; min-width: 120px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  th { background: #0d6e6e; color: white; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-block { border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; }
  @media print { body { margin: 0; } }
</style></head><body>
<div class="header">
  <h1>AFROCAT VOLLEYBALL CLUB</h1>
  <h2>O-2bis - Official Team Composition Form</h2>
  <p style="font-size:11px;color:#999;">One Team One Dream &mdash; Passion Discipline Victory</p>
</div>
<div class="info">
  <div><strong>Team:</strong> ${data.teamName}</div>
  <div><strong>Opponent:</strong> ${data.opponent}</div>
  <div><strong>Date:</strong> ${data.matchDate} ${data.matchTime || ""}</div>
  <div><strong>Venue:</strong> ${data.venue}</div>
  <div><strong>Competition:</strong> ${data.competition}</div>
  <div><strong>Coach:</strong> ${data.coachName || ""}</div>
</div>
<h3 style="margin:15px 0 8px;">Players</h3>
<table>
  <thead><tr><th>#</th><th>Jersey</th><th>Name</th><th>Position</th><th>DOB</th><th>Signature</th></tr></thead>
  <tbody>${playersRows}</tbody>
</table>
<h3 style="margin:15px 0 8px;">Team Officials</h3>
<table>
  <thead><tr><th>Role</th><th>Name</th><th>Signature</th></tr></thead>
  <tbody>${officialsRows}</tbody>
</table>
<div class="signatures">
  <div class="sig-block">Team Manager Approval<br/><br/>Date: _______________</div>
  <div class="sig-block">Head Coach Approval<br/><br/>Date: _______________</div>
</div>
</body></html>`;
}
