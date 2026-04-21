import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Star, Plus, Users, Trophy, ChevronDown, ChevronUp,
  Calendar, Target, TrendingUp, Shield, CheckCircle2,
  Clock, Activity, X, Briefcase, AlertTriangle,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function StarRating({ stars, size = 16 }: { stars: number; size?: number }) {
  return (
    <div className="flex gap-0.5" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= stars ? "fill-afrocat-gold text-afrocat-gold" : "text-afrocat-border"}
        />
      ))}
    </div>
  );
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-afrocat-white-5 text-afrocat-muted">TBD</span>;
  if (result === "W") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">W</span>;
  if (result === "L") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">L</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-afrocat-white-5 text-afrocat-muted">{result}</span>;
}

function AssignmentCard({ assignment }: { assignment: any }) {
  const [expanded, setExpanded] = useState(false);
  const isHead = assignment.assignmentRole === "HEAD_COACH";

  return (
    <div className="rounded-xl border border-afrocat-border overflow-hidden" data-testid={`assignment-card-${assignment.id}`}>
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-afrocat-white-3 transition-all cursor-pointer text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
          isHead ? "bg-afrocat-teal/20 text-afrocat-teal" : "bg-afrocat-white-5 text-afrocat-muted"
        }`}>
          {isHead ? "HEAD" : "ASST"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-afrocat-text truncate">{assignment.teamName}</span>
            {assignment.teamCategory && (
              <span className="text-[10px] text-afrocat-muted shrink-0">{assignment.teamCategory}</span>
            )}
            {assignment.active && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-400 font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Active
              </span>
            )}
            {assignment.isTemporary && (
              <span className="text-[10px] text-afrocat-gold font-bold shrink-0">Temp</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-afrocat-muted mt-0.5">
            <span>{assignment.startDate}{assignment.endDate ? ` → ${assignment.endDate}` : " → present"}</span>
            <span>{assignment.totalPlayed} match{assignment.totalPlayed !== 1 ? "es" : ""}</span>
            {isHead && assignment.matchCount > 0 && (
              <span className="text-afrocat-teal font-bold">{Math.round(assignment.winRate * 100)}% win rate</span>
            )}
          </div>
        </div>

        {isHead && (
          <div className="flex gap-3 text-center shrink-0">
            <div>
              <div className="text-sm font-bold text-green-400">{assignment.wins}</div>
              <div className="text-[10px] text-afrocat-muted">W</div>
            </div>
            <div>
              <div className="text-sm font-bold text-red-400">{assignment.losses}</div>
              <div className="text-[10px] text-afrocat-muted">L</div>
            </div>
          </div>
        )}

        {expanded ? <ChevronUp className="w-4 h-4 text-afrocat-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-afrocat-muted shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-afrocat-border bg-afrocat-white-3 p-3">
          {assignment.isTemporary && assignment.tempReason && (
            <p className="text-xs text-afrocat-gold mb-2 italic">Reason: {assignment.tempReason}</p>
          )}
          {assignment.matches.length === 0 ? (
            <p className="text-xs text-afrocat-muted text-center py-3">No matches recorded during this assignment period.</p>
          ) : (
            <div className="space-y-1.5">
              {assignment.matches.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-afrocat-card border border-afrocat-border" data-testid={`match-row-${m.id}`}>
                  <ResultBadge result={m.result} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-afrocat-text truncate">vs {m.opponent}</span>
                      {m.venue && <span className="text-[10px] text-afrocat-muted truncate">{m.venue}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-afrocat-muted mt-0.5">
                      <span>{m.matchDate}</span>
                      {(m.setsFor !== null && m.setsAgainst !== null) && (
                        <span className="font-bold text-afrocat-text">{m.setsFor}–{m.setsAgainst}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.statsEntered && (
                      <span className="flex items-center gap-0.5 text-[10px] text-afrocat-teal font-bold" title="Stats entered">
                        <CheckCircle2 className="w-3 h-3" /> Stats
                      </span>
                    )}
                    {!m.result && (
                      <span className="text-[10px] text-afrocat-muted">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoachCard({ coachUserId, allAssignments, teams, allUsers }: {
  coachUserId: string;
  allAssignments: any[];
  teams: any[];
  allUsers: any[];
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: snap } = useQuery({
    queryKey: ["coach-perf-basic", coachUserId],
    queryFn: () => api.getCoachPerformance(coachUserId),
  });

  const { data: perf, isLoading } = useQuery({
    queryKey: ["coach-perf-detailed", coachUserId],
    queryFn: () => api.getCoachDetailedPerformance(coachUserId),
    enabled: expanded,
  });

  const coachUser = allUsers.find((u: any) => u.id === coachUserId);
  const assignments = allAssignments.filter((a: any) => a.coachUserId === coachUserId);
  const activeTeams = assignments.filter((a: any) => a.active).map((a: any) => teams.find((t: any) => t.id === a.teamId)?.name || a.teamId);
  const isHeadCoach = assignments.some((a: any) => a.assignmentRole === "HEAD_COACH");

  const displaySnap = perf || snap;
  const totalMatches = perf ? perf.careerMatches : (snap?.matches ?? null);
  const totalWins    = perf ? perf.careerWins    : (snap?.wins    ?? null);
  const totalLosses  = perf ? perf.careerLosses  : null;
  const winRate      = displaySnap ? Math.round(((perf?.winRate ?? snap?.winRate) || 0) * 100) : null;
  const stars        = perf?.stars ?? snap?.stars ?? 0;
  const provisional  = perf?.provisional ?? snap?.provisional ?? true;

  return (
    <div className="afrocat-card overflow-hidden" data-testid={`card-coach-${coachUserId}`}>
      <button
        className="w-full p-5 text-left hover:bg-afrocat-white-3 transition-all cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-afrocat-teal/10 border border-afrocat-teal/30 flex items-center justify-center shrink-0 overflow-hidden">
            {coachUser?.photoUrl ? (
              <img src={coachUser.photoUrl} alt={coachUser?.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-afrocat-teal">
                {(coachUser?.fullName || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-afrocat-text" data-testid={`text-coach-name-${coachUserId}`}>
                  {coachUser?.fullName || "Unknown Coach"}
                </h3>
                <p className="text-xs text-afrocat-muted truncate">{coachUser?.email || ""}</p>
              </div>
              {expanded ? <ChevronUp className="w-4 h-4 text-afrocat-muted shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-afrocat-muted shrink-0 mt-1" />}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isHeadCoach && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-afrocat-teal/20 text-afrocat-teal">
                  HEAD COACH
                </span>
              )}
              {activeTeams.length > 0 && activeTeams.map((t: string) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border">
                  {t}
                </span>
              ))}
              {assignments.length === 0 && (
                <span className="text-[10px] text-afrocat-muted">No active assignments</span>
              )}
            </div>
          </div>
        </div>

        {displaySnap && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="p-2 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
              <div className="text-lg font-display font-bold text-afrocat-text" data-testid={`text-matches-${coachUserId}`}>{totalMatches ?? "—"}</div>
              <div className="text-[10px] text-afrocat-muted">Matches</div>
            </div>
            <div className="p-2 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
              <div className="text-lg font-display font-bold text-green-400" data-testid={`text-wins-${coachUserId}`}>{totalWins ?? "—"}</div>
              <div className="text-[10px] text-afrocat-muted">Wins</div>
            </div>
            <div className="p-2 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
              <div className="text-lg font-display font-bold text-red-400" data-testid={`text-losses-${coachUserId}`}>{totalLosses ?? "—"}</div>
              <div className="text-[10px] text-afrocat-muted">Losses</div>
            </div>
            <div className="p-2 rounded-xl bg-afrocat-white-3 border border-afrocat-border text-center">
              <div className="text-lg font-display font-bold text-afrocat-gold" data-testid={`text-winrate-${coachUserId}`}>{winRate ?? "—"}%</div>
              <div className="text-[10px] text-afrocat-muted">Win Rate</div>
            </div>
          </div>
        )}

        {displaySnap && (
          <div className="flex items-center gap-3 mt-3">
            <StarRating stars={stars} />
            {provisional && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400" data-testid="badge-provisional">
                <AlertTriangle className="w-3 h-3" /> Provisional (&lt;5 matches)
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-afrocat-border p-5 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 rounded-full border-2 border-afrocat-teal border-t-transparent animate-spin" />
            </div>
          ) : perf ? (
            <>
              <h4 className="text-xs font-bold text-afrocat-muted uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5" /> Assignment History
              </h4>
              {perf.assignments.length === 0 ? (
                <p className="text-sm text-afrocat-muted text-center py-4">No assignments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {perf.assignments.map((a: any) => (
                    <AssignmentCard key={a.id} assignment={a} />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function Coaches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: assignments = [] } = useQuery({
    queryKey: ["coach-assignments"],
    queryFn: api.getCoachAssignments,
    enabled: isAdmin,
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.getTeams });
  const { data: coachUsers = [] } = useQuery({
    queryKey: ["coach-users"],
    queryFn: api.getCoachUsers,
    enabled: isAdmin,
  });
  const { data: allMembers = [] } = useQuery({
    queryKey: ["all-members"],
    queryFn: api.getAllMembers,
    enabled: isAdmin,
  });

  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({
    coachUserId: "",
    teamId: "",
    assignmentRole: "HEAD_COACH" as "HEAD_COACH" | "ASSISTANT_COACH",
    startDate: "",
    endDate: "",
    isPrimary: false,
    isTemporary: false,
    tempReason: "",
  });

  const createMut = useMutation({
    mutationFn: api.createCoachAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-assignments"] });
      qc.invalidateQueries({ queryKey: ["coach-users"] });
      setShowAssign(false);
      setForm({ coachUserId: "", teamId: "", assignmentRole: "HEAD_COACH", startDate: "", endDate: "", isPrimary: false, isTemporary: false, tempReason: "" });
      toast({ title: "Assignment created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Combine all members + coach-role users so cards always have user info
  const combinedUsers = [...allMembers as any[]].reduce((acc: any[], u: any) => {
    if (!acc.find((x: any) => x.id === u.id)) acc.push(u);
    return acc;
  }, [...coachUsers as any[]]);

  // Show cards for everyone who has at least one assignment, plus all COACH-role users
  const assignedIds = [...new Set((assignments as any[]).map((a: any) => a.coachUserId))];
  const coachRoleIds = (coachUsers as any[]).map((u: any) => u.id);
  const displayIds = [...new Set([...assignedIds, ...coachRoleIds])];

  return (
    <Layout>
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-coaches-title">
                Coach Performance
              </h1>
              <p className="text-xs text-afrocat-muted mt-0.5">
                Career record across all teams &amp; assignments · Based on O2BIS entries and match stats
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAssign(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer shrink-0"
                data-testid="button-assign-coach"
              >
                {showAssign ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAssign ? "Cancel" : "Assign Coach"}
              </button>
            )}
          </div>
        </div>

        {showAssign && (
          <div className="afrocat-card p-5 space-y-4" data-testid="form-assign-coach">
            <h3 className="font-display font-bold text-afrocat-text flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-afrocat-teal" /> New Coach Assignment
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Assign To Member</label>
                <Select value={form.coachUserId} onValueChange={v => setForm(f => ({ ...f, coachUserId: v }))}>
                  <SelectTrigger data-testid="select-coach-user">
                    <SelectValue placeholder="Select any member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allMembers as any[]).length === 0 && (coachUsers as any[]).length === 0 && (
                      <SelectItem value="_none" disabled>No members found</SelectItem>
                    )}
                    {((allMembers as any[]).length > 0 ? allMembers : coachUsers as any[]).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                        {u.role && u.role !== "PLAYER" ? ` · ${u.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-afrocat-muted mt-1">Any approved member can be assigned as head or assistant coach</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Team</label>
                <Select value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))}>
                  <SelectTrigger data-testid="select-assignment-team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teams as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Role</label>
                <Select value={form.assignmentRole} onValueChange={v => setForm(f => ({ ...f, assignmentRole: v as any }))}>
                  <SelectTrigger data-testid="select-assignment-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEAD_COACH">Head Coach</SelectItem>
                    <SelectItem value="ASSISTANT_COACH">Assistant Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm focus:outline-none focus:border-afrocat-teal"
                  data-testid="input-assignment-start"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">End Date (leave blank if ongoing)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm focus:outline-none focus:border-afrocat-teal"
                  data-testid="input-assignment-end"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-afrocat-text">
                <input
                  type="checkbox"
                  checked={form.isTemporary}
                  onChange={e => setForm(f => ({ ...f, isTemporary: e.target.checked }))}
                  className="rounded"
                  data-testid="checkbox-is-temporary"
                />
                Temporary/Cover assignment
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-afrocat-text">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="rounded"
                  data-testid="checkbox-is-primary"
                />
                Primary assignment
              </label>
            </div>

            {form.isTemporary && (
              <div>
                <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Reason for temporary assignment</label>
                <input
                  type="text"
                  value={form.tempReason}
                  onChange={e => setForm(f => ({ ...f, tempReason: e.target.value }))}
                  placeholder="e.g. Regular coach on leave"
                  className="w-full px-3 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm focus:outline-none focus:border-afrocat-teal"
                  data-testid="input-temp-reason"
                />
              </div>
            )}

            <button
              onClick={() => createMut.mutate({ ...form, active: true })}
              disabled={!form.coachUserId || !form.teamId || !form.startDate || createMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all"
              data-testid="button-submit-assignment"
            >
              {createMut.isPending ? "Saving..." : "Create Assignment"}
            </button>
          </div>
        )}

        {displayIds.length === 0 ? (
          <div className="afrocat-card p-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-afrocat-muted opacity-40" />
            <p className="text-lg font-display font-bold text-afrocat-text">No coaches yet</p>
            <p className="text-sm text-afrocat-muted mt-1">
              {isAdmin ? "Add coach assignments to start tracking performance." : "No coach assignments have been set up yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-afrocat-muted px-1">
              {displayIds.length} coach{displayIds.length !== 1 ? "es" : ""} · Click a card to expand match history
            </p>
            {displayIds.map((id: string) => (
              <CoachCard
                key={id}
                coachUserId={id}
                allAssignments={assignments as any[]}
                teams={teams as any[]}
                allUsers={combinedUsers}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
