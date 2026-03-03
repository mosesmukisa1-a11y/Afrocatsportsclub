import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface SimPlayer {
  id: string;
  fullName: string;
  photoUrl: string | null;
  position: string;
  jerseyNo: number | null;
  heightCm: number | null;
  weightKg: number | null;
  matchesPlayed: number;
  avgKills: number;
  avgAces: number;
  avgBlocks: number;
  avgDigs: number;
  avgAssists: number;
  avgPoints: number;
  totalErrors: number;
  efficiency: number;
}

interface LineupPreset {
  name: string;
  playerIds: string[];
  strength: number;
}

export default function MatchSimulation() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [startingIds, setStartingIds] = useState<string[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [compareStrength, setCompareStrength] = useState<number | null>(null);
  const [compareLabel, setCompareLabel] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
  });

  const { data: simData, isLoading: loadingPlayers } = useQuery({
    queryKey: ["simulation-team-stats", selectedTeamId],
    queryFn: () => api.getSimulationTeamStats(selectedTeamId),
    enabled: !!selectedTeamId,
  });

  const players: SimPlayer[] = simData?.players ?? [];

  const starters = useMemo(
    () => players.filter((p) => startingIds.includes(p.id)),
    [players, startingIds]
  );
  const bench = useMemo(
    () => players.filter((p) => !startingIds.includes(p.id)),
    [players, startingIds]
  );

  const strengthScore = useMemo(
    () => starters.reduce((sum, p) => sum + (p.efficiency ?? 0), 0),
    [starters]
  );

  const positionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    starters.forEach((p) => {
      const pos = p.position || "Unknown";
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return counts;
  }, [starters]);

  const storageKey = `afrocat_lineups_${selectedTeamId}`;

  function getSavedPresets(): LineupPreset[] {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  }

  function handleSavePreset() {
    if (!presetName.trim()) {
      toast({ title: "Enter a preset name", variant: "destructive" });
      return;
    }
    if (startingIds.length === 0) {
      toast({ title: "Select at least one starter", variant: "destructive" });
      return;
    }
    const presets = getSavedPresets();
    const existing = presets.findIndex((p) => p.name === presetName.trim());
    const preset: LineupPreset = {
      name: presetName.trim(),
      playerIds: startingIds,
      strength: strengthScore,
    };
    if (existing >= 0) presets[existing] = preset;
    else presets.push(preset);
    localStorage.setItem(storageKey, JSON.stringify(presets));
    setPresetName("");
    toast({ title: "Lineup saved!" });
  }

  function handleLoadPreset(name: string) {
    const presets = getSavedPresets();
    const preset = presets.find((p) => p.name === name);
    if (preset) {
      const validIds = preset.playerIds.filter((id) =>
        players.some((p) => p.id === id)
      );
      setStartingIds(validIds.slice(0, 6));
      setSelectedPreset(name);
      toast({ title: `Loaded "${name}"` });
    }
  }

  function addToStarting(playerId: string) {
    if (startingIds.length >= 6) {
      toast({ title: "Starting 6 is full", variant: "destructive" });
      return;
    }
    setStartingIds((prev) => [...prev, playerId]);
  }

  function removeFromStarting(playerId: string) {
    setStartingIds((prev) => prev.filter((id) => id !== playerId));
  }

  function handleTeamChange(teamId: string) {
    setSelectedTeamId(teamId);
    setStartingIds([]);
    setCompareStrength(null);
    setCompareLabel("");
    setSelectedPreset("");
  }

  function handleSaveForCompare() {
    if (startingIds.length === 0) return;
    setCompareStrength(strengthScore);
    setCompareLabel(
      starters.map((p) => p.fullName).join(", ")
    );
    toast({ title: "Lineup A saved for comparison" });
  }

  function handleClearCompare() {
    setCompareStrength(null);
    setCompareLabel("");
  }

  const savedPresets = selectedTeamId ? getSavedPresets() : [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-page-title">
              Match Simulation
            </h1>
            <p className="text-afrocat-muted text-sm mt-1">
              Build and compare starting lineups
            </p>
          </div>

          <select
            data-testid="select-team"
            value={selectedTeamId}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="bg-afrocat-card border border-afrocat-border text-afrocat-text rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-afrocat-teal"
          >
            <option value="">Select Team</option>
            {teams.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTeamId && loadingPlayers && (
          <div className="text-center py-12 text-afrocat-muted" data-testid="text-loading">
            Loading players...
          </div>
        )}

        {selectedTeamId && !loadingPlayers && players.length === 0 && (
          <div className="text-center py-12 text-afrocat-muted" data-testid="text-no-players">
            No players found for this team.
          </div>
        )}

        {selectedTeamId && players.length > 0 && (
          <>
            <div className="afrocat-card rounded-lg p-6 bg-afrocat-card border border-afrocat-border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-afrocat-text">Team Strength Score</h2>
                  <p className="text-afrocat-muted text-xs">Sum of starting 6 efficiency</p>
                </div>
                <div
                  className="text-4xl font-display font-bold text-afrocat-gold"
                  data-testid="text-strength-score"
                >
                  {strengthScore.toFixed(1)}
                </div>
              </div>

              {Object.keys(positionBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="position-breakdown">
                  {Object.entries(positionBreakdown).map(([pos, count]) => (
                    <span
                      key={pos}
                      className="bg-afrocat-teal/10 text-afrocat-teal text-xs px-3 py-1 rounded-full font-medium"
                      data-testid={`badge-position-${pos}`}
                    >
                      {pos}: {count}
                    </span>
                  ))}
                </div>
              )}

              {compareStrength !== null && (
                <div
                  className="mt-4 p-4 rounded-md bg-afrocat-bg border border-afrocat-border"
                  data-testid="compare-panel"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-afrocat-text">Lineup Comparison</h3>
                    <button
                      data-testid="button-clear-compare"
                      onClick={handleClearCompare}
                      className="text-xs text-afrocat-red hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-afrocat-muted mb-1">Lineup A</p>
                      <p className="text-2xl font-bold text-afrocat-teal">{compareStrength.toFixed(1)}</p>
                      <p className="text-xs text-afrocat-muted mt-1 truncate" title={compareLabel}>{compareLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-afrocat-muted mb-1">Lineup B (Current)</p>
                      <p className="text-2xl font-bold text-afrocat-gold">{strengthScore.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    {strengthScore > compareStrength ? (
                      <span className="text-afrocat-green text-sm font-medium" data-testid="text-compare-result">
                        Current lineup is stronger by {(strengthScore - compareStrength).toFixed(1)}
                      </span>
                    ) : strengthScore < compareStrength ? (
                      <span className="text-afrocat-red text-sm font-medium" data-testid="text-compare-result">
                        Current lineup is weaker by {(compareStrength - strengthScore).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-afrocat-muted text-sm font-medium" data-testid="text-compare-result">
                        Both lineups are equal
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                data-testid="input-preset-name"
                type="text"
                placeholder="Preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="bg-afrocat-card border border-afrocat-border text-afrocat-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-afrocat-teal flex-1 min-w-[150px]"
              />
              <button
                data-testid="button-save-preset"
                onClick={handleSavePreset}
                className="bg-afrocat-teal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-afrocat-teal/80 transition-colors"
              >
                Save Lineup
              </button>
              {savedPresets.length > 0 && (
                <select
                  data-testid="select-load-preset"
                  value={selectedPreset}
                  onChange={(e) => handleLoadPreset(e.target.value)}
                  className="bg-afrocat-card border border-afrocat-border text-afrocat-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-afrocat-teal"
                >
                  <option value="">Load Preset...</option>
                  {savedPresets.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.strength.toFixed(1)})
                    </option>
                  ))}
                </select>
              )}
              <button
                data-testid="button-save-compare"
                onClick={handleSaveForCompare}
                disabled={startingIds.length === 0}
                className="bg-afrocat-gold/20 text-afrocat-gold px-4 py-2 rounded-md text-sm font-medium hover:bg-afrocat-gold/30 transition-colors disabled:opacity-40"
              >
                Save for Compare
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="afrocat-card rounded-lg p-4 bg-afrocat-card border border-afrocat-border">
                <h2 className="text-lg font-bold text-afrocat-text mb-3">
                  Starting 6{" "}
                  <span className="text-afrocat-muted text-sm font-normal">
                    ({startingIds.length}/6)
                  </span>
                </h2>
                {starters.length === 0 ? (
                  <p className="text-afrocat-muted text-sm py-8 text-center" data-testid="text-empty-starting">
                    Click players from the bench to add them
                  </p>
                ) : (
                  <div className="space-y-2">
                    {starters.map((p) => (
                      <div
                        key={p.id}
                        data-testid={`starter-card-${p.id}`}
                        onClick={() => removeFromStarting(p.id)}
                        className="flex items-center gap-3 p-3 rounded-md bg-afrocat-teal/10 border border-afrocat-teal/20 cursor-pointer hover:bg-afrocat-teal/20 transition-colors"
                      >
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={p.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-afrocat-teal/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-afrocat-teal/20 flex items-center justify-center text-afrocat-teal font-bold text-sm">
                            {p.jerseyNo ?? "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-afrocat-text truncate">
                            {p.fullName}
                          </p>
                          <p className="text-xs text-afrocat-muted">
                            {p.position} · #{p.jerseyNo}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-afrocat-gold">
                            {p.efficiency?.toFixed(1)}
                          </p>
                          <p className="text-xs text-afrocat-muted">eff</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="afrocat-card rounded-lg p-4 bg-afrocat-card border border-afrocat-border">
                <h2 className="text-lg font-bold text-afrocat-text mb-3">
                  Bench{" "}
                  <span className="text-afrocat-muted text-sm font-normal">
                    ({bench.length})
                  </span>
                </h2>
                {bench.length === 0 ? (
                  <p className="text-afrocat-muted text-sm py-8 text-center" data-testid="text-empty-bench">
                    All players are in the starting lineup
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {bench.map((p) => (
                      <div
                        key={p.id}
                        data-testid={`bench-card-${p.id}`}
                        onClick={() => addToStarting(p.id)}
                        className="flex items-center gap-3 p-3 rounded-md bg-afrocat-bg border border-afrocat-border cursor-pointer hover:bg-afrocat-white-5 transition-colors"
                      >
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={p.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-afrocat-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-afrocat-card flex items-center justify-center text-afrocat-muted font-bold text-sm border border-afrocat-border">
                            {p.jerseyNo ?? "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-afrocat-text truncate">
                            {p.fullName}
                          </p>
                          <p className="text-xs text-afrocat-muted">
                            {p.position} · #{p.jerseyNo}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-afrocat-teal">
                            {p.efficiency?.toFixed(1)}
                          </p>
                          <p className="text-xs text-afrocat-muted">eff</p>
                        </div>
                        <div className="hidden sm:grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-afrocat-muted shrink-0">
                          <span>K:{p.avgKills?.toFixed(1)}</span>
                          <span>A:{p.avgAces?.toFixed(1)}</span>
                          <span>B:{p.avgBlocks?.toFixed(1)}</span>
                          <span>D:{p.avgDigs?.toFixed(1)}</span>
                          <span>As:{p.avgAssists?.toFixed(1)}</span>
                          <span>P:{p.avgPoints?.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
