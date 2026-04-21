import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { db } from "./db";
import * as schema from "@shared/schema";
import type { IStorage } from "./storage";

const C = {
  teal: rgb(0.082, 0.624, 0.616),
  gold: rgb(0.937, 0.765, 0.173),
  dark: rgb(0.071, 0.094, 0.122),
  mid: rgb(0.125, 0.165, 0.212),
  light: rgb(0.8, 0.84, 0.88),
  muted: rgb(0.45, 0.52, 0.6),
  white: rgb(1, 1, 1),
  red: rgb(0.86, 0.2, 0.2),
  green: rgb(0.12, 0.7, 0.35),
};

function fmt(n: number): string {
  return `N$${Math.round(n || 0).toLocaleString()}`;
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

const posBase: Record<string, number> = {
  "OH": 5000, "Outside Hitter": 5000, "Outside": 5000,
  "OPP": 6000, "Opposite": 6000, "Opposite Hitter": 6000,
  "MB": 4500, "Middle Blocker": 4500, "Middle": 4500,
  "S": 4500, "Setter": 4500, "L": 3500, "Libero": 3500,
};

function getBase(pos: string | null): number {
  if (!pos) return 4000;
  const key = Object.keys(posBase).find(k => pos.toLowerCase().includes(k.toLowerCase()));
  return key ? posBase[key] : 4000;
}

function calcPerfScore(agg: any): number {
  if (!agg || agg.matches === 0) return 50;
  const { spikesKill, spikesError, servesAce, servesError, blocksSolo, blocksAssist,
    receivePerfect, receiveError, digs, settingAssist, settingError, matches } = agg;
  const errorsTotal = spikesError + servesError + receiveError + settingError;
  const raw = (spikesKill * 5 + servesAce * 8 + blocksSolo * 6 + blocksAssist * 3 +
    digs * 2 + settingAssist * 3 + receivePerfect * 2 - errorsTotal * 3) / matches;
  return Math.round(Math.min(100, Math.max(0, raw * 1.5 + 45)));
}

function calcAgeMult(dob: string | null): number {
  const age = calcAge(dob);
  if (age === null) return 1.0;
  if (age < 17) return 0.7;
  if (age < 22) return 1.5;
  if (age < 27) return 2.0;
  if (age < 31) return 1.4;
  if (age < 35) return 0.9;
  return 0.6;
}

function ageLabel(dob: string | null): string {
  const age = calcAge(dob);
  if (age === null) return "Unknown age";
  if (age < 17) return `Age ${age} — Youth developing bracket`;
  if (age < 22) return `Age ${age} — Rising star bracket`;
  if (age < 27) return `Age ${age} — Peak performance bracket`;
  if (age < 31) return `Age ${age} — Prime career bracket`;
  if (age < 35) return `Age ${age} — Experienced veteran bracket`;
  return `Age ${age} — Elder statesperson bracket`;
}

export interface PlayerValuation {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  age: number | null;
  dob: string | null;
  employmentClass: string;
  fees: { membership: number; development: number; resource: number; league: number; total: number };
  totalPaid: number;
  totalPaidByPlayer: number;
  totalPaidByOthers: number;
  outstanding: number;
  clubExpenses: number;
  clubInvestment: number;
  payments: any[];
  expenses: any[];
  stats: { matches: number; kills: number; aces: number; blocks: number; digs: number; assists: number; points: number } | null;
  perfScore: number;
  ageMult: number;
  attendRate: number;
  base: number;
  transferValue: number;
  valuationBreakdown: {
    baseValue: number;
    baseLabel: string;
    ageMult: number;
    ageLabel: string;
    perfScore: number;
    perfLabel: string;
    attendRate: number;
    attendLabel: string;
    clubInvestment: number;
    formula: string;
    result: number;
  };
}

export async function buildPlayerValuation(playerId: string, storage: IStorage): Promise<PlayerValuation | null> {
  const player = await storage.getPlayer(playerId);
  if (!player) return null;

  const [payments, expenses, configs, allStats, allSessions, allRecords, allTeams] = await Promise.all([
    storage.getPlayerPayments(playerId),
    storage.getPlayerExpenses(playerId),
    storage.getFeeConfigs(),
    db.select().from(schema.playerMatchStats).then(r => r.filter((s: any) => s.playerId === playerId)),
    storage.getAttendanceSessions(),
    db.select().from(schema.attendanceRecords).then(r => r.filter((rec: any) => rec.playerId === playerId)),
    storage.getTeams(),
  ]);

  const feeMap: Record<string, number> = {};
  configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

  const membershipFee = player.employmentClass === "WORKING" ? (feeMap.membershipFeeWorking || 800) : (feeMap.membershipFeeNonWorking || 400);
  const developmentFee = feeMap.developmentFee || 2500;
  const resourceFee = feeMap.resourceFee || 1500;
  const leagueFee = feeMap.leagueAffiliationFeePerPlayer || 0;
  const totalFeesDue = membershipFee + developmentFee + resourceFee + leagueFee;

  const approvedPayments = payments.filter((p: any) => p.status === "APPROVED");
  const totalPaidByPlayer = approvedPayments.filter((p: any) => p.paidBy === "PLAYER").reduce((s: number, p: any) => s + p.amount, 0);
  const totalPaidByOthers = approvedPayments.filter((p: any) => p.paidBy !== "PLAYER").reduce((s: number, p: any) => s + p.amount, 0);
  const totalPaid = approvedPayments.reduce((s: number, p: any) => s + p.amount, 0);
  const outstanding = Math.max(0, totalFeesDue - totalPaid);

  const approvedExpenses = expenses.filter((e: any) => e.status === "APPROVED");
  const clubExpenses = approvedExpenses.filter((e: any) => e.paidBy !== "PLAYER").reduce((s: number, e: any) => s + e.amount, 0);
  const clubInvestment = totalPaidByOthers + clubExpenses;

  const agg = allStats.length > 0 ? allStats.reduce((acc: any, s: any) => {
    acc.spikesKill += s.spikesKill || 0; acc.spikesError += s.spikesError || 0;
    acc.servesAce += s.servesAce || 0; acc.servesError += s.servesError || 0;
    acc.blocksSolo += s.blocksSolo || 0; acc.blocksAssist += s.blocksAssist || 0;
    acc.receivePerfect += s.receivePerfect || 0; acc.receiveError += s.receiveError || 0;
    acc.digs += s.digs || 0; acc.settingAssist += s.settingAssist || 0;
    acc.settingError += s.settingError || 0; acc.pointsTotal += s.pointsTotal || 0;
    acc.matches += 1;
    return acc;
  }, { spikesKill:0, spikesError:0, servesAce:0, servesError:0, blocksSolo:0, blocksAssist:0,
    receivePerfect:0, receiveError:0, digs:0, settingAssist:0, settingError:0, pointsTotal:0, matches:0 }) : null;

  const sessionsByTeam: Record<string, string[]> = {};
  allSessions.forEach((s: any) => {
    if (!sessionsByTeam[s.teamId]) sessionsByTeam[s.teamId] = [];
    sessionsByTeam[s.teamId].push(s.id);
  });
  const allTeamSessionIds = allSessions.filter((s: any) => !s.teamId || s.sessionType === "ALL_TEAM").map((s: any) => s.id);
  const teamSessIds = new Set([...(sessionsByTeam[player.teamId] || []), ...allTeamSessionIds]);
  const expected = teamSessIds.size;
  const attended = allRecords.filter((r: any) => teamSessIds.has(r.sessionId) && ["PRESENT","LATE","EXCUSED"].includes(r.status)).length;
  const attendRate = expected === 0 ? 0.8 : Math.min(1, attended / expected);

  const perfScore = calcPerfScore(agg);
  const ageMult = calcAgeMult(player.dob || null);
  const base = getBase(player.position || null);
  const transferValue = Math.round(base * ageMult * (1 + perfScore / 100) * (1 + attendRate * 0.4) + clubInvestment);

  const team = allTeams.find((t: any) => t.id === player.teamId);
  const attendPct = Math.round(attendRate * 100);

  return {
    playerId,
    playerName: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position || "—",
    team: team?.name || "Unassigned",
    age: calcAge(player.dob || null),
    dob: player.dob || null,
    employmentClass: player.employmentClass || "NON_WORKING",
    fees: { membership: membershipFee, development: developmentFee, resource: resourceFee, league: leagueFee, total: totalFeesDue },
    totalPaid, totalPaidByPlayer, totalPaidByOthers, outstanding,
    clubExpenses, clubInvestment,
    payments, expenses,
    stats: agg ? { matches: agg.matches, kills: agg.spikesKill, aces: agg.servesAce, blocks: agg.blocksSolo + agg.blocksAssist, digs: agg.digs, assists: agg.settingAssist, points: agg.pointsTotal } : null,
    perfScore, ageMult: Math.round(ageMult * 10) / 10, attendRate: attendPct,
    base, transferValue,
    valuationBreakdown: {
      baseValue: base,
      baseLabel: `Position base value (${player.position || "Unknown"})`,
      ageMult: Math.round(ageMult * 10) / 10,
      ageLabel: ageLabel(player.dob || null),
      perfScore,
      perfLabel: agg ? `Based on ${agg.matches} match(es): ${agg.spikesKill} kills, ${agg.servesAce} aces, ${agg.blocksSolo + agg.blocksAssist} blocks, ${agg.digs} digs` : "No match stats — using default score of 50",
      attendRate: attendPct,
      attendLabel: expected === 0 ? "No sessions recorded — using default 80%" : `${attended} of ${expected} sessions attended`,
      clubInvestment,
      formula: `${fmt(base)} × ${Math.round(ageMult * 10) / 10}x × (1 + ${perfScore}/100) × (1 + ${attendPct}%×0.4) + ${fmt(clubInvestment)}`,
      result: transferValue,
    },
  };
}

interface DrawState { y: number; page: PDFPage; doc: PDFDocument; bold: PDFFont; regular: PDFFont; W: number; margin: number; }

function txt(st: DrawState, text: string, x: number, size: number, color: typeof C.white, opts?: { maxWidth?: number }) {
  let t = text;
  if (opts?.maxWidth) {
    const limit = Math.floor(opts.maxWidth / (size * 0.5));
    if (t.length > limit) t = t.slice(0, limit - 1) + "…";
  }
  st.page.drawText(t, { x, y: st.y, size, font: st.bold, color });
}

function reg(st: DrawState, text: string, x: number, size: number, color: typeof C.white, opts?: { maxWidth?: number }) {
  let t = text;
  if (opts?.maxWidth) {
    const limit = Math.floor(opts.maxWidth / (size * 0.5));
    if (t.length > limit) t = t.slice(0, limit - 1) + "…";
  }
  st.page.drawText(t, { x, y: st.y, size, font: st.regular, color });
}

function line(st: DrawState, x1: number, x2: number, color: typeof C.white, thickness = 0.5) {
  st.page.drawLine({ start: { x: x1, y: st.y }, end: { x: x2, y: st.y }, thickness, color });
}

function rect(st: DrawState, x: number, w: number, h: number, color: typeof C.white) {
  st.page.drawRectangle({ x, y: st.y, width: w, height: h, color });
}

function ensurePage(st: DrawState, needed = 60) {
  if (st.y < needed) {
    st.page = st.doc.addPage([595, 842]);
    st.page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: C.dark });
    st.y = 800;
  }
}

