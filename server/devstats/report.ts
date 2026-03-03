import { groupBy, summarizeSkill, topK } from "./metrics";

function trainingSuggestionFromWeakness(w: string): string {
  switch (w) {
    case "RECEIVE_HIGH_ERRORS":
      return "Passing focus: platform angle + footwork + communication reps. Add serve-receive pressure drills.";
    case "SERVE_HIGH_ERRORS":
      return "Serving focus: consistency targets, 10-in-a-row routines, then pressure serving (end-of-set simulations).";
    case "ATTACK_LOW_EFF":
      return "Attacking focus: approach timing + shot selection (tooling/roll/line) + reading block drills.";
    case "DECISION_ERRORS_HIGH":
      return "Game IQ focus: setter decision patterns, attacker shot selection, reading defence, video review sessions.";
    case "BLOCK_LATE_READ":
      return "Blocking focus: reading hitter cues, first step timing, hand positioning, closing to antenna drills.";
    case "DIG_LOW_CONTROL":
      return "Defence focus: positioning, reading, controlled dig to target, repetition under speed.";
    default:
      return "General improvement: fundamentals + repetition under match-like pressure.";
  }
}

export function generateDevelopmentReport({ match, teamId, rosterPlayers, events }: {
  match: any; teamId: string; rosterPlayers: any[]; events: any[];
}) {
  const byPlayer = groupBy(events, (e: any) => e.playerId);

  const playerSummaries = [];
  for (const p of rosterPlayers) {
    const pe = byPlayer.get(p.id) || [];
    const bySkill = groupBy(pe, (e: any) => e.action);

    const serve = summarizeSkill(bySkill.get("SERVE") || [], { isServe: true });
    const receive = summarizeSkill(bySkill.get("RECEIVE") || [], { isReceive: true });
    const set = summarizeSkill(bySkill.get("SET") || []);
    const attack = summarizeSkill(bySkill.get("ATTACK") || [], { isAttack: true });
    const block = summarizeSkill(bySkill.get("BLOCK") || []);
    const dig = summarizeSkill(bySkill.get("DIG") || []);

    const errorTypesAll: Record<string, number> = {};
    for (const e of pe) {
      if (e.errorType) errorTypesAll[e.errorType] = (errorTypesAll[e.errorType] || 0) + 1;
    }
    const topErrors = topK(errorTypesAll, 3);

    const weaknessFlags: string[] = [];
    if ((receive.receiveErrorPct || 0) >= 20 || (receive.minusPct || 0) >= 20) weaknessFlags.push("RECEIVE_HIGH_ERRORS");
    if ((serve.serveErrorPct || 0) >= 18) weaknessFlags.push("SERVE_HIGH_ERRORS");
    if (typeof attack.attackEfficiency === "number" && attack.attackEfficiency < 0.0 && (attack.attempts || 0) >= 5) weaknessFlags.push("ATTACK_LOW_EFF");

    const decisionErrors = (serve.errorCatCount?.DECISION || 0) + (receive.errorCatCount?.DECISION || 0) +
      (set.errorCatCount?.DECISION || 0) + (attack.errorCatCount?.DECISION || 0) +
      (block.errorCatCount?.DECISION || 0) + (dig.errorCatCount?.DECISION || 0);
    if (decisionErrors >= 6) weaknessFlags.push("DECISION_ERRORS_HIGH");

    const focus = (weaknessFlags.length ? weaknessFlags : ["GENERAL"])
      .slice(0, 2)
      .map(trainingSuggestionFromWeakness);

    playerSummaries.push({
      playerId: p.id,
      playerName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
      jerseyNo: p.jerseyNo ?? "",
      serve, receive, set, attack, block, dig,
      decisionErrors, topErrors, focusAreas: focus,
    });
  }

  const bySkillTeam = groupBy(events, (e: any) => e.action);
  const team = {
    serve: summarizeSkill(bySkillTeam.get("SERVE") || [], { isServe: true }),
    receive: summarizeSkill(bySkillTeam.get("RECEIVE") || [], { isReceive: true }),
    set: summarizeSkill(bySkillTeam.get("SET") || []),
    attack: summarizeSkill(bySkillTeam.get("ATTACK") || [], { isAttack: true }),
    block: summarizeSkill(bySkillTeam.get("BLOCK") || []),
    dig: summarizeSkill(bySkillTeam.get("DIG") || []),
  };

  const alerts = playerSummaries.map(ps => {
    const serveErr = ps.serve.serveErrorPct || 0;
    const recvMinus = ps.receive.minusPct || 0;
    const atkEff = ps.attack.attackEfficiency ?? 0;
    const dec = ps.decisionErrors || 0;

    let status = "GREEN";
    const reasons: string[] = [];

    if (recvMinus >= 20) { status = "RED"; reasons.push(`Receive minus% ${recvMinus}`); }
    if (serveErr >= 18) { status = "RED"; reasons.push(`Serve error% ${serveErr}`); }
    if (atkEff < 0.0 && (ps.attack.attempts || 0) >= 5) { status = "RED"; reasons.push(`Attack eff ${atkEff}`); }
    if (dec >= 6) { status = "RED"; reasons.push(`Decision errors ${dec}`); }

    if (status !== "RED") {
      if (recvMinus >= 10) { status = "YELLOW"; reasons.push(`Receive minus% ${recvMinus}`); }
      if (serveErr >= 10) { status = "YELLOW"; reasons.push(`Serve error% ${serveErr}`); }
      if (atkEff >= 0.0 && atkEff <= 0.10 && (ps.attack.attempts || 0) >= 5) { status = "YELLOW"; reasons.push(`Attack eff ${atkEff}`); }
    }

    return {
      playerId: ps.playerId,
      playerName: ps.playerName,
      jerseyNo: ps.jerseyNo,
      status, reasons,
      keyMetrics: { serveErrorPct: serveErr, receiveMinusPct: recvMinus, attackEfficiency: atkEff, decisionErrors: dec },
      focusAreas: ps.focusAreas,
    };
  });

  return {
    matchId: match.id,
    teamId,
    createdAt: new Date().toISOString(),
    teamSummary: team,
    playerSummaries,
    coachAlerts: alerts,
  };
}
