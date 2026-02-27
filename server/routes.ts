import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePassword, signToken, requireAuth, requireRole } from "./auth";
import { z } from "zod";

function esc(str: string | null | undefined): string {
  if (!str) return "—";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function computeStars(winRate: number): number {
  if (winRate >= 0.75) return 5;
  if (winRate >= 0.60) return 4;
  if (winRate >= 0.45) return 3;
  if (winRate >= 0.30) return 2;
  return 1;
}

async function recomputeCoachPerformance(teamId: string, matchDate: string) {
  const assignment = await storage.getActiveHeadCoachForTeam(teamId, matchDate);
  if (!assignment) return;

  const allAssignments = await storage.getCoachAssignmentsByTeam(teamId);
  const headAssignments = allAssignments.filter(
    a => a.coachUserId === assignment.coachUserId && a.assignmentRole === "HEAD_COACH"
  );

  let totalMatches = 0;
  let totalWins = 0;

  for (const a of headAssignments) {
    const teamMatches = await storage.getMatchesByTeam(a.teamId);
    for (const m of teamMatches) {
      if (!m.result) continue;
      if (m.matchDate < a.startDate) continue;
      if (a.endDate && m.matchDate > a.endDate) continue;
      totalMatches++;
      if (m.result === "W") totalWins++;
    }
  }

  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0;
  const stars = computeStars(winRate);

  await storage.upsertCoachPerformance({
    coachUserId: assignment.coachUserId,
    matches: totalMatches,
    wins: totalWins,
    winRate,
    stars,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // ─── AUTH ────────────────────────────────────────
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const body = z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      }).parse(req.body);

      const existing = await storage.getUserByEmail(body.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const passwordHash = await hashPassword(body.password);
      const nameParts = body.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || body.fullName;
      const lastName = nameParts.slice(1).join(" ") || "";

      const player = await storage.createPlayer({
        firstName,
        lastName,
        email: body.email,
        status: "ACTIVE",
        eligibilityStatus: "PENDING",
      });

      let user;
      try {
        user = await storage.createUser({
          fullName: body.fullName,
          email: body.email,
          passwordHash,
          role: "PLAYER",
          playerId: player.id,
        });
      } catch (err) {
        await storage.deletePlayer(player.id);
        throw err;
      }

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      return res.status(201).json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, playerId: player.id } });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const body = z.object({
        email: z.string().email(),
        password: z.string(),
      }).parse(req.body);

      const user = await storage.getUserByEmail(body.email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const valid = await comparePassword(body.password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      return res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, playerId: user.playerId } });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, playerId: user.playerId });
    } catch (e) { next(e); }
  });

  // ─── TEAMS ───────────────────────────────────────
  app.get("/api/teams", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getTeams()); } catch (e) { next(e); }
  });

  app.post("/api/teams", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({ name: z.string().min(1), category: z.enum(["MEN","WOMEN","VETERANS","JUNIORS"]), season: z.string() }).parse(req.body);
      res.status(201).json(await storage.createTeam(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/teams/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateTeam(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Team not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/teams/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteTeam(req.params.id); res.status(204).send(); } catch (e) { next(e); }
  });

  // ─── PLAYERS ─────────────────────────────────────
  app.get("/api/players", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL"]), async (_req, res, next) => {
    try { res.json(await storage.getPlayers()); } catch (e) { next(e); }
  });

  app.get("/api/players/team/:teamId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getPlayersByTeam(req.params.teamId)); } catch (e) { next(e); }
  });

  app.get("/api/players/me", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.playerId) return res.status(404).json({ message: "No player profile linked" });
      const player = await storage.getPlayer(user.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      res.json(player);
    } catch (e) { next(e); }
  });

  app.get("/api/players/:id", requireAuth, async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ message: "Player not found" });
      res.json(player);
    } catch (e) { next(e); }
  });

  app.post("/api/players", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string().optional(), firstName: z.string(), lastName: z.string(),
        gender: z.string().optional(), jerseyNo: z.number().optional(), position: z.string().optional(),
        dob: z.string().optional(), phone: z.string().optional(), email: z.string().optional(),
        homeAddress: z.string().optional(), town: z.string().optional(), region: z.string().optional(),
        nationality: z.string().optional(), idNumber: z.string().optional(),
        nextOfKinName: z.string().optional(), nextOfKinRelation: z.string().optional(),
        nextOfKinPhone: z.string().optional(), nextOfKinAddress: z.string().optional(),
        emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(),
        medicalNotes: z.string().optional(), allergies: z.string().optional(), bloodGroup: z.string().optional(),
        photoUrl: z.string().optional(),
        status: z.enum(["ACTIVE","SUSPENDED","INJURED","SUSPENDED_CONTRACT"]).optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createPlayer(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/players/me", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.playerId) return res.status(404).json({ message: "No player profile linked" });

      const allowedFields = z.object({
        firstName: z.string().optional(), lastName: z.string().optional(),
        gender: z.string().optional(), dob: z.string().optional(),
        phone: z.string().optional(), email: z.string().optional(),
        homeAddress: z.string().optional(), town: z.string().optional(),
        region: z.string().optional(), nationality: z.string().optional(),
        idNumber: z.string().optional(),
        nextOfKinName: z.string().optional(), nextOfKinRelation: z.string().optional(),
        nextOfKinPhone: z.string().optional(), nextOfKinAddress: z.string().optional(),
        emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(),
        medicalNotes: z.string().optional(), allergies: z.string().optional(),
        bloodGroup: z.string().optional(), photoUrl: z.string().optional(),
      }).parse(req.body);

      const updated = await storage.updatePlayer(user.playerId, allowedFields);
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/players/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayer(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Player not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/players/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deletePlayer(req.params.id); res.status(204).send(); } catch (e) { next(e); }
  });

  app.post("/api/players/:id/photo", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.params.id;
      const userRole = req.user!.role;
      if (userRole === "PLAYER") {
        const u = await storage.getUser(req.user!.userId);
        if (u?.playerId !== playerId) return res.status(403).json({ message: "Access denied" });
      } else if (!["ADMIN","MANAGER","COACH"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { photoUrl } = z.object({ photoUrl: z.string() }).parse(req.body);
      const updated = await storage.updatePlayer(playerId, { photoUrl });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.post("/api/players/:id/profile/pdf", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.params.id;
      const userRole = req.user!.role;
      if (userRole === "PLAYER") {
        const u = await storage.getUser(req.user!.userId);
        if (u?.playerId !== playerId) return res.status(403).json({ message: "Access denied" });
      } else if (!["ADMIN","MANAGER","COACH"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      let teamName = "Unassigned";
      let teamCategory = "";
      let teamSeason = "";
      if (player.teamId) {
        const team = await storage.getTeam(player.teamId);
        if (team) { teamName = team.name; teamCategory = team.category; teamSeason = team.season; }
      }

      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Player Profile - ${player.firstName} ${player.lastName}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:30px;color:#1a1a1a}
.header{text-align:center;margin-bottom:30px;border-bottom:3px solid #006d5b;padding-bottom:20px}
.header h1{color:#006d5b;font-size:24px;margin:5px 0}
.header .motto{color:#d4a017;font-size:12px;letter-spacing:2px;text-transform:uppercase}
.photo-section{text-align:center;margin:20px 0}
.photo-section img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #006d5b}
.photo-placeholder{width:120px;height:120px;border-radius:50%;background:#e0e0e0;display:inline-flex;align-items:center;justify-content:center;font-size:36px;color:#888;border:3px solid #006d5b}
.jersey{background:#006d5b;color:white;display:inline-block;padding:4px 12px;border-radius:12px;font-weight:bold;font-size:14px;margin-top:8px}
.section{margin:20px 0}
.section h2{color:#006d5b;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{margin-bottom:4px}
.field label{font-weight:600;color:#555;font-size:11px;text-transform:uppercase}
.field span{display:block;font-size:13px;padding:2px 0}
.status-badge{display:inline-block;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:bold}
.status-ACTIVE{background:#d4edda;color:#155724}
.status-INJURED{background:#f8d7da;color:#721c24}
.status-SUSPENDED{background:#fff3cd;color:#856404}
.signatures{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-line{border-top:1px solid #333;padding-top:5px;text-align:center;font-size:11px;margin-top:60px}
@media print{body{padding:15px} .header h1{font-size:20px}}
</style></head><body>
<div class="header">
<h1>AFROCAT VOLLEYBALL CLUB</h1>
<div class="motto">One Team One Dream — Passion Discipline Victory</div>
<h2 style="margin-top:15px;font-size:18px;color:#333">Player Profile</h2>
</div>
<div class="photo-section">
${player.photoUrl ? `<img src="${esc(player.photoUrl)}" alt="Photo" />` : `<div class="photo-placeholder">${(player.firstName[0] || '').toUpperCase()}${(player.lastName[0] || '').toUpperCase()}</div>`}
${player.jerseyNo ? `<br/><span class="jersey">#${player.jerseyNo}</span>` : ''}
<h3 style="margin:10px 0 0">${esc(player.firstName)} ${esc(player.lastName)}</h3>
${player.position ? `<div style="color:#666;font-size:13px">${esc(player.position)}</div>` : ''}
<span class="status-badge status-${player.status}">${player.status}</span>
</div>
<div class="section"><h2>Personal Information</h2><div class="grid">
<div class="field"><label>Date of Birth</label><span>${esc(player.dob)}</span></div>
<div class="field"><label>Gender</label><span>${esc(player.gender)}</span></div>
<div class="field"><label>Nationality</label><span>${esc(player.nationality)}</span></div>
<div class="field"><label>ID/Passport</label><span>${esc(player.idNumber)}</span></div>
<div class="field"><label>Blood Group</label><span>${esc(player.bloodGroup)}</span></div>
</div></div>
<div class="section"><h2>Contact Details</h2><div class="grid">
<div class="field"><label>Phone</label><span>${esc(player.phone)}</span></div>
<div class="field"><label>Email</label><span>${esc(player.email)}</span></div>
<div class="field"><label>Address</label><span>${esc(player.homeAddress)}</span></div>
<div class="field"><label>Town</label><span>${esc(player.town)}</span></div>
<div class="field"><label>Region</label><span>${esc(player.region)}</span></div>
</div></div>
<div class="section"><h2>Next of Kin</h2><div class="grid">
<div class="field"><label>Name</label><span>${esc(player.nextOfKinName)}</span></div>
<div class="field"><label>Relation</label><span>${esc(player.nextOfKinRelation)}</span></div>
<div class="field"><label>Phone</label><span>${esc(player.nextOfKinPhone)}</span></div>
<div class="field"><label>Address</label><span>${esc(player.nextOfKinAddress)}</span></div>
</div></div>
<div class="section"><h2>Emergency Contact</h2><div class="grid">
<div class="field"><label>Name</label><span>${esc(player.emergencyContactName)}</span></div>
<div class="field"><label>Phone</label><span>${esc(player.emergencyContactPhone)}</span></div>
</div></div>
<div class="section"><h2>Medical</h2><div class="grid">
<div class="field"><label>Medical Notes</label><span>${esc(player.medicalNotes)}</span></div>
<div class="field"><label>Allergies</label><span>${esc(player.allergies)}</span></div>
</div></div>
<div class="section"><h2>Team Information</h2><div class="grid">
<div class="field"><label>Team</label><span>${esc(teamName)}</span></div>
<div class="field"><label>Category</label><span>${teamCategory || '—'}</span></div>
<div class="field"><label>Season</label><span>${teamSeason || '—'}</span></div>
</div></div>
<div class="signatures">
<div><div class="sig-line">Player Signature / Date</div></div>
<div><div class="sig-line">Club Official Signature / Date</div></div>
</div>
</body></html>`;

      const doc = await storage.createPlayerDocument({
        playerId,
        documentType: "PLAYER_PROFILE",
        fileUrl: `/player-profile-${playerId}-${Date.now()}.html`,
        metadata: { html: htmlContent, generatedAt: new Date().toISOString() },
      });

      res.json({ documentId: doc.id, html: htmlContent });
    } catch (e) { next(e); }
  });

  app.get("/api/player-documents/:playerId", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.params.playerId;
      const userRole = req.user!.role;
      if (userRole === "PLAYER") {
        const u = await storage.getUser(req.user!.userId);
        if (u?.playerId !== playerId) return res.status(403).json({ message: "Access denied" });
      } else if (!["ADMIN","MANAGER","COACH"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(await storage.getPlayerDocuments(playerId));
    } catch (e) { next(e); }
  });

  // ─── MATCHES ─────────────────────────────────────
  app.get("/api/matches", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getMatches()); } catch (e) { next(e); }
  });

  app.get("/api/matches/:id", requireAuth, async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      res.json(match);
    } catch (e) { next(e); }
  });

  app.post("/api/matches", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(), opponent: z.string(), matchDate: z.string(),
        venue: z.string(), competition: z.string(),
        result: z.enum(["W","L"]).optional().nullable(),
        setsFor: z.number().optional(), setsAgainst: z.number().optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const match = await storage.createMatch(body);
      if (match.result) {
        await recomputeCoachPerformance(match.teamId, match.matchDate);
      }
      res.status(201).json(match);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/matches/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const updated = await storage.updateMatch(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Match not found" });
      if (updated.result) {
        await recomputeCoachPerformance(updated.teamId, updated.matchDate);
      }
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/matches/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteMatch(req.params.id); res.status(204).send(); } catch (e) { next(e); }
  });

  // ─── STATS ───────────────────────────────────────
  app.get("/api/stats/match/:matchId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getStatsByMatch(req.params.matchId)); } catch (e) { next(e); }
  });

  app.get("/api/stats/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getStatsByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  app.post("/api/stats/match/:matchId", requireAuth, requireRole(["ADMIN","MANAGER","STATISTICIAN","COACH"]), async (req, res, next) => {
    try {
      const matchId = req.params.matchId;
      const statsArray = z.array(z.object({
        playerId: z.string(),
        spikesKill: z.number().default(0), spikesError: z.number().default(0),
        servesAce: z.number().default(0), servesError: z.number().default(0),
        blocksSolo: z.number().default(0), blocksAssist: z.number().default(0),
        receivePerfect: z.number().default(0), receiveError: z.number().default(0),
        digs: z.number().default(0), settingAssist: z.number().default(0), settingError: z.number().default(0),
        minutesPlayed: z.number().default(0),
      })).parse(req.body);

      const results = [];
      for (const stat of statsArray) {
        const pointsTotal =
          (stat.spikesKill * 2) + (stat.servesAce * 2) + (stat.blocksSolo * 2) +
          stat.blocksAssist + stat.digs + stat.settingAssist -
          (stat.spikesError * 2) - (stat.servesError * 2) - (stat.receiveError * 2) - (stat.settingError * 2);

        const saved = await storage.upsertStat({ ...stat, matchId, pointsTotal });
        results.push(saved);

        const player = await storage.getPlayer(stat.playerId);
        const focusAreas: string[] = [];
        if (stat.servesError >= 3) focusAreas.push("Serving consistency");
        if (stat.spikesError >= 3) focusAreas.push("Attack control");
        if (stat.receiveError >= 3) focusAreas.push("Serve reception");
        if (stat.settingError >= 3) focusAreas.push("Setting accuracy");
        if (player && player.position.toLowerCase().includes("middle") && (stat.blocksSolo + stat.blocksAssist) < 2) {
          focusAreas.push("Blocking timing");
        }
        if (focusAreas.length > 0) {
          await storage.createSmartFocus({ playerId: stat.playerId, matchId, focusAreas });
        }
      }
      res.json(results);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── SMART FOCUS ─────────────────────────────────
  app.get("/api/smart-focus/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getSmartFocusByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  // ─── ATTENDANCE ──────────────────────────────────
  app.get("/api/attendance/sessions", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getAttendanceSessions(req.query.teamId as string | undefined)); } catch (e) { next(e); }
  });

  app.post("/api/attendance/sessions", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(), sessionDate: z.string(),
        sessionType: z.enum(["TRAINING","MATCH","GYM"]), notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createAttendanceSession(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/attendance/sessions/:id/records", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getAttendanceRecords(req.params.id)); } catch (e) { next(e); }
  });

  app.post("/api/attendance/sessions/:id/records", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const records = z.array(z.object({
        playerId: z.string(),
        status: z.enum(["PRESENT","LATE","ABSENT","EXCUSED"]),
        reason: z.string().optional().nullable(),
      })).parse(req.body);

      const results = [];
      for (const rec of records) {
        const saved = await storage.createAttendanceRecord({ ...rec, sessionId });
        results.push(saved);

        if (rec.status === "ABSENT") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const sinceStr = thirtyDaysAgo.toISOString().split("T")[0];
          const absentCount = await storage.getPlayerAbsentCount(rec.playerId, sinceStr);
          if (absentCount >= 3) {
            await storage.createDisciplineCase({
              playerId: rec.playerId,
              caseType: "Attendance warning",
              description: `Player has ${absentCount} absences in the last 30 days`,
              points: absentCount,
              actionTaken: "Review required by coaching staff",
              caseDate: new Date().toISOString().split("T")[0],
            });
          }
        }
      }
      res.json(results);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/attendance/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getAttendanceRecordsByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  // ─── DISCIPLINE ──────────────────────────────────
  app.get("/api/discipline", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getDisciplineCases(req.query.playerId as string | undefined)); } catch (e) { next(e); }
  });

  // ─── FINANCE ─────────────────────────────────────
  app.get("/api/finance", requireAuth, requireRole(["ADMIN","MANAGER","FINANCE"]), async (_req, res, next) => {
    try { res.json(await storage.getFinanceTxns()); } catch (e) { next(e); }
  });

  app.post("/api/finance", requireAuth, requireRole(["ADMIN","MANAGER","FINANCE"]), async (req, res, next) => {
    try {
      const body = z.object({
        txnDate: z.string(), type: z.enum(["INCOME","EXPENSE"]),
        category: z.string(), amount: z.number(), description: z.string(),
        reference: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createFinanceTxn({ ...body, createdByUserId: req.user!.userId }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/finance/:id", requireAuth, requireRole(["ADMIN","MANAGER","FINANCE"]), async (req, res, next) => {
    try { await storage.deleteFinanceTxn(req.params.id); res.status(204).send(); } catch (e) { next(e); }
  });

  // ─── INJURIES ────────────────────────────────────
  app.get("/api/injuries", requireAuth, requireRole(["ADMIN","MANAGER","MEDICAL","COACH"]), async (_req, res, next) => {
    try { res.json(await storage.getInjuries()); } catch (e) { next(e); }
  });

  app.get("/api/injuries/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getInjuriesByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  app.post("/api/injuries", requireAuth, requireRole(["ADMIN","MANAGER","MEDICAL"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(), injuryType: z.string(),
        severity: z.enum(["LOW","MEDIUM","HIGH"]),
        startDate: z.string(),
      }).parse(req.body);
      const injury = await storage.createInjury({ ...body, status: "OPEN" });
      await storage.updatePlayer(body.playerId, { status: "INJURED" });
      res.status(201).json(injury);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/injuries/:id/clear", requireAuth, requireRole(["ADMIN","MEDICAL"]), async (req, res, next) => {
    try {
      const injury = await storage.getInjury(req.params.id);
      if (!injury) return res.status(404).json({ message: "Injury not found" });
      const updated = await storage.updateInjury(req.params.id, {
        status: "CLEARED",
        clearanceNote: req.body.clearanceNote || "Cleared",
        clearedByUserId: req.user!.userId,
      });
      await storage.updatePlayer(injury.playerId, { status: "ACTIVE" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── AWARDS ──────────────────────────────────────
  app.get("/api/awards", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getAwards()); } catch (e) { next(e); }
  });

  app.get("/api/awards/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getAwardsByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  app.post("/api/awards", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(),
        awardType: z.enum(["MVP","MOST_IMPROVED","BEST_SERVER","BEST_BLOCKER","COACH_AWARD"]),
        awardMonth: z.string(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createAward(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── COACH ASSIGNMENTS ──────────────────────────
  app.get("/api/coach-assignments", requireAuth, requireRole(["ADMIN","MANAGER"]), async (_req, res, next) => {
    try { res.json(await storage.getCoachAssignments()); } catch (e) { next(e); }
  });

  app.get("/api/coach-assignments/team/:teamId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try { res.json(await storage.getCoachAssignmentsByTeam(req.params.teamId)); } catch (e) { next(e); }
  });

  app.post("/api/coach-assignments", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        coachUserId: z.string(),
        teamId: z.string(),
        assignmentRole: z.enum(["HEAD_COACH","ASSISTANT_COACH"]),
        startDate: z.string(),
        endDate: z.string().optional().nullable(),
        active: z.boolean().optional(),
      }).parse(req.body);
      const created = await storage.createCoachAssignment(body);
      const teamMatches = await storage.getMatchesByTeam(body.teamId);
      for (const m of teamMatches) {
        if (m.result) await recomputeCoachPerformance(m.teamId, m.matchDate);
      }
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/coach-assignments/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateCoachAssignment(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Assignment not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── COACH PERFORMANCE ──────────────────────────
  app.get("/api/coaches/:id/performance", requireAuth, async (req, res, next) => {
    try {
      const snap = await storage.getCoachPerformance(req.params.id);
      if (!snap) {
        return res.json({ coachUserId: req.params.id, matches: 0, wins: 0, winRate: 0, stars: 0, provisional: true });
      }
      res.json({ ...snap, provisional: snap.matches < 5 });
    } catch (e) { next(e); }
  });

  // ─── PLAYER CONTRACTS ──────────────────────────
  app.get("/api/contracts/player/:playerId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const contracts = await storage.getPlayerContracts(req.params.playerId);
      const today = new Date().toISOString().split("T")[0];
      const enriched = contracts.map((c: any) => {
        const daysToExpiry = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const renewalWarning = c.status === "ACTIVE" && daysToExpiry <= 60 && daysToExpiry > 0;
        const isExpired = c.status === "ACTIVE" && c.endDate < today;
        return { ...c, daysToExpiry, renewalWarning, isExpired };
      });
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.post("/api/contracts", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(),
        contractType: z.enum(["PERMANENT","SEASONAL","TRIAL","YOUTH"]),
        startDate: z.string(),
        endDate: z.string(),
        signOnFee: z.number().optional().nullable(),
        weeklyTransport: z.number().optional().nullable(),
        salaryAmount: z.number().optional().nullable(),
        obligations: z.string().optional().nullable(),
        status: z.enum(["DRAFT","ACTIVE","EXPIRED","TERMINATED"]).optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createPlayerContract({ ...body, createdByUserId: req.user!.userId }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/contracts/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerContract(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Contract not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/approve", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerContract(req.params.id, {
        status: "ACTIVE",
        approvedByUserId: req.user!.userId,
      });
      if (!updated) return res.status(404).json({ message: "Contract not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/terminate", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const contract = await storage.getPlayerContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      const updated = await storage.updatePlayerContract(req.params.id, { status: "TERMINATED" });
      await storage.updatePlayer(contract.playerId, { status: "SUSPENDED_CONTRACT" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── TEAM OFFICIALS ────────────────────────────
  app.get("/api/team-officials/:teamId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getTeamOfficials(req.params.teamId)); } catch (e) { next(e); }
  });

  app.post("/api/team-officials", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(),
        role: z.enum(["HEAD_COACH","ASSISTANT_COACH","TRAINER","TEAM_MANAGER","PHYSIOTHERAPIST","MEDIC"]),
        name: z.string().min(1),
      }).parse(req.body);
      res.status(201).json(await storage.createTeamOfficial(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/team-officials/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteTeamOfficial(req.params.id); res.status(204).send(); } catch (e) { next(e); }
  });

  // ─── MATCH DOCUMENTS ───────────────────────────
  app.get("/api/match-documents", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      res.json(await storage.getMatchDocuments(
        req.query.matchId as string | undefined,
        req.query.teamId as string | undefined
      ));
    } catch (e) { next(e); }
  });

  app.post("/api/match-documents", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        matchId: z.string().optional().nullable(),
        teamId: z.string().optional().nullable(),
        documentType: z.enum(["O2BIS","MATCH_REPORT","REFEREE_FORM","SCOUTING_FORM"]),
        fileUrl: z.string(),
        metadata: z.record(z.any()).optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createMatchDocument(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── O-2BIS GENERATION ─────────────────────────
  app.post("/api/o2bis/generate", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(),
        matchId: z.string().optional().nullable(),
        opponent: z.string(),
        matchDate: z.string(),
        matchTime: z.string().optional(),
        venue: z.string(),
        competition: z.string(),
        coachName: z.string().optional(),
        selectedPlayerIds: z.array(z.string()).optional(),
      }).parse(req.body);

      const team = await storage.getTeam(body.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      let playerList;
      if (body.selectedPlayerIds && body.selectedPlayerIds.length > 0) {
        const allPlayers = await storage.getPlayersByTeam(body.teamId);
        playerList = allPlayers.filter(p => body.selectedPlayerIds!.includes(p.id));
      } else {
        const allPlayers = await storage.getPlayersByTeam(body.teamId);
        playerList = allPlayers.filter(p => p.status === "ACTIVE");
      }

      const officials = await storage.getTeamOfficials(body.teamId);

      const o2bisData = {
        clubName: "AFROCAT VOLLEYBALL CLUB",
        teamName: team.name,
        opponent: body.opponent,
        matchDate: body.matchDate,
        matchTime: body.matchTime || "",
        venue: body.venue,
        competition: body.competition,
        coachName: body.coachName || "",
        players: playerList.map(p => ({
          jerseyNo: p.jerseyNo,
          name: `${p.lastName} ${p.firstName}`,
          position: p.position,
          dob: p.dob || "",
        })),
        officials: officials.map(o => ({ role: o.role, name: o.name })),
      };

      const docRecord = await storage.createMatchDocument({
        matchId: body.matchId || null,
        teamId: body.teamId,
        documentType: "O2BIS",
        fileUrl: `/api/o2bis/view/${Date.now()}`,
        metadata: o2bisData,
      });

      res.status(201).json({ documentId: docRecord.id, fileUrl: docRecord.fileUrl, data: o2bisData });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── MATCH REPORT PDF GENERATION ────────────
  app.post("/api/reports/match/:matchId/pdf", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const matchId = req.params.matchId;
      const bodySchema = z.object({ teamId: z.string().optional() });
      const { teamId: bodyTeamId } = bodySchema.parse(req.body || {});

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const teamId = bodyTeamId || match.teamId;
      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const stats = await storage.getStatsByMatch(matchId);
      if (stats.length === 0) return res.status(400).json({ message: "No stats recorded for this match" });

      const players = await storage.getPlayersByTeam(teamId);
      const playerMap = new Map(players.map(p => [p.id, p]));

      const assignments = await storage.getCoachAssignmentsByTeam(teamId);
      const headCoach = assignments.find(a => a.assignmentRole === "HEAD_COACH" && a.active);
      let coachName = "";
      if (headCoach) {
        const coachUser = await storage.getUser(headCoach.coachUserId);
        coachName = coachUser?.fullName || "";
      }

      const enrichedStats = stats.map(s => {
        const player = playerMap.get(s.playerId);
        return {
          ...s,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          jerseyNo: player?.jerseyNo ?? 0,
          position: player?.position ?? "",
        };
      }).sort((a, b) => (b.pointsTotal || 0) - (a.pointsTotal || 0));

      const teamTotals = {
        spikesKill: enrichedStats.reduce((sum, s) => sum + (s.spikesKill || 0), 0),
        spikesError: enrichedStats.reduce((sum, s) => sum + (s.spikesError || 0), 0),
        servesAce: enrichedStats.reduce((sum, s) => sum + (s.servesAce || 0), 0),
        servesError: enrichedStats.reduce((sum, s) => sum + (s.servesError || 0), 0),
        blocksSolo: enrichedStats.reduce((sum, s) => sum + (s.blocksSolo || 0), 0),
        blocksAssist: enrichedStats.reduce((sum, s) => sum + (s.blocksAssist || 0), 0),
        receivePerfect: enrichedStats.reduce((sum, s) => sum + (s.receivePerfect || 0), 0),
        receiveError: enrichedStats.reduce((sum, s) => sum + (s.receiveError || 0), 0),
        digs: enrichedStats.reduce((sum, s) => sum + (s.digs || 0), 0),
        settingAssist: enrichedStats.reduce((sum, s) => sum + (s.settingAssist || 0), 0),
        settingError: enrichedStats.reduce((sum, s) => sum + (s.settingError || 0), 0),
        pointsTotal: enrichedStats.reduce((sum, s) => sum + (s.pointsTotal || 0), 0),
      };

      const topPerformers = enrichedStats.slice(0, 5);

      const errorStats = enrichedStats.map(s => ({
        ...s,
        totalErrors: (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0),
      })).sort((a, b) => b.totalErrors - a.totalErrors).slice(0, 5);

      const allSmartFocus: any[] = [];
      for (const s of stats) {
        const sf = await storage.getSmartFocusByPlayer(s.playerId);
        const matchSf = sf.filter(f => f.matchId === matchId);
        for (const f of matchSf) {
          const player = playerMap.get(s.playerId);
          allSmartFocus.push({
            playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
            focusAreas: f.focusAreas,
          });
        }
      }

      const reportData = {
        clubName: "AFROCAT VOLLEYBALL CLUB",
        motto: "One Team One Dream — Passion Discipline Victory",
        teamName: team.name,
        opponent: match.opponent,
        matchDate: match.matchDate,
        venue: match.venue,
        competition: match.competition,
        result: match.result,
        setsFor: match.setsFor,
        setsAgainst: match.setsAgainst,
        coachName,
        teamTotals,
        topPerformers: topPerformers.map(s => ({
          jerseyNo: s.jerseyNo,
          name: s.playerName,
          position: s.position,
          pointsTotal: s.pointsTotal || 0,
          spikesKill: s.spikesKill || 0,
          servesAce: s.servesAce || 0,
          blocks: (s.blocksSolo || 0) + (s.blocksAssist || 0),
          digs: s.digs || 0,
          settingAssist: s.settingAssist || 0,
        })),
        errorLeaders: errorStats.map(s => ({
          jerseyNo: s.jerseyNo,
          name: s.playerName,
          position: s.position,
          totalErrors: s.totalErrors,
          spikesError: s.spikesError || 0,
          servesError: s.servesError || 0,
          receiveError: s.receiveError || 0,
          settingError: s.settingError || 0,
        })),
        smartFocus: allSmartFocus,
        allPlayerStats: enrichedStats.map(s => ({
          jerseyNo: s.jerseyNo,
          name: s.playerName,
          position: s.position,
          pointsTotal: s.pointsTotal || 0,
          spikesKill: s.spikesKill || 0,
          servesAce: s.servesAce || 0,
          blocks: (s.blocksSolo || 0) + (s.blocksAssist || 0),
          digs: s.digs || 0,
          settingAssist: s.settingAssist || 0,
        })),
      };

      const docRecord = await storage.createMatchDocument({
        matchId,
        teamId,
        documentType: "MATCH_REPORT",
        fileUrl: `/api/reports/match/${matchId}/view/${Date.now()}`,
        metadata: reportData,
      });

      for (const s of stats) {
        await storage.createPlayerReport({
          playerId: s.playerId,
          reportType: "MATCH_REPORT",
          pdfUrl: docRecord.fileUrl,
          generatedDate: new Date().toISOString().split("T")[0],
        });
      }

      res.status(201).json({ documentId: docRecord.id, fileUrl: docRecord.fileUrl, data: reportData });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── STARTING 12 SQUAD SELECTOR ──────────────
  app.get("/api/squad/eligibility/:teamId", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const players = await storage.getPlayersByTeam(req.params.teamId);
      const injuries = await storage.getInjuries();
      const contracts = await storage.getAllContracts();

      const enriched = players.map(p => {
        const reasons: string[] = [];
        if (p.status !== "ACTIVE") reasons.push(`Status: ${p.status}`);
        if (p.eligibilityStatus === "NOT_ELIGIBLE") reasons.push(p.eligibilityNotes || "Marked ineligible");
        const openInjury = injuries.find(i => i.playerId === p.id && i.status === "OPEN");
        if (openInjury) reasons.push(`Injury: ${openInjury.injuryType}`);
        const activeContract = contracts.find(c => c.playerId === p.id && c.status === "ACTIVE");
        if (!activeContract) reasons.push("No active contract");
        return {
          ...p,
          eligible: reasons.length === 0,
          ineligibilityReasons: reasons,
        };
      });
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/squad/:matchId/:teamId", requireAuth, async (req, res, next) => {
    try {
      const squad = await storage.getMatchSquad(req.params.matchId, req.params.teamId);
      if (!squad) return res.json({ squad: null, entries: [] });
      const entries = await storage.getMatchSquadEntries(squad.id);
      res.json({ squad, entries });
    } catch (e) { next(e); }
  });

  app.post("/api/squad", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        matchId: z.string(),
        teamId: z.string(),
        playerIds: z.array(z.string()).min(1).max(12),
      }).parse(req.body);

      const teamPlayers = await storage.getPlayersByTeam(body.teamId);
      const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
      const invalidIds = body.playerIds.filter(id => !teamPlayerIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ message: "Some players do not belong to this team" });
      }

      const injuries = await storage.getInjuries();
      const contracts = await storage.getAllContracts();
      const ineligible = body.playerIds.filter(pid => {
        const p = teamPlayers.find(tp => tp.id === pid)!;
        if (p.status !== "ACTIVE") return true;
        if (p.eligibilityStatus === "NOT_ELIGIBLE") return true;
        if (injuries.some(i => i.playerId === pid && i.status === "OPEN")) return true;
        if (!contracts.some(c => c.playerId === pid && c.status === "ACTIVE")) return true;
        return false;
      });
      if (ineligible.length > 0) {
        return res.status(400).json({ message: "Some selected players are not eligible" });
      }

      const existing = await storage.getMatchSquad(body.matchId, body.teamId);
      if (existing) {
        await storage.deleteMatchSquad(existing.id);
      }

      const squad = await storage.createMatchSquad({
        matchId: body.matchId,
        teamId: body.teamId,
        createdByUserId: req.user!.userId,
      });

      const entries = [];
      for (const pid of body.playerIds) {
        const player = teamPlayers.find(p => p.id === pid);
        const entry = await storage.createMatchSquadEntry({
          squadId: squad.id,
          playerId: pid,
          jerseyNo: player?.jerseyNo || null,
        });
        entries.push(entry);
      }

      res.status(201).json({ squad, entries });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── DASHBOARD ─────────────────────────────────
  app.get("/api/dashboard/coach/summary", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ message: "teamId query parameter is required" });

      const matches = await storage.getMatchesByTeam(teamId);
      const last5Matches = matches.slice(0, 5);

      const players = await storage.getPlayersByTeam(teamId);
      const playerMap = new Map(players.map(p => [p.id, p]));

      let latestMatchTotals: Record<string, number> = {};
      let topPerformers: any[] = [];
      let errorLeaders: any[] = [];

      if (last5Matches.length > 0) {
        const latestMatchStats = await storage.getStatsByMatch(last5Matches[0].id);

        latestMatchTotals = {
          spikesKill: 0, spikesError: 0, servesAce: 0, servesError: 0,
          blocksSolo: 0, blocksAssist: 0, receivePerfect: 0, receiveError: 0,
          digs: 0, settingAssist: 0, settingError: 0, pointsTotal: 0,
        };
        for (const s of latestMatchStats) {
          latestMatchTotals.spikesKill += s.spikesKill ?? 0;
          latestMatchTotals.spikesError += s.spikesError ?? 0;
          latestMatchTotals.servesAce += s.servesAce ?? 0;
          latestMatchTotals.servesError += s.servesError ?? 0;
          latestMatchTotals.blocksSolo += s.blocksSolo ?? 0;
          latestMatchTotals.blocksAssist += s.blocksAssist ?? 0;
          latestMatchTotals.receivePerfect += s.receivePerfect ?? 0;
          latestMatchTotals.receiveError += s.receiveError ?? 0;
          latestMatchTotals.digs += s.digs ?? 0;
          latestMatchTotals.settingAssist += s.settingAssist ?? 0;
          latestMatchTotals.settingError += s.settingError ?? 0;
          latestMatchTotals.pointsTotal += s.pointsTotal ?? 0;
        }

        const allStats: any[] = [];
        for (const m of last5Matches) {
          const mStats = m.id === last5Matches[0].id ? latestMatchStats : await storage.getStatsByMatch(m.id);
          allStats.push(...mStats);
        }

        const playerPointsMap = new Map<string, number>();
        const playerErrorsMap = new Map<string, number>();
        for (const s of allStats) {
          playerPointsMap.set(s.playerId, (playerPointsMap.get(s.playerId) || 0) + (s.pointsTotal ?? 0));
          const totalErrors = (s.spikesError ?? 0) + (s.servesError ?? 0) + (s.receiveError ?? 0) + (s.settingError ?? 0);
          playerErrorsMap.set(s.playerId, (playerErrorsMap.get(s.playerId) || 0) + totalErrors);
        }

        topPerformers = Array.from(playerPointsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([playerId, points]) => {
            const p = playerMap.get(playerId);
            return {
              playerId,
              name: p ? `${p.firstName} ${p.lastName}` : "Unknown",
              jerseyNo: p?.jerseyNo,
              position: p?.position,
              pointsTotal: points,
            };
          });

        errorLeaders = Array.from(playerErrorsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([playerId, errors]) => {
            const p = playerMap.get(playerId);
            return {
              playerId,
              name: p ? `${p.firstName} ${p.lastName}` : "Unknown",
              jerseyNo: p?.jerseyNo,
              position: p?.position,
              totalErrors: errors,
            };
          });
      }

      const smartFocusMap = new Map<string, number>();
      for (const p of players) {
        const focuses = await storage.getSmartFocusByPlayer(p.id);
        for (const f of focuses) {
          if (Array.isArray(f.focusAreas)) {
            for (const area of f.focusAreas) {
              smartFocusMap.set(area, (smartFocusMap.get(area) || 0) + 1);
            }
          }
        }
      }
      const smartFocusHighlights = Array.from(smartFocusMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([area, count]) => ({ area, count }));

      res.json({
        last5Matches: last5Matches.map(m => ({
          id: m.id, opponent: m.opponent, matchDate: m.matchDate,
          result: m.result, setsFor: m.setsFor, setsAgainst: m.setsAgainst,
          venue: m.venue, competition: m.competition,
        })),
        latestMatchTotals,
        topPerformers,
        errorLeaders,
        smartFocusHighlights,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/players/:playerId/dashboard", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.params.playerId;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      if (userRole === "PLAYER") {
        const user = await storage.getUser(userId);
        if (!user || user.playerId !== playerId) {
          return res.status(403).json({ message: "You can only view your own dashboard" });
        }
      } else if (!["ADMIN", "MANAGER", "COACH"].includes(userRole)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      const allStats = await storage.getStatsByPlayer(playerId);
      const matches = await storage.getMatches();
      const matchMap = new Map(matches.map(m => [m.id, m]));

      const statsWithMatch = allStats
        .map(s => {
          const m = matchMap.get(s.matchId);
          return {
            ...s,
            matchDate: m?.matchDate,
            opponent: m?.opponent,
            result: m?.result,
            venue: m?.venue,
            competition: m?.competition,
          };
        })
        .sort((a, b) => (b.matchDate || "").localeCompare(a.matchDate || ""))
        .slice(0, 10);

      const performanceTrend = statsWithMatch
        .slice()
        .reverse()
        .map(s => ({
          matchId: s.matchId,
          matchDate: s.matchDate,
          opponent: s.opponent,
          pointsTotal: s.pointsTotal ?? 0,
        }));

      const smartFocusHistory = await storage.getSmartFocusByPlayer(playerId);

      const attendanceRecords = await storage.getAttendanceRecordsByPlayer(playerId);
      const attendanceSummary = {
        total: attendanceRecords.length,
        present: attendanceRecords.filter(r => r.status === "PRESENT").length,
        late: attendanceRecords.filter(r => r.status === "LATE").length,
        absent: attendanceRecords.filter(r => r.status === "ABSENT").length,
        excused: attendanceRecords.filter(r => r.status === "EXCUSED").length,
      };

      const injuries = await storage.getInjuriesByPlayer(playerId);
      const openInjury = injuries.find(i => i.status === "OPEN");

      const contracts = await storage.getPlayerContracts(playerId);
      const activeContract = contracts.find((c: any) => c.status === "ACTIVE");

      res.json({
        player: {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          jerseyNo: player.jerseyNo,
          position: player.position,
          status: player.status,
          photoUrl: player.photoUrl,
          teamId: player.teamId,
        },
        recentStats: statsWithMatch,
        performanceTrend,
        smartFocusHistory: smartFocusHistory.map(f => ({
          id: f.id,
          matchId: f.matchId,
          focusAreas: f.focusAreas,
          generatedAt: f.generatedAt,
          opponent: matchMap.get(f.matchId)?.opponent,
          matchDate: matchMap.get(f.matchId)?.matchDate,
        })),
        attendanceSummary,
        injuryStatus: openInjury ? {
          injuryType: openInjury.injuryType,
          severity: openInjury.severity,
          startDate: openInjury.startDate,
          status: openInjury.status,
        } : null,
        activeContract: activeContract ? {
          contractType: activeContract.contractType,
          startDate: activeContract.startDate,
          endDate: activeContract.endDate,
          status: activeContract.status,
        } : null,
      });
    } catch (e) { next(e); }
  });

  app.delete("/api/squad/:matchId/:teamId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const existing = await storage.getMatchSquad(req.params.matchId, req.params.teamId);
      if (!existing) return res.status(404).json({ message: "Squad not found" });
      await storage.deleteMatchSquad(existing.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return httpServer;
}
