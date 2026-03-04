import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NoticeBoard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "");

  const { data: notices = [], isLoading } = useQuery({ queryKey: ["/api/notices"], queryFn: api.getNotices });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams, enabled: isAdmin });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL", teamId: "" });

  const createMut = useMutation({
    mutationFn: () => api.createNotice({ ...form, teamId: form.audience === "TEAM" ? form.teamId : undefined }),
    onSuccess: () => {
      toast({ title: "Notice posted" });
      setForm({ title: "", body: "", audience: "ALL", teamId: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["/api/notices"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-afrocat-gold" />
            <h1 className="text-2xl font-display font-bold text-afrocat-text">Notice Board</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-notice" className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white">
              <Plus className="h-4 w-4 mr-2" /> Post Notice
            </Button>
          )}
        </div>

        {showForm && (
          <div className="afrocat-card p-5 space-y-4" data-testid="form-new-notice">
            <h3 className="text-lg font-display font-bold text-afrocat-text">New Notice</h3>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
              data-testid="input-notice-title"
            />
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Message body..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm resize-none"
              data-testid="input-notice-body"
            />
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs text-afrocat-muted mb-1 block">Audience</label>
                <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-notice-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Members</SelectItem>
                    <SelectItem value="TEAM">Specific Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.audience === "TEAM" && (
                <div className="flex-1">
                  <label className="text-xs text-afrocat-muted mb-1 block">Team</label>
                  <Select value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))}>
                    <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-notice-team">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => createMut.mutate()}
                disabled={!form.title || !form.body || createMut.isPending || (form.audience === "TEAM" && !form.teamId)}
                data-testid="button-submit-notice"
                className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
              >
                {createMut.isPending ? "Posting..." : "Post Notice"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-afrocat-border text-afrocat-text">Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : notices.length === 0 ? (
          <div className="afrocat-card p-8 text-center text-afrocat-muted">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notices yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((n: any) => (
              <div key={n.id} className="afrocat-card p-5" data-testid={`notice-${n.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-display font-bold text-afrocat-text">{n.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-afrocat-muted shrink-0">
                    {n.audience === "TEAM" && <span className="px-2 py-0.5 rounded-full bg-afrocat-teal-soft text-afrocat-teal"><Users className="h-3 w-3 inline mr-1" />Team</span>}
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="text-sm text-afrocat-muted whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