function sectionHeader(st: DrawState, title: string) {
  ensurePage(st, 80);
  st.y -= 6;
  rect(st, st.margin, st.W - 2 * st.margin, 22, C.mid);
  st.y += 5;
  txt(st, title, st.margin + 8, 9, C.teal);
  st.y -= 22;
}

function tableRow(st: DrawState, cells: string[], widths: number[], isHeader = false, rowColor?: typeof C.white) {
  ensurePage(st, 30);
  const h = 16;
  if (rowColor) rect(st, st.margin, st.W - 2 * st.margin, h, rowColor);
  st.y += 4;
  let x = st.margin + 4;
  cells.forEach((cell, i) => {
    const w = widths[i] || 80;
    if (isHeader) {
      txt(st, cell, x, 7, C.muted, { maxWidth: w - 4 });
    } else {
      reg(st, cell, x, 7.5, C.light, { maxWidth: w - 4 });
    }
    x += w;
  });
  st.y -= 20;
}

async function setupDoc(): Promise<DrawState> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: C.dark });
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  return { y: 800, page, doc, bold, regular, W: 595, margin: 30 };
}

function drawHeader(st: DrawState, title: string, subtitle: string) {
  rect(st, 0, st.W, 55, C.mid);
  st.y -= 12;
  txt(st, "AFROCAT SPORTS CLUB", st.margin, 12, C.teal);
  st.y -= 15;
  txt(st, title, st.margin, 9, C.white);
  reg(st, subtitle, 300, 9, C.muted);
  st.y -= 14;
  reg(st, `Generated: ${new Date().toLocaleDateString("en-NA", { day: "2-digit", month: "short", year: "numeric" })}`, st.margin, 7.5, C.muted);
  line(st, 0, st.W, C.teal, 1);
  st.y -= 20;
}

