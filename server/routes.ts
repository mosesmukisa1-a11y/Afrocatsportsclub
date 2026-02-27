import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePassword, signToken, requireAuth, requireRole } from "./auth";
import { z } from "zod";

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
      const user = await storage.createUser({
        fullName: body.fullName,
        email: body.email,
        passwordHash,
        role: "PLAYER",
      });

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      return res.status(201).json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
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
        teamId: z.string(), firstName: z.string(), lastName: z.string(),
        gender: z.string(), jerseyNo: z.number(), position: z.string(),
        dob: z.string().optional(), phone: z.string().optional(),
        status: z.enum(["ACTIVE","SUSPENDED","INJURED","SUSPENDED_CONTRACT"]).optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createPlayer(body));
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
        if (openInjury) reasons.push(`Injury: ${openInjury.description || openInjury.type}`);
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
