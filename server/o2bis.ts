import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type { IStorage } from "./storage";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import fs from "fs";
import path from "path";

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

  const resolveUserName = async (uid: string | null | undefined) => {
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
    players = entries.map((e: any) => {
      const p = allPlayers.find(pl => pl.id === e.playerId);
      return p ? {
        jerseyNo: e.jerseyNo ?? p.jerseyNo ?? "",
        name: `${(p.lastName || "").toUpperCase()} ${p.firstName || ""}`.trim(),
        position: e.matchPosition || p.position || "",
        dob: p.dob || "",
        age: calculateAge(p.dob || ""),
        isCaptain: e.isCaptain === true,
        isLibero: e.isLibero === true,
        nationality: p.nationality || "",
        gender: (p.gender || "").charAt(0).toUpperCase() || "",
        country: (p.nationality || "").substring(0, 3).toUpperCase() || "",
      } : null;
    }).filter(Boolean).sort((a: any, b: any) => (Number(a.jerseyNo) || 99) - (Number(b.jerseyNo) || 99));
  }

  const officials = await storage.getTeamOfficials(teamId);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595;
  const pageH = 842;
  let page = pdfDoc.addPage([pageW, pageH]);
  const teal = rgb(0.06, 0.55, 0.49);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const white = rgb(1, 1, 1);
  const tealBg = rgb(0.06, 0.55, 0.49);
  const lM = 42;
  const rM = pageW - 42;
  const tableW = rM - lM;

  let y = pageH - 40;

  const drawText = (text: string, x: number, yPos: number, size = 10, f = font, color = black) => {
    page.drawText(String(text ?? ""), { x, y: yPos, size, font: f, color });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, color: any) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: black });
  };

  try {
    const logoPath = path.join(process.cwd(), "attached_assets", "afrocate_logo_1772226294597.png");
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBytes).catch(() => null);
      if (logoImage) {
        const logoDims = logoImage.scale(0.15);
        page.drawImage(logoImage, {
          x: (pageW - logoDims.width) / 2,
          y: y - logoDims.height,
          width: logoDims.width,
          height: logoDims.height,
        });
        y -= logoDims.height + 5;
      }
    }
  } catch {}

  drawText("AFROCAT VOLLEYBALL CLUB", (pageW - fontBold.widthOfTextAtSize("AFROCAT VOLLEYBALL CLUB", 16)) / 2, y, 16, fontBold, teal);
  y -= 14;
  const motto = "One Team One Dream — Passion Discipline Victory";
  drawText(motto, (pageW - font.widthOfTextAtSize(motto, 8)) / 2, y, 8, font, gray);
  y -= 20;

  const boxTitle = "O-2 Bis — OFFICIAL TEAM COMPOSITION FORM";
  const boxTitleW = fontBold.widthOfTextAtSize(boxTitle, 12);
  const boxPad = 15;
  const boxW = boxTitleW + boxPad * 2;
  const boxX = (pageW - boxW) / 2;
  drawRect(boxX, y - 4, boxW, 20, white);
  page.drawRectangle({ x: boxX, y: y - 4, width: boxW, height: 20, borderColor: black, borderWidth: 1.5, color: white });
  drawText(boxTitle, boxX + boxPad, y, 12, fontBold, black);
  y -= 30;

  const rowH = 18;
  const midX = pageW / 2;
  const labelW = 100;

  const drawInfoRow = (label1: string, val1: string, label2: string, val2: string) => {
    drawRect(lM, y - 2, midX - lM - 5, rowH, rgb(0.96, 0.96, 0.96));
    drawRect(midX + 5, y - 2, rM - midX - 5, rowH, rgb(0.96, 0.96, 0.96));
    drawLine(lM, y - 2, midX - 5, y - 2);
    drawLine(lM, y + rowH - 2, midX - 5, y + rowH - 2);
    drawLine(lM, y - 2, lM, y + rowH - 2);
    drawLine(midX - 5, y - 2, midX - 5, y + rowH - 2);
    drawLine(midX + 5, y - 2, rM, y - 2);
    drawLine(midX + 5, y + rowH - 2, rM, y + rowH - 2);
    drawLine(midX + 5, y - 2, midX + 5, y + rowH - 2);
    drawLine(rM, y - 2, rM, y + rowH - 2);

    drawText(`${label1}:`, lM + 5, y + 4, 8, fontBold, black);
    drawText(val1, lM + labelW, y + 4, 9, font, black);
    drawText(`${label2}:`, midX + 10, y + 4, 8, fontBold, black);
    drawText(val2, midX + 10 + labelW, y + 4, 9, font, black);
    y -= rowH;
  };

  const blank = skipMissing ? "________________" : "";
  drawInfoRow("Association / Club", team.name || blank, "Opponent", match.opponent || blank);
  drawInfoRow("Date", match.matchDate || blank, "Venue", match.venue || blank);
  drawInfoRow("Competition", match.competition || blank, "Head Coach", headCoachName);
  y -= 15;

  drawText("PLAYERS", lM, y, 11, fontBold, teal);
  y -= 8;

  const cols = [
    { label: "#", x: lM, w: 25 },
    { label: "JERSEY\nNO.", x: lM + 25, w: 45 },
    { label: "FULL NAME", x: lM + 70, w: 175 },
    { label: "DATE OF\nBIRTH", x: lM + 245, w: 65 },
    { label: "AGE", x: lM + 310, w: 30 },
    { label: "COUNTRY", x: lM + 340, w: 55 },
    { label: "M/F", x: lM + 395, w: 25 },
    { label: "POSITION", x: lM + 420, w: 60 },
    { label: "SIGNATURE", x: lM + 480, w: tableW - 480 },
  ];

  const headerH = 24;
  drawRect(lM, y - headerH + 10, tableW, headerH, tealBg);
  for (const col of cols) {
    drawText(col.label.split("\n")[0], col.x + 2, y + 2, 7, fontBold, white);
    if (col.label.includes("\n")) {
      drawText(col.label.split("\n")[1], col.x + 2, y - 7, 7, fontBold, white);
    }
    drawLine(col.x, y - headerH + 10, col.x, y + 10, 0.3);
  }
  drawLine(rM, y - headerH + 10, rM, y + 10, 0.3);
  drawLine(lM, y + 10, rM, y + 10, 0.5);
  drawLine(lM, y - headerH + 10, rM, y - headerH + 10, 0.5);
  y -= headerH;

  const pRowH = 18;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (y - pRowH < 80) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - 50;
    }
    const bg = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.96, 0.96, 0.96);
    drawRect(lM, y - pRowH + 10, tableW, pRowH, bg);
    drawLine(lM, y - pRowH + 10, rM, y - pRowH + 10, 0.3);

    for (const col of cols) {
      drawLine(col.x, y - pRowH + 10, col.x, y + 10, 0.3);
    }
    drawLine(rM, y - pRowH + 10, rM, y + 10, 0.3);

    drawText(String(i + 1), cols[0].x + 5, y - 2, 8, font);
    drawText(String(p.jerseyNo || ""), cols[1].x + 10, y - 2, 9, fontBold);
    const nameFont = p.isCaptain ? fontBold : font;
    const nameSuffix = p.isLibero ? " (L)" : p.isCaptain ? " (C)" : "";
    const nameStr = p.name + nameSuffix;
    const maxNameW = cols[2].w - 6;
    let nameSize = 8;
    while (nameSize > 5 && nameFont.widthOfTextAtSize(nameStr, nameSize) > maxNameW) nameSize -= 0.5;
    drawText(nameStr, cols[2].x + 3, y - 2, nameSize, nameFont);
    drawText(String(p.dob || ""), cols[3].x + 3, y - 2, 7, font);
    drawText(String(p.age || ""), cols[4].x + 5, y - 2, 8, font);
    drawText(String(p.country || ""), cols[5].x + 3, y - 2, 8, font);
    drawText(String(p.gender || ""), cols[6].x + 5, y - 2, 8, font);
    drawText(String(p.position || ""), cols[7].x + 3, y - 2, 8, font);

    y -= pRowH;
  }

  if (players.length === 0) {
    drawRect(lM, y - pRowH + 10, tableW, pRowH, white);
    drawText("No players selected", lM + 5, y - 2, 9, font, gray);
    drawLine(lM, y - pRowH + 10, rM, y - pRowH + 10, 0.3);
    y -= pRowH;
  }

  drawLine(lM, y + 10, rM, y + 10, 0.5);
  y -= 20;

  if (y < 150) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - 50; }

  drawText("TEAM OFFICIALS", lM, y, 11, fontBold, teal);
  y -= 8;

  const offCols = [
    { label: "ROLE", x: lM, w: 150 },
    { label: "FULL NAME", x: lM + 150, w: 200 },
    { label: "LICENCE NO.", x: lM + 350, w: 80 },
    { label: "SIGNATURE", x: lM + 430, w: tableW - 430 },
  ];

  drawRect(lM, y - headerH + 10, tableW, headerH, tealBg);
  for (const col of offCols) {
    drawText(col.label, col.x + 3, y + 2, 8, fontBold, white);
    drawLine(col.x, y - headerH + 10, col.x, y + 10, 0.3);
  }
  drawLine(rM, y - headerH + 10, rM, y + 10, 0.3);
  drawLine(lM, y + 10, rM, y + 10, 0.5);
  drawLine(lM, y - headerH + 10, rM, y - headerH + 10, 0.5);
  y -= headerH;

  const allOfficials: { role: string; name: string }[] = [];
  if (headCoachName) allOfficials.push({ role: "Head Coach", name: headCoachName });
  if (assistantCoachName) allOfficials.push({ role: "Assistant Coach", name: assistantCoachName });
  if (teamManagerName) allOfficials.push({ role: "Team Manager", name: teamManagerName });
  if (medicName) allOfficials.push({ role: "Medic", name: medicName });
  for (const o of officials) {
    if (!allOfficials.some(a => a.role === o.role && a.name === o.name)) {
      allOfficials.push({ role: o.role || "", name: o.name || "" });
    }
  }

  if (allOfficials.length > 0) {
    for (let i = 0; i < allOfficials.length; i++) {
      const o = allOfficials[i];
      if (y - pRowH < 80) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - 50; }
      const bg = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.96, 0.96, 0.96);
      drawRect(lM, y - pRowH + 10, tableW, pRowH, bg);
      drawLine(lM, y - pRowH + 10, rM, y - pRowH + 10, 0.3);
      for (const col of offCols) drawLine(col.x, y - pRowH + 10, col.x, y + 10, 0.3);
      drawLine(rM, y - pRowH + 10, rM, y + 10, 0.3);

      drawText(String(o.role || ""), offCols[0].x + 3, y - 2, 8, font);
      drawText(String(o.name || ""), offCols[1].x + 3, y - 2, 8, font);
      y -= pRowH;
    }
  } else {
    drawRect(lM, y - pRowH + 10, tableW, pRowH, white);
    drawText("No officials listed", (pageW - font.widthOfTextAtSize("No officials listed", 9)) / 2, y - 2, 9, font, gray);
    drawLine(lM, y - pRowH + 10, rM, y - pRowH + 10, 0.3);
    for (const col of offCols) drawLine(col.x, y - pRowH + 10, col.x, y + 10, 0.3);
    drawLine(rM, y - pRowH + 10, rM, y + 10, 0.3);
    y -= pRowH;
  }
  drawLine(lM, y + 10, rM, y + 10, 0.5);
  y -= 30;

  if (y < 100) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - 50; }

  const sigW = (tableW - 20) / 3;
  const sigLabels = ["Team Captain", "Head Coach", "Match Commissioner"];
  for (let i = 0; i < 3; i++) {
    const sx = lM + i * (sigW + 10);
    drawText(sigLabels[i], sx, y, 9, fontBold, black);
    y = y;
    drawText("Sign: _______________", sx, y - 18, 8, font, black);
    drawText("Date: _______________", sx, y - 32, 8, font, black);
  }
  y -= 50;

  drawText(`Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    lM, y, 7, font, gray);

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
