function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = keyFn(x);
    const a = m.get(k) || [];
    a.push(x);
    m.set(k, a);
  }
  return m;
}

export function computeAttackEfficiency(events: any[]): number {
  const attempts = events.length;
  const kills = events.filter(e => e.outcomeDetail === "KILL").length;
  const errors = events.filter(e => e.outcomeDetail === "OUT" || e.outcomeDetail === "NET").length;
  const blocked = events.filter(e => e.outcomeDetail === "BLOCKED").length;
  const eff = attempts ? (kills - errors - blocked) / attempts : 0;
  return Math.round(eff * 1000) / 1000;
}

export function summarizeSkill(events: any[], opts: { isServe?: boolean; isReceive?: boolean; isAttack?: boolean } = {}) {
  const attempts = events.length;
  const plus = events.filter(e => e.outcome === "PLUS").length;
  const zero = events.filter(e => e.outcome === "ZERO").length;
  const minus = events.filter(e => e.outcome === "MINUS").length;

  const outDetailCount: Record<string, number> = {};
  for (const e of events) {
    const k = e.outcomeDetail || "NONE";
    outDetailCount[k] = (outDetailCount[k] || 0) + 1;
  }

  const errorCatCount: Record<string, number> = { TECHNICAL: 0, DECISION: 0, PRESSURE: 0, FATIGUE: 0, NONE: 0 };
  const errorTypeCount: Record<string, number> = {};
  for (const e of events) {
    const cat = e.errorCategory || "NONE";
    errorCatCount[cat] = (errorCatCount[cat] || 0) + 1;
    if (e.errorType) errorTypeCount[e.errorType] = (errorTypeCount[e.errorType] || 0) + 1;
  }

  const base: any = {
    attempts, plus, zero, minus,
    plusPct: pct(plus, attempts),
    minusPct: pct(minus, attempts),
    outDetailCount, errorCatCount, errorTypeCount,
  };

  if (opts.isServe) {
    const aces = outDetailCount["ACE"] || 0;
    const pressure = (outDetailCount["IN_PERFECT_PRESSURE"] || 0) + (outDetailCount["IN_MODERATE_PRESSURE"] || 0);
    const errors = (outDetailCount["NET"] || 0) + (outDetailCount["OUT_LONG"] || 0) + (outDetailCount["OUT_WIDE"] || 0) + (outDetailCount["FOOT_FAULT"] || 0) + (outDetailCount["ROTATION_FAULT"] || 0);
    base.acePct = pct(aces, attempts);
    base.pressurePct = pct(pressure, attempts);
    base.serveErrorPct = pct(errors, attempts);
  }

  if (opts.isReceive) {
    const perfect = outDetailCount["3_PERFECT"] || 0;
    const offSystem = outDetailCount["1_OFF_SYSTEM"] || 0;
    const err = outDetailCount["0_ERROR"] || 0;
    base.perfectPassPct = pct(perfect, attempts);
    base.offSystemPct = pct(offSystem, attempts);
    base.receiveErrorPct = pct(err, attempts);
  }

  if (opts.isAttack) {
    base.attackEfficiency = computeAttackEfficiency(events);
    const kills = outDetailCount["KILL"] || 0;
    const blocked = outDetailCount["BLOCKED"] || 0;
    base.killPct = pct(kills, attempts);
    base.blockedPct = pct(blocked, attempts);
  }

  return base;
}

export function topK(obj: Record<string, number>, k = 3) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  return entries.slice(0, k).map(([key, val]) => ({ key, val }));
}
