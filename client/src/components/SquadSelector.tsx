import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, Users, Save, Trash2, ShieldAlert, X } from "lucide-react";

interface SquadSelectorProps {
  matchId: string;
  teamId: string;
  onClose: () => void;
}

export function SquadSelector({ matchId, teamId, onClose }: SquadSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      setSelectedIds(existingSquad.entries.map((e: any) => e.playerId));
    }
  }, [existingSquad]);

  const saveMut = useMutation({
    mutationFn: () => api.saveMatchSquad({ matchId, teamId, playerIds: selectedIds }),
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
      queryClient.invalidateQueries({ queryKey: ["/api/squad", matchId, teamId] });
      toast({ title: "Squad cleared" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePlayer = (playerId: string, eligible: boolean) => {
    if (!eligible) return;
    setSelectedIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 12) {
        toast({ title: "Maximum reached", description: "You can select up to 12 players", variant: "destructive" });
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const eligible = eligiblePlayers.filter((p: any) => p.eligible);
  const ineligible = eligiblePlayers.filter((p: any) => !p.eligible);

  if (loadingPlayers || loadingSquad) {
    return <div className="text-center py-8 text-muted-foreground">Loading squad data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold font-display">Starting 12 Selector</h3>
          <Badge variant={selectedIds.length === 12 ? "default" : "secondary"} data-testid="badge-squad-count">
            {selectedIds.length}/12
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-squad">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selectedIds.length > 12 && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" /> Too many players selected. Maximum is 12.
        </div>
      )}

      <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
        {eligible.map((player: any) => {
          const isSelected = selectedIds.includes(player.id);
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
              onClick={() => togglePlayer(player.id, true)}
              data-testid={`squad-player-${player.id}`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => togglePlayer(player.id, true)}
                data-testid={`checkbox-player-${player.id}`}
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {player.jerseyNo}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{player.lastName} {player.firstName}</p>
                  <p className="text-xs text-muted-foreground">{player.position}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200 shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Eligible
              </Badge>
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

      <div className="flex gap-2 pt-2 border-t">
        <Button
          onClick={() => saveMut.mutate()}
          disabled={selectedIds.length === 0 || selectedIds.length > 12 || saveMut.isPending}
          className="flex-1"
          data-testid="button-save-squad"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMut.isPending ? "Saving..." : "Save Squad"}
        </Button>
        {existingSquad?.squad && (
          <Button
            variant="destructive"
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            data-testid="button-clear-squad"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
