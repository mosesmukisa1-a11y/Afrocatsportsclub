import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Search, X, Users, UserPlus } from "lucide-react";

export default function EmailCompose() {
  const { toast } = useToast();
  const [form, setForm] = useState({ to: "", subject: "", text: "" });
  const [searchQ, setSearchQ] = useState("");
  const [searchRole, setSearchRole] = useState("");
  const [searchTeamId, setSearchTeamId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: api.getTeams,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["/api/members/search", searchQ, searchRole, searchTeamId],
    queryFn: () => api.searchMembers(searchQ || undefined, searchRole || undefined, searchTeamId || undefined),
    enabled: showPicker,
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const allEmails = [...selectedEmails];
      if (form.to.trim()) {
        form.to.split(",").forEach(e => {
          const trimmed = e.trim();
          if (trimmed && !allEmails.includes(trimmed)) allEmails.push(trimmed);
        });
      }
      if (allEmails.length === 0) throw new Error("No recipients");
      return api.sendEmail({ to: allEmails.join(","), subject: form.subject, text: form.text });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setForm({ to: "", subject: "", text: "" });
      setSelectedEmails([]);
    },
    onError: (e: any) => toast({ title: "Failed to send email", description: e.message, variant: "destructive" }),
  });

  function addEmail(email: string) {
    if (!selectedEmails.includes(email)) setSelectedEmails(prev => [...prev, email]);
  }

  function removeEmail(email: string) {
    setSelectedEmails(prev => prev.filter(e => e !== email));
  }

  function addAllVisible() {
    const newEmails = members.filter((m: any) => m.email && !selectedEmails.includes(m.email)).map((m: any) => m.email);
    setSelectedEmails(prev => [...prev, ...newEmails]);
  }

  const hasRecipients = selectedEmails.length > 0 || form.to.trim().length > 0;

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-afrocat-gold" />
          <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-email-title">Send Email</h1>
        </div>
        <p className="text-sm text-afrocat-muted">
          Sends from afrocatvolleyballclub@gmail.com with auto CC to afrocatladiesvc@gmail.com
        </p>

        <div className="afrocat-card p-5 space-y-4">
          {selectedEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedEmails.map(email => (
                <span key={email} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-afrocat-teal/15 text-afrocat-teal text-xs font-medium">
                  {email}
                  <button onClick={() => removeEmail(email)} className="hover:text-afrocat-red cursor-pointer"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-afrocat-muted mb-1 block">To (email addresses, comma-separated)</label>
              <input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} placeholder="recipient@example.com"
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-email-to" />
            </div>
            <div className="self-end">
              <button onClick={() => setShowPicker(!showPicker)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${showPicker ? "bg-afrocat-teal text-white border-afrocat-teal" : "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border hover:text-afrocat-text"}`}
                data-testid="button-toggle-member-picker">
                <Users className="h-4 w-4" /> Pick Members
              </button>
            </div>
          </div>

          {showPicker && (
            <div className="border border-afrocat-border rounded-xl p-4 space-y-3 bg-afrocat-white-3">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name..."
                    className="w-full px-3 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="input-member-search" />
                </div>
                <select value={searchRole} onChange={e => setSearchRole(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-member-role-filter">
                  <option value="">All Roles</option>
                  {["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select value={searchTeamId} onChange={e => setSearchTeamId(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-xs" data-testid="select-member-team-filter">
                  <option value="">All Teams</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {members.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-afrocat-muted">{members.length} member(s) found</span>
                  <button onClick={addAllVisible} className="text-[10px] text-afrocat-teal font-bold hover:underline cursor-pointer" data-testid="button-add-all-members">
                    <UserPlus className="inline h-3 w-3 mr-0.5" /> Add all
                  </button>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-1">
                {members.map((m: any) => {
                  const added = selectedEmails.includes(m.email);
                  return (
                    <button key={m.id} onClick={() => added ? removeEmail(m.email) : addEmail(m.email)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${added ? "bg-afrocat-teal/15 text-afrocat-teal" : "hover:bg-afrocat-white-5 text-afrocat-text"}`}
                      data-testid={`member-pick-${m.id}`}>
                      <div className="w-6 h-6 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-[10px] font-bold text-afrocat-teal shrink-0">
                        {(m.fullName || "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{m.fullName}</span>
                        <span className="text-afrocat-muted ml-1">({m.role})</span>
                      </div>
                      <span className="text-[10px] text-afrocat-muted truncate">{m.email}</span>
                      {added && <span className="text-[10px] font-bold text-afrocat-teal">Added</span>}
                    </button>
                  );
                })}
                {members.length === 0 && <p className="text-xs text-afrocat-muted text-center py-2">No members found</p>}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-afrocat-muted mb-1 block">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject line"
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-email-subject" />
          </div>
          <div>
            <label className="text-xs text-afrocat-muted mb-1 block">Message</label>
            <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Type your message..." rows={10}
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm resize-none" data-testid="input-email-body" />
          </div>
          <button onClick={() => sendMut.mutate()} disabled={!hasRecipients || !form.subject || !form.text || sendMut.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-send-email">
            <Send className="h-4 w-4" /> {sendMut.isPending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
