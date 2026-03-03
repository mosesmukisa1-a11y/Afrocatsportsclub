import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { IStorage } from "./storage";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

function calculateAge(dob: string): number | string {
  if (!dob) return "";
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

async function getCaptainPlayerIds(storage: IStorage): Promise<Set<string>> {
  const allUsers = await db.select().from(schema.users);
  const captainUsers = allUsers.filter((u: any) => {
    const roles: string[] = u.roles || [];
    return roles.includes("CAPTAIN");
  });
  const captainPlayerIds = new Set<string>();
  for (const cu of captainUsers) {
    const players = await db.select().from(schema.players).where(eq(schema.players.userId, cu.id));
    for (const p of players) captainPlayerIds.add(p.id);
  }
  return captainPlayerIds;
}

export interface O2BISOptions {
  matchId: string;
  teamId?: string;
  skipMissing?: boolean;
}

export async function generateO2BISPdf(storage: IStorage, options: O2BISOptions): Promise<Buffer> {
  const { matchId, skipMissing = false } = options;

  const match = await storage.getMatch(matchId);
  if (!match) throw new Error("Match not found");

  const teamId = options.teamId || match.teamId;
  const team = await storage.getTeam(teamId);
  if (!team) throw new Error("Team not found");

  const staffRows = await db.select().from(schema.matchStaffAssignments)
    .where(eq(schema.matchStaffAssignments.matchId, matchId));
  const staff = staffRows[0] || null;

  const resolveUserName = async (uid: string | null) => {
    if (!uid) return skipMissing ? "________________" : "";
    const u = await storage.getUser(uid);
    return u?.fullName || (skipMissing ? "________________" : "");
  };

  const headCoachName = staff ? await resolveUserName(staff.headCoachUserId) : (skipMissing ? "________________" : "");
  const assistantCoachName = staff ? await resolveUserName(staff.assistantCoachUserId) : (skipMissing ? "________________" : "");
  const medicName = staff ? await resolveUserName(staff.medicUserId) : (skipMissing ? "________________" : "");
  const teamManagerName = staff ? await resolveUserName(staff.teamManagerUserId) : (skipMissing ? "________________" : "");

  let players: any[] = [];
  const squad = await storage.getMatchSquad(matchId, teamId);
  if (squad) {
    const entries = await storage.getMatchSquadEntries(squad.id);
    const allPlayers = await storage.getPlayersByTeam(teamId);
    const captainIds = await getCaptainPlayerIds(storage);
    players = entries.map((e: any) => {
      const p = allPlayers.find(pl => pl.id === e.playerId);
      return p ? {
        jerseyNo: e.jerseyNo ?? p.jerseyNo ?? "",
        name: `${(p.lastName || "").toUpperCase()} ${p.firstName}`,
        position: p.position || "",
        dob: p.dob || "",
        age: calculateAge(p.dob || ""),
        isCaptain: captainIds.has(p.id),
        isLibero: e.isLibero === true,
        nationality: p.nationality || "Namibia",
        gender: p.gender || "",
      } : null;
    }).filter(Boolean).sort((a: any, b: any) => (a.jerseyNo || 99) - (b.jerseyNo || 99));
  }

  const officials = await storage.getTeamOfficials(teamId);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]);
  let y = 800;
  const black = rgb(0, 0, 0);
  const teal = rgb(0.06, 0.55, 0.49);
  const lineH = 16;

  const drawText = (text: string, x: number, yPos: number, size = 10, f = font, color = black) => {
    page.drawText(text, { x, y: yPos, size, font: f, color });
  };

  drawText("O-2 Bis — OFFICIAL TEAM COMPOSITION FORM", 120, y, 14, fontBold, teal);
  y -= 25;
  drawText("AFROCAT VOLLEYBALL CLUB", 200, y, 12, fontBold);
  y -= 20;
  drawText("One Team One Dream — Passion Discipline Victory", 170, y, 9, font, rgb(0.4, 0.4, 0.4));
  y -= 30;

  drawText("MATCH INFORMATION", 40, y, 11, fontBold, teal);
  y -= lineH;
  drawText(`Competition: ${match.competition || (skipMissing ? "________________" : "")}`, 40, y, 10);
  if ((match as any).round) drawText(`Round: ${(match as any).round}`, 350, y, 10);
  y -= lineH;
  drawText(`Date: ${match.matchDate}`, 40, y, 10);
  drawText(`Time: ${match.startTime ? new Date(match.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : (skipMissing ? "____" : "")}`, 200, y, 10);
  y -= lineH;
  drawText(`Venue: ${match.venue || (skipMissing ? "________________" : "")}`, 40, y, 10);
  y -= lineH;
  drawText(`Home Team: ${team.name}`, 40, y, 10);
  drawText(`Away Team: ${match.opponent}`, 300, y, 10);
  y -= 25;

  drawText("STAFF", 40, y, 11, fontBold, teal);
  y -= lineH;
  drawText(`Head Coach: ${headCoachName}`, 40, y, 10);
  y -= lineH;
  drawText(`Assistant Coach: ${assistantCoachName}`, 40, y, 10);
  y -= lineH;
  drawText(`Medic: ${medicName}`, 40, y, 10);
  y -= lineH;
  drawText(`Team Manager: ${teamManagerName}`, 40, y, 10);
  y -= 25;

  drawText("PLAYER LIST", 40, y, 11, fontBold, teal);
  y -= lineH;

  const colX = [40, 80, 250, 340, 410, 475];
  drawText("#", colX[0], y, 9, fontBold);
  drawText("Name", colX[1], y, 9, fontBold);
  drawText("Position", colX[2], y, 9, fontBold);
  drawText("DOB", colX[3], y, 9, fontBold);
  drawText("Age", colX[4], y, 9, fontBold);
  drawText("Captain", colX[5], y, 9, fontBold);
  y -= 3;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: black });
  y -= lineH;

  for (const p of players) {
    if (y < 60) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    drawText(String(p.jerseyNo || "—"), colX[0], y, 9);
    const nameText = p.isLibero ? `${p.name} (L)` : p.name;
    drawText(nameText, colX[1], y, 9);
    drawText(p.position, colX[2], y, 9);
    drawText(p.dob, colX[3], y, 9);
    drawText(String(p.age || "—"), colX[4], y, 9);
    if (p.isCaptain) drawText("(C)", colX[5], y, 9, fontBold, teal);
    y -= lineH;
  }

  if (players.length === 0) {
    drawText(skipMissing ? "(No players selected)" : "No players in squad", 40, y, 9, font, rgb(0.5, 0.5, 0.5));
    y -= lineH;
  }

  y -= 20;
  if (y < 60) { page = pdfDoc.addPage([595, 842]); y = 800; }

  if (officials.length > 0) {
    drawText("TEAM OFFICIALS", 40, y, 11, fontBold, teal);
    y -= lineH;
    for (const o of officials) {
      if (y < 60) { page = pdfDoc.addPage([595, 842]); y = 800; }
      drawText(`${o.role}: ${o.name}`, 40, y, 10);
      y -= lineH;
    }
    y -= 10;
  }

  if (y < 60) { page = pdfDoc.addPage([595, 842]); y = 800; }
  drawText("SIGNATURES", 40, y, 11, fontBold, teal);
  y -= 25;
  drawText("Head Coach: ___________________________", 40, y, 10);
  drawText("Team Manager: ___________________________", 300, y, 10);
  y -= 25;
  drawText("Match Commissioner: ___________________________", 40, y, 10);
  y -= 30;
  drawText(`Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, 40, y, 8, font, rgb(0.5, 0.5, 0.5));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function validateLiberoRule(storage: IStorage, matchId: string, teamId: string): Promise<{
  valid: boolean;
  totalSelected: number;
  liberoCount: number;
  needsLiberos: boolean;
}> {
  const squad = await storage.getMatchSquad(matchId, teamId);
  if (!squad) return { valid: true, totalSelected: 0, liberoCount: 0, needsLiberos: false };

  const entries = await storage.getMatchSquadEntries(squad.id);
  const totalSelected = entries.length;
  const liberoCount = entries.filter((e: any) => e.isLibero === true).length;

  if (totalSelected >= 14 && liberoCount < 2) {
    return { valid: false, totalSelected, liberoCount, needsLiberos: true };
  }

  return { valid: true, totalSelected, liberoCount, needsLiberos: false };
}

export async function autoSelectLiberos(storage: IStorage, matchId: string, teamId: string): Promise<string[]> {
  const squad = await storage.getMatchSquad(matchId, teamId);
  if (!squad) throw new Error("No squad found for this match");

  const entries = await storage.getMatchSquadEntries(squad.id);
  const currentLiberoCount = entries.filter((e: any) => e.isLibero === true).length;
  const needed = Math.max(0, 2 - currentLiberoCount);
  if (needed === 0) return [];

  const allPlayers = await storage.getPlayersByTeam(teamId);
  const nonLiberoEntries = entries.filter((e: any) => !e.isLibero);

  const byPosition = nonLiberoEntries.filter((e: any) => {
    const p = allPlayers.find(pl => pl.id === e.playerId);
    return p && p.position && p.position.toUpperCase() === "LIBERO";
  });

  let selected: any[] = [];
  if (byPosition.length >= needed) {
    selected = byPosition.slice(0, needed);
  } else {
    selected = [...byPosition];
    const remaining = nonLiberoEntries
      .filter((e: any) => !selected.some(s => s.id === e.id))
      .sort((a: any, b: any) => (a.jerseyNo || 99) - (b.jerseyNo || 99));
    selected.push(...remaining.slice(0, needed - selected.length));
  }

  const selectedPlayerIds: string[] = [];
  for (const entry of selected) {
    await db.update(schema.matchSquadEntries)
      .set({ isLibero: true })
      .where(eq(schema.matchSquadEntries.id, entry.id));
    selectedPlayerIds.push(entry.playerId);
  }

  return selectedPlayerIds;
}