export async function generatePlayerFinancePdf(val: PlayerValuation): Promise<Buffer> {
  const st = await setupDoc();

  drawHeader(st, `Player Finance Report — ${val.playerName}`, `${val.position} | ${val.team}`);

  sectionHeader(st, "PLAYER INFORMATION");
  const infoRows = [
    ["Name:", val.playerName, "Position:", val.position],
    ["Team:", val.team, "Employment:", val.employmentClass.replace("_", " ")],
    ["Age:", val.age !== null ? `${val.age} years` : "—", "Attendance Rate:", `${val.attendRate}%`],
  ];
  infoRows.forEach(row => {
    ensurePage(st, 25);
    reg(st, row[0], st.margin + 4, 8, C.muted);
    reg(st, row[1], st.margin + 80, 8, C.light);
    reg(st, row[2], 310, 8, C.muted);
    reg(st, row[3], 390, 8, C.light);
    st.y -= 14;
  });

  sectionHeader(st, "FEE BREAKDOWN");
  tableRow(st, ["Fee Type", "Amount Due", "% of Total"], [180, 120, 120], true);
  line(st, st.margin, st.W - st.margin, C.mid);
  st.y -= 4;
  const feeRows = [
    ["Membership Fee", fmt(val.fees.membership), `${Math.round(val.fees.membership / val.fees.total * 100)}%`],
    ["Development Fee", fmt(val.fees.development), `${Math.round(val.fees.development / val.fees.total * 100)}%`],
    ["Resource Fee", fmt(val.fees.resource), `${Math.round(val.fees.resource / val.fees.total * 100)}%`],
  ];
  if (val.fees.league > 0) feeRows.push(["League Affiliation Fee", fmt(val.fees.league), `${Math.round(val.fees.league / val.fees.total * 100)}%`]);
  feeRows.forEach((row, i) => tableRow(st, row, [180, 120, 120], false, i % 2 === 0 ? C.mid : undefined));
  ensurePage(st, 25);
  rect(st, st.margin, st.W - 2 * st.margin, 18, rgb(0.05, 0.3, 0.3));
  st.y += 4;
  txt(st, "TOTAL DUE", st.margin + 4, 8, C.teal);
  txt(st, fmt(val.fees.total), st.margin + 180, 8, C.gold);
  txt(st, "PAID BY PLAYER", st.margin + 320, 8, C.teal);
  txt(st, fmt(val.totalPaidByPlayer), st.margin + 430, 8, C.green);
  st.y -= 22;

  ensurePage(st, 25);
  rect(st, st.margin, st.W - 2 * st.margin, 18, C.mid);
  st.y += 4;
  txt(st, "OUTSTANDING BALANCE", st.margin + 4, 8, val.outstanding > 0 ? C.white : C.green);
  txt(st, fmt(val.outstanding), st.margin + 180, 8, val.outstanding > 0 ? C.red : C.green);
  st.y -= 26;

  if (val.payments.length > 0) {
    sectionHeader(st, "PAYMENT HISTORY");
    tableRow(st, ["Date", "Fee Type", "Amount", "Paid By", "Status"], [90, 140, 90, 100, 80], true);
    line(st, st.margin, st.W - st.margin, C.mid);
    st.y -= 4;
    val.payments.filter((p: any) => p.status === "APPROVED").forEach((p: any, i: number) => {
      tableRow(st, [
        p.paymentDate || "—",
        (p.feeType || "").replace(/_/g, " "),
        fmt(p.amount),
        p.paidBy + (p.paidByName ? ` (${p.paidByName})` : ""),
        p.status,
      ], [90, 140, 90, 100, 80], false, i % 2 === 0 ? C.mid : undefined);
    });
  }

  sectionHeader(st, "PLAYER VALUATION — HOW THE CLUB VALUE IS CALCULATED");

  const breakdown = val.valuationBreakdown;
  const valRows: [string, string, string][] = [
    ["1. Base Value (Position)", breakdown.baseLabel, fmt(breakdown.baseValue)],
    ["2. Age Multiplier", breakdown.ageLabel, `× ${breakdown.ageMult}`],
    ["3. Performance Score", breakdown.perfLabel, `${breakdown.perfScore}/100`],
    ["4. Attendance Rate", breakdown.attendLabel, `${breakdown.attendRate}%`],
    ["5. Club Investment", "Equipment, fees & expenses paid by club", fmt(breakdown.clubInvestment)],
  ];

  valRows.forEach(([label, desc, value], i) => {
    ensurePage(st, 30);
    rect(st, st.margin, st.W - 2 * st.margin, 22, i % 2 === 0 ? C.mid : rgb(0.1, 0.13, 0.17));
    st.y += 6;
    txt(st, label, st.margin + 4, 7.5, C.gold);
    reg(st, desc, st.margin + 175, 7, C.muted, { maxWidth: 200 });
    txt(st, value, st.W - st.margin - 80, 7.5, C.light);
    st.y -= 26;
  });

  ensurePage(st, 45);
  st.y -= 6;
  rect(st, st.margin, st.W - 2 * st.margin, 35, rgb(0.04, 0.18, 0.18));
  st.y += 24;
  txt(st, "FORMULA:", st.margin + 8, 7, C.muted);
  reg(st, `Base × Age × (1 + Perf/100) × (1 + Attend×0.4) + Club Investment`, st.margin + 65, 7, C.light);
  st.y -= 13;
  txt(st, "TRANSFER VALUE:", st.margin + 8, 9, C.teal);
  txt(st, fmt(val.transferValue), st.margin + 110, 13, C.gold);
  st.y -= 22;

  if (val.stats && val.stats.matches > 0) {
    sectionHeader(st, "PERFORMANCE STATISTICS (ALL MATCHES)");
    const statLabels = ["Matches", "Kills", "Aces", "Blocks", "Digs", "Assists", "Points"];
    const statValues = [val.stats.matches, val.stats.kills, val.stats.aces, val.stats.blocks, val.stats.digs, val.stats.assists, val.stats.points];
    tableRow(st, statLabels, statLabels.map(() => 75), true);
    tableRow(st, statValues.map(String), statLabels.map(() => 75), false, C.mid);
  }

  const bytes = await st.doc.save();
  return Buffer.from(bytes);
}

