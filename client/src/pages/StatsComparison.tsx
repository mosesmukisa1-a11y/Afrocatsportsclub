import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STAT_KEYS = [
  { key: "matches", label: "Matches" },
  { key: "kills", label: "Kills" },
  { key: "aces", label: "Aces" },
  { key: "blocks", label: "Blocks" },
  { key: "digs", label: "Digs" },
  { key: "assists", label: "Assists" },
  { key: "points", label: "Points" },
  { key: "errors", label: "Errors" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatBar({ label, val1, val2 }: { label: string; val1: number; val2: number }) {
  const max = Math.max(val1, val2, 1);
  const w1 = (val1 / max) * 100;
  const w2 = (val2 / max) * 100;
  const is1Higher = val1 > val2;
  const is2Higher = val2 > val1;

  return (
    <div className="mb-4" data-testid={`stat-bar-${label.toLowerCase()}`}>
      <div className="text-center text-sm font-semibold text-afrocat-text mb-2">{label}</div>
      <div className="flex items-center gap-3">
        <span className={`w-12 text-right text-sm font-bold ${is1Higher ? "text-afrocat-teal" : "text-afrocat-muted"}`}>
          {val1}
        </span>
        <div className="flex-1 flex gap-1">
          <div className="flex-1 flex justify-end">
            <div
              className={`h-6 rounded-l-md transition-all ${is1Higher ? "bg-afrocat-teal" : "bg-afrocat-muted/30"}`}
              style={{ width: `${w1}%` }}
            />
          </div>
          <div className="flex-1">
            <div
              className={`h-6 rounded-r-md transition-all ${is2Higher ? "bg-afrocat-teal" : "bg-afrocat-muted/30"}`}
              style={{ width: `${w2}%` }}
            />
          </div>
        </div>
        <span className={`w-12 text-left text-sm font-bold ${is2Higher ? "text-afrocat-teal" : "text-afrocat-muted"}`}>
          {val2}
        </span>
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: any }) {
  const age = player.age ?? null;

  return (
    <div className="afrocat-card p-6 rounded-xl flex flex-col items-center text-center" data-testid={`player-card-${player.id}`}>
      {player.photoUrl ? (
        <img
          src={player.photoUrl}
          alt={player.fullName}
          className="w-24 h-24 rounded-full object-cover border-2 border-afrocat-teal/30 mb-3"
          data-testid={`img-player-photo-${player.id}`}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-full bg-afrocat-teal/20 flex items-center justify-center text-2xl font-bold text-afrocat-teal border-2 border-afrocat-teal/30 mb-3"
          data-testid={`initials-player-${player.id}`}
        >
          {getInitials(player.fullName || "?")}
        </div>
      )}
      <h3 className="text-lg font-bold text-afrocat-text" data-testid={`text-player-name-${player.id}`}>
        {player.fullName}
      </h3>
      {player.position && (
        <span className="text-sm text-afrocat-teal font-medium" data-testid={`text-player-position-${player.id}`}>
          {player.position}
        </span>
      )}
      {player.teamName && (
        <span className="text-sm text-afrocat-muted" data-testid={`text-player-team-${player.id}`}>
          {player.teamName}
        </span>
      )}
      <div className="flex gap-4 mt-2 text-xs text-afrocat-muted">
        {player.jerseyNo != null && (
          <span data-testid={`text-player-jersey-${player.id}`}>#{player.jerseyNo}</span>
        )}
        {age != null && (
          <span data-testid={`text-player-age-${player.id}`}>{age} yrs</span>
        )}
      </div>
      {(player.heightCm || player.weightKg) && (
        <div className="text-xs text-afrocat-muted mt-1" data-testid={`text-player-hw-${player.id}`}>
          {player.heightCm ? `${player.heightCm} cm` : ""}
          {player.heightCm && player.weightKg ? " · " : ""}
          {player.weightKg ? `${player.weightKg} kg` : ""}
        </div>
      )}
    </div>
  );
}

export default function StatsComparison() {
  const { user } = useAuth();
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.getPlayers(),
  });

  const bothSelected = player1Id && player2Id;

  const { data: comparison, isLoading: comparing } = useQuery({
    queryKey: ["compareStats", player1Id, player2Id],
    queryFn: () => api.compareStats(player1Id, player2Id),
    enabled: !!bothSelected,
  });

  const filtered1 = players.filter(
    (p: any) =>
      p.id !== player2Id &&
      p.fullName?.toLowerCase().includes(search1.toLowerCase())
  );
  const filtered2 = players.filter(
    (p: any) =>
      p.id !== player1Id &&
      p.fullName?.toLowerCase().includes(search2.toLowerCase())
  );

  const selectedPlayer1 = players.find((p: any) => p.id === player1Id);
  const selectedPlayer2 = players.find((p: any) => p.id === player2Id);

  const mapCareerStats = (cs: any) => cs ? ({
    matches: cs.matchesPlayed ?? 0,
    kills: cs.totalKills ?? 0,
    aces: cs.totalAces ?? 0,
    blocks: cs.totalBlocks ?? 0,
    digs: cs.totalDigs ?? 0,
    assists: cs.totalAssists ?? 0,
    points: cs.totalPoints ?? 0,
    errors: cs.totalErrors ?? 0,
  }) : {};
  const stats1 = mapCareerStats(comparison?.player1?.careerStats);
  const stats2 = mapCareerStats(comparison?.player2?.careerStats);
  const awards1 = comparison?.player1?.totalAwards ?? 0;
  const awards2 = comparison?.player2?.totalAwards ?? 0;
  const p1Data = comparison?.player1 || selectedPlayer1;
  const p2Data = comparison?.player2 || selectedPlayer2;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text" data-testid="text-page-title">
            Stats Comparison
          </h1>
          <p className="text-afrocat-muted mt-1">Compare player performance side by side</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-afrocat-muted mb-2">Player 1</label>
            <input
              type="text"
              placeholder="Search player..."
              value={search1}
              onChange={(e) => setSearch1(e.target.value)}
              className="w-full mb-2 px-3 py-2 rounded-md bg-afrocat-card border border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted/50 focus:outline-none focus:border-afrocat-teal"
              data-testid="input-search-player1"
            />
            <select
              value={player1Id}
              onChange={(e) => setPlayer1Id(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-afrocat-card border border-afrocat-border text-afrocat-text focus:outline-none focus:border-afrocat-teal"
              data-testid="select-player1"
            >
              <option value="">Select Player 1</option>
              {filtered1.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.jerseyNo != null ? `#${p.jerseyNo}` : ""} {p.teamName ? `(${p.teamName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-afrocat-muted mb-2">Player 2</label>
            <input
              type="text"
              placeholder="Search player..."
              value={search2}
              onChange={(e) => setSearch2(e.target.value)}
              className="w-full mb-2 px-3 py-2 rounded-md bg-afrocat-card border border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted/50 focus:outline-none focus:border-afrocat-teal"
              data-testid="input-search-player2"
            />
            <select
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-afrocat-card border border-afrocat-border text-afrocat-text focus:outline-none focus:border-afrocat-teal"
              data-testid="select-player2"
            >
              <option value="">Select Player 2</option>
              {filtered2.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.jerseyNo != null ? `#${p.jerseyNo}` : ""} {p.teamName ? `(${p.teamName})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!bothSelected && (
          <div className="afrocat-card rounded-xl p-12 text-center" data-testid="text-empty-state">
            <p className="text-afrocat-muted text-lg">Select two players to compare their performance</p>
          </div>
        )}

        {bothSelected && comparing && (
          <div className="afrocat-card rounded-xl p-12 text-center" data-testid="text-loading">
            <p className="text-afrocat-muted text-lg">Loading comparison...</p>
          </div>
        )}

        {bothSelected && !comparing && comparison && p1Data && p2Data && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <PlayerCard player={p1Data} />
              <PlayerCard player={p2Data} />
            </div>

            <div className="afrocat-card rounded-xl p-6" data-testid="section-stat-bars">
              <h2 className="text-xl font-bold text-afrocat-text text-center mb-6">Performance Comparison</h2>
              {STAT_KEYS.map(({ key, label }) => (
                <StatBar
                  key={key}
                  label={label}
                  val1={stats1[key] ?? 0}
                  val2={stats2[key] ?? 0}
                />
              ))}
            </div>

            <div className="afrocat-card rounded-xl p-6" data-testid="section-awards">
              <h2 className="text-xl font-bold text-afrocat-text text-center mb-4">Awards</h2>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <span className={`text-3xl font-bold ${awards1 >= awards2 ? "text-afrocat-gold" : "text-afrocat-muted"}`} data-testid="text-awards-player1">
                    {awards1}
                  </span>
                  <p className="text-sm text-afrocat-muted mt-1">{p1Data.fullName}</p>
                </div>
                <span className="text-afrocat-muted text-2xl font-bold">vs</span>
                <div className="text-center">
                  <span className={`text-3xl font-bold ${awards2 >= awards1 ? "text-afrocat-gold" : "text-afrocat-muted"}`} data-testid="text-awards-player2">
                    {awards2}
                  </span>
                  <p className="text-sm text-afrocat-muted mt-1">{p2Data.fullName}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
