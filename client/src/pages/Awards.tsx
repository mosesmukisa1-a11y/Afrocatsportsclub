import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, Star, TrendingUp, Target, Zap, Award as AwardIcon, Medal, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const AWARD_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  MVP: { label: "Club MVP", icon: Trophy, color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft border-afrocat-gold/30" },
  MATCH_MVP: { label: "Match MVP", icon: Star, color: "text-afrocat-gold", bg: "bg-afrocat-gold-soft border-afrocat-gold/30" },
  MOST_IMPROVED: { label: "Most Improved", icon: TrendingUp, color: "text-afrocat-teal", bg: "bg-afrocat-teal-soft border-afrocat-teal/30" },
  BEST_SERVER: { label: "Best Server", icon: Zap, color: "text-blue-400", bg: "bg-blue-950 border-blue-500/30" },
  BEST_BLOCKER: { label: "Best Blocker", icon: Target, color: "text-purple-400", bg: "bg-purple-950 border-purple-500/30" },
  COACH_AWARD: { label: "Coach's Award", icon: Medal, color: "text-afrocat-green", bg: "bg-afrocat-green-soft border-afrocat-green/30" },
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

type AwardTab = "match-mvps" | "club-awards";

export default function Awards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AwardTab>("match-mvps");

  const { data: matchMvps = [], isLoading: mvpLoading } = useQuery({
    queryKey: ["/api/awards/match-mvps"],
    queryFn: api.getMatchMvps,
  });
  const { data: awards = [], isLoading: awardsLoading } = useQuery({
    queryKey: ["/api/awards"],
    queryFn: api.getAwards,
  });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });

  const clubAwards = awards.filter((a: any) => a.awardType !== "MATCH_MVP");
  const sortedPlayers = [...players].sort((a: any, b: any) =>
    (a.fullName || "").localeCompare(b.fullName || "")
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ playerId: "", awardType: "MVP", awardMonth: "", notes: "" });

  const createMut = useMutation({
    mutationFn: () => api.createAward(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/awards"] });
      setOpen(false);
      setForm({ playerId: "", awardType: "MVP", awardMonth: "", notes: "" });
      toast({ title: "Award granted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalMvps = matchMvps.length;
  const uniqueMvpPlayers = new Set((matchMvps as any[]).map((m: any) => m.playerId)).size;
  const mostMvps = (() => {
    const counts: Record<string, { name: string; count: number }> = {};
    (matchMvps as any[]).forEach((m: any) => {
      if (!counts[m.playerId]) counts[m.playerId] = { name: m.playerName, count: 0 };
      counts[m.playerId].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count)[0] || null;
  })();

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-afrocat-gold-soft flex items-center justify-center">
              <Trophy className="h-5 w-5 text-afrocat-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-awards-title">
                Awards
              </h1>
              <p className="text-afrocat-muted text-sm">Recognizing outstanding performance</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-award" className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white">
                <Plus className="mr-2 h-4 w-4" /> Grant Award
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-afrocat-card border-afrocat-border">
              <DialogHeader>
                <DialogTitle className="text-afrocat-text flex items-center gap-2">
                  <AwardIcon size={18} className="text-afrocat-gold" /> Grant Club Award
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Player</Label>
                  <Select value={form.playerId} onValueChange={v => setForm({ ...form, playerId: v })}>
                    <SelectTrigger className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {sortedPlayers.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.fullName || `${p.firstName} ${p.lastName}`}
                          {p.position ? ` — ${p.position}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Award Type</Label>
                  <Select value={form.awardType} onValueChange={v => setForm({ ...form, awardType: v })}>
                    <SelectTrigger className="bg-afrocat-bg border-afrocat-border text-afrocat-text">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AWARD_LABELS).filter(([k]) => k !== "MATCH_MVP").map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Month</Label>
                  <Input
                    type="month"
                    value={form.awardMonth}
                    onChange={e => setForm({ ...form, awardMonth: e.target.value })}
                    required
                    className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Notes (optional)</Label>
                  <Input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Reason for award..."
                    className="bg-afrocat-bg border-afrocat-border text-afrocat-text"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createMut.isPending || !form.playerId || !form.awardMonth}
                  className="w-full bg-afrocat-teal hover:bg-afrocat-teal/80 text-white"
                >
                  {createMut.isPending ? "Granting..." : "Grant Award"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {totalMvps > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="afrocat-card p-4 text-center">
              <div className="text-2xl font-black text-afrocat-gold" data-testid="text-total-mvps">{totalMvps}</div>
              <div className="text-xs text-afrocat-muted mt-1">Match MVPs awarded</div>
            </div>
            <div className="afrocat-card p-4 text-center">
              <div className="text-2xl font-black text-afrocat-teal">{uniqueMvpPlayers}</div>
              <div className="text-xs text-afrocat-muted mt-1">Different players</div>
            </div>
            <div className="afrocat-card p-4 text-center">
              <div className="text-sm font-bold text-afrocat-text truncate">{mostMvps?.name || "—"}</div>
              <div className="text-xs text-afrocat-muted mt-1">
                {mostMvps ? `${mostMvps.count} MVP${mostMvps.count !== 1 ? "s" : ""}` : "No MVPs yet"}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-1 border-b border-afrocat-border">
          {[
            { key: "match-mvps" as AwardTab, label: `Match MVPs (${matchMvps.length})`, icon: Star },
            { key: "club-awards" as AwardTab, label: `Club Awards (${clubAwards.length})`, icon: Trophy },
          ].map(t => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                tab === t.key
                  ? "border-afrocat-gold text-afrocat-gold"
                  : "border-transparent text-afrocat-muted hover:text-afrocat-text"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "match-mvps" && (
          <>
            {mvpLoading ? (
              <div className="text-center py-10 text-afrocat-muted">Loading MVPs...</div>
            ) : matchMvps.length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Star className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="text-afrocat-muted">No Match MVPs yet.</p>
                <p className="text-xs text-afrocat-muted">MVPs are automatically awarded when a match is finalized in the Touch Stats system.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(matchMvps as any[]).map((mvp: any) => (
                  <div
                    key={mvp.id}
                    className="afrocat-card p-5 border-l-4 border-l-afrocat-gold relative overflow-hidden"
                    data-testid={`card-mvp-${mvp.id}`}
                  >
                    <div className="absolute top-3 right-3">
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-afrocat-gold text-black">
                        <Star size={9} className="fill-black" /> MVP
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      {mvp.playerPhotoUrl ? (
                        <img
                          src={mvp.playerPhotoUrl}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover border-2 border-afrocat-gold"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-afrocat-gold flex items-center justify-center text-black font-black text-sm">
                          {getInitials(mvp.playerName || "?")}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-afrocat-text" data-testid={`text-mvp-name-${mvp.id}`}>
                          {mvp.playerName}
                        </div>
                        <div className="text-xs text-afrocat-muted">
                          #{mvp.playerJersey} &bull; {mvp.playerPosition}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {mvp.matchOpponent && (
                        <div className="flex items-center gap-2 text-afrocat-text">
                          <Trophy size={12} className="text-afrocat-gold shrink-0" />
                          <span className="font-medium">vs {mvp.matchOpponent}</span>
                          {mvp.matchResult && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${mvp.matchResult === "W" ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                              {mvp.matchResult === "W" ? "WIN" : "LOSS"} {mvp.matchSets}
                            </Badge>
                          )}
                        </div>
                      )}
                      {mvp.matchDate && (
                        <div className="flex items-center gap-2 text-afrocat-muted text-xs">
                          <Calendar size={11} className="shrink-0" />
                          {mvp.matchDate}
                          {mvp.matchCompetition && ` — ${mvp.matchCompetition}`}
                        </div>
                      )}
                      {mvp.awardMonth && (
                        <div className="text-xs text-afrocat-muted">
                          Awarded: {mvp.awardMonth}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "club-awards" && (
          <>
            {awardsLoading ? (
              <div className="text-center py-10 text-afrocat-muted">Loading awards...</div>
            ) : clubAwards.length === 0 ? (
              <div className="afrocat-card p-10 text-center space-y-3">
                <Trophy className="h-12 w-12 text-afrocat-muted mx-auto opacity-40" />
                <p className="text-afrocat-muted">No club awards granted yet.</p>
                <p className="text-xs text-afrocat-muted">Use the "Grant Award" button to recognise outstanding players.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {clubAwards.map((a: any) => {
                  const player = players.find((p: any) => p.id === a.playerId);
                  const awardMeta = AWARD_LABELS[a.awardType] || AWARD_LABELS["MVP"];
                  const Icon = awardMeta.icon;
                  const playerName = player?.fullName || `${player?.firstName || ""} ${player?.lastName || ""}`.trim() || "Unknown Player";
                  return (
                    <div
                      key={a.id}
                      className={`afrocat-card p-5 border ${awardMeta.bg} relative overflow-hidden`}
                      data-testid={`card-award-${a.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${awardMeta.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-5 w-5 ${awardMeta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-afrocat-text" data-testid={`text-award-player-${a.id}`}>
                              {playerName}
                            </h3>
                          </div>
                          <p className={`text-xs font-bold ${awardMeta.color} mt-0.5`} data-testid={`text-award-type-${a.id}`}>
                            {awardMeta.label}
                          </p>
                          <p className="text-xs text-afrocat-muted mt-1">{a.awardMonth}</p>
                          {a.notes && (
                            <p className="text-xs text-afrocat-muted mt-1 italic">{a.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