export async function generateTeamFinancePdf(teamId: string, storage: IStorage): Promise<Buffer> {
  const [team, allPlayers, configs] = await Promise.all([
    storage.getTeam(teamId),
    storage.getPlayers(),
    storage.getFeeConfigs(),
  ]);
  if (!team) throw new Error("Team not found");

  const teamPlayers = allPlayers.filter((p: any) => p.teamId === teamId);
  const valuations = await Promise.all(teamPlayers.map(p => buildPlayerValuation(p.id, storage)));
  const vals = valuations.filter(Boolean) as PlayerValuation[];
  vals.sort((a, b) => a.playerName.localeCompare(b.playerName));

  const totalDue = vals.reduce((s, v) => s + v.fees.total, 0);
  const totalPaid = vals.reduce((s, v) => s + v.totalPaid, 0);
  const totalOutstanding = vals.reduce((s, v) => s + v.outstanding, 0);
  const totalValue = vals.reduce((s, v) => s + v.transferValue, 0);

  const st = await setupDoc();
  drawHeader(st, `Team Finance Report — ${team.name}`, `${vals.length} player(s) | ${team.gender || "Mixed"}`);

  sectionHeader(st, "TEAM SUMMARY");
  const summaryData = [
    ["Total Players", String(vals.length), "Total Fees Due", fmt(totalDue)],
    ["Total Paid", fmt(totalPaid), "Total Outstanding", fmt(totalOutstanding)],
    ["Squad Transfer Pool", fmt(totalValue), "", ""],
  ];
  summaryData.forEach(row => {
    ensurePage(st, 25);
    reg(st, row[0], st.margin + 4, 8, C.muted);
    txt(st, row[1], st.margin + 130, 8, C.light);
    if (row[2]) {
      reg(st, row[2], 310, 8, C.muted);
      txt(st, row[3], 440, 8, row[2].includes("Outstanding") && totalOutstanding > 0 ? C.red : row[2].includes("Pool") ? C.gold : C.light);
    }
    st.y -= 14;
  });

  sectionHeader(st, "PLAYER ROSTER & VALUES");
  const colW = [140, 70, 90, 90, 90, 80];
  tableRow(st, ["Player", "Position", "Fees Due", "Outstanding", "Perf Score", "Transfer Value"], colW, true);
  line(st, st.margin, st.W - st.margin, C.mid);
  st.y -= 4;
  vals.forEach((v, i) => {
    tableRow(st, [
      v.playerName,
      v.position,
      fmt(v.fees.total),
      v.outstanding > 0 ? fmt(v.outstanding) : "PAID ✓",
      `${v.perfScore}/100`,
      fmt(v.transferValue),
    ], colW, false, i % 2 === 0 ? C.mid : undefined);
  });

  ensurePage(st, 25);
  rect(st, st.margin, st.W - 2 * st.margin, 18, rgb(0.04, 0.18, 0.18));
  st.y += 4;
  txt(st, "SQUAD TOTALS", st.margin + 4, 8, C.teal);
  txt(st, fmt(totalDue), st.margin + 210, 8, C.light);
  txt(st, totalOutstanding > 0 ? fmt(totalOutstanding) : "CLEAR", st.margin + 300, 8, totalOutstanding > 0 ? C.red : C.green);
  txt(st, fmt(totalValue), st.margin + 455, 8, C.gold);
  st.y -= 26;

  sectionHeader(st, "VALUATION METHODOLOGY");
  const methodology = [
    "The Transfer Value is the estimated financial worth of each player to the club, calculated as:",
    "  Transfer Value = Base × Age Multiplier × (1 + Performance Score/100) × (1 + Attendance Rate×0.4) + Club Investment",
    "",
    "• Base Value: Position-based (Opposite: N$6,000 | OH: N$5,000 | MB/Setter: N$4,500 | Libero: N$3,500 | Default: N$4,000)",
    "• Age Multiplier: <17: 0.7x | 17-21: 1.5x | 22-26: 2.0x (peak) | 27-30: 1.4x | 31-34: 0.9x | 35+: 0.6x",
    "• Performance Score: Weighted match stats (kills×5, aces×8, blocks×6, assists×3, digs×2) per match. Range: 0-100",
    "• Attendance Rate: % of team training sessions attended. Contributes up to 40% bonus to base value",
    "• Club Investment: Total club-funded payments + equipment expenses for this player",
  ];
  methodology.forEach(line2 => {
    ensurePage(st, 20);
    reg(st, line2, st.margin + 4, 7, C.light);
    st.y -= 11;
  });

  const bytes = await st.doc.save();
  return Buffer.from(bytes);
}

