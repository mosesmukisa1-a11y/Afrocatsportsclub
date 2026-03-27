import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Users, Save, Trash2, ShieldAlert, X, Eye, Crown, Shield, FileText } from "lucide-react";

const POSITIONS = ["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"];
const MAX_SQUAD = 14;

interface PlayerDetail {
  isLibero: boolean;
  isCaptain: boolean;
  matchPosition: string;
}

interface SquadSelectorProps {
  matchId: string;
  teamId: string;
  onClose: () => void;
}

export function SquadSelector({ matchId, teamId, onClose }: SquadSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playerDetails, setPlayerDetails] = useState<Record<string, PlayerDetail>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const { data: eligiblePlayers = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["/api/squad/eligibility", teamId],
    queryFn: () => api.getSquadEligibility(teamId),
  });

  const { data: existingSquad, isLoading: loadingSquad } = useQuery({
    queryKey: ["/api/squad", matchId, teamId],
    queryFn: () => api.getMatchSquad(matchId, teamId),
  });

  useEffect(() => {
    if (existingSquad?.entries?.length) {
      const ids = existingSquad.entries.map((e: any) => e.playerId);
      setSelectedIds(ids);
      const details: Record<string, PlayerDetail> = {};
      for (const e of existingSquad.entries) {
        details[e.playerId] = {
          isLibero: e.isLibero || false,
          isCaptain: e.isCaptain || false,
          matchPosition: e.matchPosition || "",
        };
      }
      setPlayerDetails(details);
    }
  }, [existingSquad]);

  const getDetail = (pid: string): PlayerDetail =>
    playerDetails[pid] || { isLibero: false, isCaptain: false, matchPosition: "" };

  const updateDetail = useCallback((pid: string, field: keyof PlayerDetail, value: any) => {
    setPlayerDetails(prev => {
      const next = { ...prev };
      if (field === "isCaptain" && value === true) {
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key], isCaptain: false };
        }
      }
      next[pid] = { ...getDetail(pid), ...prev[pid], [field]: value };
      return next;
    });
  }, []);

  const saveMut = useMutation({
    mutationFn: () => {
      const details: Record<string, { isLibero?: boolean; isCaptain?: boolean; matchPosition?: string }> = {};
      for (const pid of selectedIds) {
        const d = getDetail(pid);
        details[pid] = {};
        if (d.isLibero) details[pid].isLibero = true;
        if (d.isCaptain) details[pid].isCaptain = true;
        if (d.matchPosition) details[pid].matchPosition = d.matchPosition;
      }
      return api.saveMatchSquad({ matchId, teamId, playerIds: selectedIds, playerDetails: details });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/squad", matchId, teamId] });
      toast({ title: "Squad saved", description: `${selectedIds.length} players selected` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteMatchSquad(matchId, teamId),
    onSuccess: () => {
      setSelectedIds([]);
      setPlayerDetails({});
      queryClient.invalidateQueries({ queryKey: ["/api/squad", matchId, teamId] });
      toast({ title: "Squad cleared" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePlayer = (playerId: string, _eligible?: boolean) => {
    setSelectedIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= MAX_SQUAD) {
        toast({ title: "Maximum reached", description: `You can select up to ${MAX_SQUAD} players`, variant: "destructive" });
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const openPreview = () => {
    const token = localStorage.getItem("token");
    const url = `/api/docs/o2bis/${matchId}/preview.pdf?teamId=${teamId}&token=${token}`;
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const eligible = eligiblePlayers.filter((p: any) => p.eligible).sort((a: any, b: any) => `${a.lastName || ""} ${a.firstName || ""}`.toLowerCase().localeCompare(`${b.lastName || ""} ${b.firstName || ""}`.toLowerCase()));
  const ineligible = eligiblePlayers.filter((p: any) => !p.eligible).sort((a: any, b: any) => `${a.lastName || ""} ${a.firstName || ""}`.toLowerCase().localeCompare(`${b.lastName || ""} ${b.firstName || ""}`.toLowerCase()));
  const liberoCount = selectedIds.filter(id => getDetail(id).isLibero).length;
  const captainId = selectedIds.find(id => getDetail(id).isCaptain);
  const playersWithMissing = selectedIds.filter(id => {
    const p = eligiblePlayers.find((pl: any) => pl.id === id);
    const d = getDetail(id);
    const missing = [...(p?.missingFields || [])];
    if (!d.matchPosition && !p?.position) missing.push("position");
    return missing.length > 0;
  });
  const hasMissingFields = playersWithMissing.length > 0;

  if (loadingPlayers || loadingSquad) {
    return <div className="text-center py-8 text-muted-foreground">Loading squad data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold font-display" data-testid="text-squad-title">Match Squad Selector</h3>
          <Badge variant={selectedIds.length >= 12 ? "default" : "secondary"} data-testid="badge-squad-count">
            {selectedIds.length}/{MAX_SQUAD}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-squad">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selectedIds.length >= 14 && liberoCount < 2 && (
        <div className="bg-amber-500/10 text-amber-400 p-3 rounded-lg flex items-center gap-2 text-sm" data-testid="warning-libero">
          <AlertTriangle className="h-4 w-4" /> With 14 players, you must designate at least 2 liberos before saving.
        </div>
      )}

      {playersWithMissing.length > 0 && (
        <div className="bg-amber-500/10 text-amber-400 p-3 rounded-lg flex items-center gap-2 text-sm" data-testid="warning-missing-fields">
          <AlertTriangle className="h-4 w-4" />
          {playersWithMissing.length} selected player(s) have incomplete profiles. You can still save — assign match positions where needed.
        </div>
      )}

      <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-1">
        {eligible.map((player: any) => {
          const isSelected = selectedIds.includes(player.id);
          const detail = getDetail(player.id);
          return (
            <div
              key={player.id}
              className={`p-3 rounded-lg border transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
              data-testid={`squad-player-${player.id}`}
            >
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => togglePlayer(player.id, true)}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => togglePlayer(player.id, true)}
                  data-testid={`checkbox-player-${player.id}`}
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {player.jerseyNo || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{player.lastName} {player.firstName}</p>
                    <p className="text-xs text-muted-foreground">{player.position || "No position"}</p>
                  </div>
                </div>
                {player.ineligibilityReasons?.length > 0 && (
                  <Badge variant="outline" className="text-amber-500 border-amber-400 shrink-0 text-xs" data-testid={`badge-warning-${player.id}`}>
                    <AlertTriangle className="h-3 w-3 mr-1" /> {player.ineligibilityReasons[0]}
                  </Badge>
                )}
                {player.contractWarning && !player.ineligibilityReasons?.length && (
                  <Badge variant="outline" className="text-amber-500 border-amber-300 shrink-0 text-xs" data-testid={`badge-contract-warning-${player.id}`}>
                    No contract
                  </Badge>
                )}
                {player.missingFields?.length > 0 && (
                  <Badge variant="outline" className="text-orange-500 border-orange-300 shrink-0 text-xs" data-testid={`badge-missing-${player.id}`}>
                    Incomplete
                  </Badge>
                )}
                {!player.ineligibilityReasons?.length && !player.missingFields?.length && (
                  <Badge variant="outline" className="text-green-600 border-green-200 shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                  </Badge>
                )}
              </div>

              {isSelected && (
                <div className="mt-2 ml-10 flex items-center gap-3 flex-wrap">
                  <Select
                    value={detail.matchPosition || "_default"}
                    onValueChange={(val) => updateDetail(player.id, "matchPosition", val === "_default" ? "" : val)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-position-${player.id}`}>
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_default">Default ({player.position || "none"})</SelectItem>
                      {POSITIONS.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={detail.isLibero}
                      onCheckedChange={(checked) => updateDetail(player.id, "isLibero", !!checked)}
                      data-testid={`checkbox-libero-${player.id}`}
                    />
                    <Shield className="h-3 w-3 text-blue-400" />
                    Libero
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={detail.isCaptain}
                      onCheckedChange={(checked) => {
                        if (checked) updateDetail(player.id, "isCaptain", true);
                        else updateDetail(player.id, "isCaptain", false);
                      }}
                      data-testid={`checkbox-captain-${player.id}`}
                    />
                    <Crown className="h-3 w-3 text-yellow-400" />
                    Captain
                  </label>
                </div>
              )}
            </div>
          );
        })}

        {ineligible.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-2 mb-1 text-sm text-muted-foreground">
              <ShieldAlert className="h-4 w-4" /> Ineligible Players
            </div>
            {ineligible.map((player: any) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border opacity-60 cursor-not-allowed"
                data-testid={`squad-player-ineligible-${player.id}`}
              >
                <Checkbox disabled checked={false} />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                    {player.jerseyNo}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{player.lastName} {player.firstName}</p>
                    <p className="text-xs text-muted-foreground">{player.position}</p>
                  </div>
                </div>
                <Badge variant="destructive" className="shrink-0" data-testid={`badge-ineligible-${player.id}`}>
                  <AlertTriangle className="h-3 w-3 mr-1" /> {player.ineligibilityReasons[0]}
                </Badge>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t flex-wrap">
        <Button
          onClick={() => saveMut.mutate()}
          disabled={selectedIds.length === 0 || selectedIds.length > MAX_SQUAD || saveMut.isPending || (selectedIds.length >= 14 && liberoCount < 2)}
          className="flex-1"
          data-testid="button-save-squad"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMut.isPending ? "Saving..." : "Save Squad"}
        </Button>
        {existingSquad?.squad && (
          <>
            <Button
              variant="outline"
              onClick={openPreview}
              data-testid="button-preview-o2bis"
            >
              <Eye className="h-4 w-4 mr-2" />
              O2BIS Preview
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              data-testid="button-clear-squad"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              O2BIS Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded border"
                style={{ minHeight: "70vh" }}
                title="O2BIS Preview"
                data-testid="iframe-o2bis-preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
