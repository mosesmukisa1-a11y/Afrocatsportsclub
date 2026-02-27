import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Star, Plus, Users, Trophy, AlertTriangle } from "lucide-react";

function StarRating({ stars, size = 18 }: { stars: number; size?: number }) {
  return (
    <div className="flex gap-0.5" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= stars ? "fill-accent text-accent" : "text-muted-foreground/30"} />
      ))}
    </div>
  );
}

export default function Coaches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: assignments = [] } = useQuery({ queryKey: ["coach-assignments"], queryFn: api.getCoachAssignments, enabled: isAdmin });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.getTeams });

  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ coachUserId: "", teamId: "", assignmentRole: "HEAD_COACH" as const, startDate: "" });

  const createMut = useMutation({
    mutationFn: api.createCoachAssignment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coach-assignments"] }); setShowAssign(false); setForm({ coachUserId: "", teamId: "", assignmentRole: "HEAD_COACH", startDate: "" }); },
  });

  const coachIds = [...new Set(assignments.map((a: any) => a.coachUserId))];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Coach Performance</h1>
            <p className="text-muted-foreground mt-1">Star ratings computed from match results</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAssign(!showAssign)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-assign-coach">
              <Plus size={18} /> Assign Coach
            </button>
          )}
        </div>

        {showAssign && (
          <div className="bg-card border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">New Coach Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input placeholder="Coach User ID" value={form.coachUserId} onChange={e => setForm(f => ({ ...f, coachUserId: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-coach-user-id" />
              <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="select-assignment-team">
                <option value="">Select Team</option>
                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={form.assignmentRole} onChange={e => setForm(f => ({ ...f, assignmentRole: e.target.value as any }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="select-assignment-role">
                <option value="HEAD_COACH">Head Coach</option>
                <option value="ASSISTANT_COACH">Assistant Coach</option>
              </select>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 border rounded-lg bg-background" data-testid="input-assignment-start" />
            </div>
            <button onClick={() => createMut.mutate(form)} disabled={!form.coachUserId || !form.teamId || !form.startDate} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50" data-testid="button-submit-assignment">
              Create Assignment
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coachIds.map((coachId: string) => (
            <CoachCard key={coachId} coachUserId={coachId} assignments={assignments.filter((a: any) => a.coachUserId === coachId)} teams={teams} />
          ))}
          {coachIds.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No coach assignments yet</p>
              <p className="text-sm">Assign coaches to teams to track performance</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function CoachCard({ coachUserId, assignments, teams }: { coachUserId: string; assignments: any[]; teams: any[] }) {
  const { data: perf } = useQuery({
    queryKey: ["coach-performance", coachUserId],
    queryFn: () => api.getCoachPerformance(coachUserId),
  });

  const teamNames = assignments.map((a: any) => {
    const team = teams.find((t: any) => t.id === a.teamId);
    return team ? team.name : a.teamId;
  });

  const headCoachAssignments = assignments.filter((a: any) => a.assignmentRole === "HEAD_COACH");
  const assistantAssignments = assignments.filter((a: any) => a.assignmentRole === "ASSISTANT_COACH");

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4 hover:shadow-lg transition-shadow" data-testid={`card-coach-${coachUserId}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">Coach</h3>
          <p className="text-sm text-muted-foreground truncate max-w-[200px]" data-testid={`text-coach-id-${coachUserId}`}>{coachUserId.substring(0, 8)}...</p>
        </div>
        {perf && <StarRating stars={perf.stars} />}
      </div>

      {perf && (
        <>
          <div className="flex items-center gap-2">
            {perf.provisional && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full" data-testid="badge-provisional">
                <AlertTriangle size={12} /> Provisional
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold" data-testid={`text-matches-${coachUserId}`}>{perf.matches}</p>
              <p className="text-xs text-muted-foreground">Matches</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600" data-testid={`text-wins-${coachUserId}`}>{perf.wins}</p>
              <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold" data-testid={`text-winrate-${coachUserId}`}>{Math.round((perf.winRate || 0) * 100)}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </div>

          <p className="text-sm font-medium" data-testid={`text-record-${coachUserId}`}>
            <Trophy size={14} className="inline mr-1 text-accent" />
            Wins {perf.wins} / Matches {perf.matches} ({Math.round((perf.winRate || 0) * 100)}%)
          </p>
        </>
      )}

      <div className="space-y-1">
        {headCoachAssignments.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">HEAD</span>
            <span>{teamNames.find((_: string, i: number) => assignments[i]?.id === a.id) || a.teamId}</span>
            {a.active && <span className="w-2 h-2 rounded-full bg-green-500" />}
          </div>
        ))}
        {assistantAssignments.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-medium">ASST</span>
            <span>{teamNames.find((_: string, i: number) => assignments[i]?.id === a.id) || a.teamId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