export async function generateClubFinancePdf(storage: IStorage): Promise<Buffer> {
  const [allPlayers, allTeams, configs, allUsers] = await Promise.all([
    storage.getPlayers(),
    storage.getTeams(),
    storage.getFeeConfigs(),
    storage.getAllUsers(),
  ]);

  const feeMap: Record<string, number> = {};
  configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

  const valuations = await Promise.all(allPlayers.map(p => buildPlayerValuation(p.id, storage)));
  const vals = valuations.filter(Boolean) as PlayerValuation[];
  vals.sort((a, b) => a.playerName.localeCompare(b.playerName));

  const totalDue = vals.reduce((s, v) => s + v.fees.total, 0);
  const totalPaid = vals.reduce((s, v) => s + v.totalPaid, 0);
  const totalOutstanding = vals.reduce((s, v) => s + v.outstanding, 0);
  const totalValue = vals.reduce((s, v) => s + v.transferValue, 0);
  const fullyPaid = vals.filter(v => v.outstanding === 0).length;

  const st = await setupDoc();
  drawHeader(st, "Club Finance Report", `All Members — ${new Date().toLocaleDateString("en-NA", { day: "2-digit", month: "long", year: "numeric" })}`);

  sectionHeader(st, "CLUB FINANCIAL OVERVIEW");
  const overview = [
    ["Total Players", String(vals.length), "Fully Paid Members", `${fullyPaid} / ${vals.length}`],
    ["Total Fees Due", fmt(totalDue), "Total Collected", fmt(totalPaid)],
    ["Total Outstanding", fmt(totalOutstanding), "Squad Transfer Pool", fmt(totalValue)],
  ];
  overview.forEach(row => {
    ensurePage(st, 25);
    reg(st, row[0], st.margin + 4, 8.5, C.muted);
    txt(st, row[1], st.margin + 140, 8.5, C.light);
    reg(st, row[2], 310, 8.5, C.muted);
    txt(st, row[3], 440, 8.5, row[2].includes("Outstanding") && totalOutstanding > 0 ? C.red : row[2].includes("Pool") ? C.gold : C.green);
    st.y -= 15;
  });

  sectionHeader(st, "BREAKDOWN BY TEAM");
  const colW2 = [160, 60, 90, 90, 90, 80];
  tableRow(st, ["Team", "Players", "Fees Due", "Outstanding", "Avg Perf", "Squad Value"], colW2, true);
  line(st, st.margin, st.W - st.margin, C.mid);
  st.y -= 4;
  allTeams.forEach((team: any, i: number) => {
    const tv = vals.filter(v => v.team === team.name);
    if (tv.length === 0) return;
    const tOut = tv.reduce((s, v) => s + v.outstanding, 0);
    const tVal = tv.reduce((s, v) => s + v.transferValue, 0);
    const tDue = tv.reduce((s, v) => s + v.fees.total, 0);
    const avgPerf = Math.round(tv.reduce((s, v) => s + v.perfScore, 0) / tv.length);
    tableRow(st, [team.name, String(tv.length), fmt(tDue), tOut > 0 ? fmt(tOut) : "CLEAR", `${avgPerf}/100`, fmt(tVal)],
      colW2, false, i % 2 === 0 ? C.mid : undefined);
  });

  sectionHeader(st, "COMPLETE PLAYER REGISTER");
  const colW3 = [130, 65, 75, 90, 80, 65, 70];
  tableRow(st, ["Player", "Team", "Position", "Fees Due", "Outstanding", "Perf", "Value"], colW3, true);
  line(st, st.margin, st.W - st.margin, C.mid);
  st.y -= 4;
  vals.forEach((v, i) => {
    tableRow(st, [
      v.playerName,
      v.team,
      v.position,
      fmt(v.fees.total),
      v.outstanding > 0 ? fmt(v.outstanding) : "✓ PAID",
      `${v.perfScore}/100`,
      fmt(v.transferValue),
    ], colW3, false, i % 2 === 0 ? C.mid : undefined);
  });

  ensurePage(st, 25);
  rect(st, st.margin, st.W - 2 * st.margin, 18, rgb(0.04, 0.18, 0.18));
  st.y += 4;
  txt(st, "GRAND TOTALS", st.margin + 4, 8, C.teal);
  txt(st, fmt(totalDue), st.margin + 195, 8, C.light);
  txt(st, totalOutstanding > 0 ? fmt(totalOutstanding) : "CLEAR", st.margin + 285, 8, totalOutstanding > 0 ? C.red : C.green);
  txt(st, fmt(totalValue), st.W - st.margin - 70, 8, C.gold);
  st.y -= 26;

  sectionHeader(st, "VALUATION METHODOLOGY");
  const methodology = [
    "Transfer Value = Base × Age Multiplier × (1 + Performance Score/100) × (1 + Attendance Rate×0.4) + Club Investment",
    "• Base Value: Opposite N$6,000 | Outside Hitter N$5,000 | Middle Blocker/Setter N$4,500 | Libero N$3,500 | Default N$4,000",
    "• Age Multiplier: <17: 0.7x | 17-21: 1.5x (Rising) | 22-26: 2.0x (Peak) | 27-30: 1.4x | 31-34: 0.9x | 35+: 0.6x",
    "• Performance Score (0-100): Weighted stats per match. Kills×5, Aces×8, Blocks×6, Digs×2, Assists×3. Default 50 if no data",
    "• Attendance Rate: % of team sessions attended. Up to 40% bonus multiplier on base value",
    "• Club Investment: All club-funded fees, equipment and expenses charged to the player's account",
  ];
  methodology.forEach(line2 => {
    ensurePage(st, 18);
    reg(st, line2, st.margin + 4, 7, C.light);
    st.y -= 11;
  });

  const bytes = await st.doc.save();
  return Buffer.from(bytes);
}
