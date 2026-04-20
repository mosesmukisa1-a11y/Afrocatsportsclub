import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { hashPassword, comparePassword, signToken, requireAuth, requireRole } from "./auth";
import { z } from "zod";
import crypto from "crypto";
import cron from "node-cron";
import { eq, and, desc, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ALL_ENUMS, SKILL_TYPES, OUTCOME } from "./devstats/enums";
import { generateDevelopmentReport } from "./devstats/report";
import { generateO2BISPdf, validateLiberoRule, autoSelectLiberos } from "./o2bis";
import { normalizeMatchStatus, addCountdown, enrichMatch } from "./match-utils";

const TRAINING_SCHEDULE: Record<string, number[]> = {
  MEN: [2, 4],    // Tuesday=2, Thursday=4
  WOMEN: [1, 3],  // Monday=1, Wednesday=3
  ALL: [5],       // Friday=5
};

const TEAM_GENDER_RULES: Record<string, string> = {
  "Afrocat D": "MALE",
  "Afrocat C": "MALE",
  "Afrocat E": "MALE",
  "Afrocat V": "MALE",
  "Afrocat Ladies": "FEMALE",
  "Afrocat Titans": "FEMALE",
};

function validateTeamGender(teamName: string, gender: string): { ok: boolean; error?: string } {
  const reqGender = TEAM_GENDER_RULES[teamName];
  if (!reqGender) return { ok: true };
  if (reqGender !== gender) return { ok: false, error: `${teamName} is ${reqGender} only.` };
  return { ok: true };
}

function calcAge(dobISO: string | null | undefined): number | null {
  if (!dobISO) return null;
  const dob = new Date(dobISO);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function getQuarterKey(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

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
  await recomputeCoachPerformanceByCoach(assignment.coachUserId);
}

async function recomputeCoachPerformanceByCoach(coachUserId: string) {
  // Look at ALL head-coach assignments for this coach across ALL teams
  const allAssignments = await storage.getCoachAssignmentsByCoach(coachUserId);
  const headAssignments = allAssignments.filter(a => a.assignmentRole === "HEAD_COACH");

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

  await storage.upsertCoachPerformance({ coachUserId, matches: totalMatches, wins: totalWins, winRate, stars });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "afrocat", time: new Date().toISOString() }));

  app.get("/api/health/modules", async (_req, res) => {
    const modules: Record<string, boolean> = {};
    const errors: Record<string, string> = {};
    const checks: [string, () => Promise<any>][] = [
      ["teams", () => db.select({ count: sql`count(*)` }).from(schema.teams)],
      ["players", () => db.select({ count: sql`count(*)` }).from(schema.players)],
      ["matches", () => db.select({ count: sql`count(*)` }).from(schema.matches)],
      ["media", () => db.select({ count: sql`count(*)` }).from(schema.mediaPosts)],
      ["financeFeeConfig", () => db.select({ count: sql`count(*)` }).from(schema.feeConfig)],
      ["notifications", () => db.select({ count: sql`count(*)` }).from(schema.notifications)],
      ["chatRooms", () => db.select({ count: sql`count(*)` }).from(schema.chatMessages)],
      ["notices", () => db.select({ count: sql`count(*)` }).from(schema.noticeBoardPosts)],
    ];
    for (const [name, check] of checks) {
      try {
        await check();
        modules[name] = true;
      } catch (e: any) {
        modules[name] = false;
        errors[name] = e.message || "Unknown error";
      }
    }
    res.json({ ok: Object.values(modules).every(Boolean), modules, errors: Object.keys(errors).length > 0 ? errors : undefined });
  });

  app.get("/api/health/env", (_req, res) => {
    const env: Record<string, boolean> = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      GMAIL_USER: !!process.env.GMAIL_USER,
      GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
      EMAIL_AUTO_CC: !!process.env.EMAIL_AUTO_CC,
      VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    };
    const dbMissing = !process.env.DATABASE_URL;
    res.json({ ok: !dbMissing, env, ...(dbMissing ? { error: "DATABASE_URL is not configured — database will not function" } : {}) });
  });

  app.post("/api/log/client-error", (req, res) => {
    const { message, stack, userId, route, componentStack } = req.body || {};
    console.error("[CLIENT ERROR]", {
      message: message || "Unknown error",
      stack: stack || "",
      componentStack: componentStack || "",
      userId: userId || null,
      route: route || "",
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  // ─── AUTH ────────────────────────────────────────
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const body = z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        phone: z.string().min(1, "Phone number is required"),
        dob: z.string().min(1, "Date of birth is required"),
        nationality: z.string().min(1, "Nationality is required"),
        gender: z.enum(["MALE", "FEMALE"], { required_error: "Gender is required" }),
        photo: z.string().min(1, "Profile photo is required"),
        idNumber: z.string().optional(),
        heightCm: z.number().int().min(50).max(250).optional(),
        weightKg: z.number().int().min(20).max(200).optional(),
        role: z.enum(["PLAYER", "COACH", "STATISTICIAN", "MEDICAL", "FINANCE"]).optional().default("PLAYER"),
        requestedTeamId: z.string().optional(),
        requestedPosition: z.enum(["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"]).optional(),
        requestedJerseyNo: z.number().int().min(1).max(99).optional(),
        contractAccepted: z.boolean().optional().default(false),
      }).parse(req.body);

      const existing = await storage.getUserByEmail(body.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      if (body.role === "PLAYER" && body.requestedTeamId && body.gender) {
        const team = await storage.getTeam(body.requestedTeamId);
        if (team) {
          const gv = validateTeamGender(team.name, body.gender);
          if (!gv.ok) return res.status(400).json({ message: gv.error });
        }
      }

      const settings = await storage.getSecuritySettings();

      if (settings?.allowedEmailDomains) {
        const domains = settings.allowedEmailDomains.split(",").map(d => d.trim().toLowerCase());
        const emailDomain = body.email.split("@")[1]?.toLowerCase();
        if (domains.length > 0 && domains[0] !== "" && !domains.includes(emailDomain)) {
          return res.status(400).json({ message: "Email domain not allowed for registration" });
        }
      }

      const passwordHash = await hashPassword(body.password);
      const nameParts = body.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || body.fullName;
      const lastName = nameParts.slice(1).join(" ") || "";

      let playerId: string | null = null;
      if (body.role === "PLAYER") {
        const player = await storage.createPlayer({
          firstName,
          lastName,
          email: body.email,
          phone: body.phone || null,
          dob: body.dob || null,
          gender: body.gender || null,
          nationality: body.nationality || null,
          idNumber: body.idNumber || null,
          photoUrl: body.photo || null,
          heightCm: body.heightCm || null,
          weightKg: body.weightKg || null,
          lastWeightUpdatedAt: body.weightKg ? new Date() : null,
          status: "ACTIVE",
          eligibilityStatus: "PENDING",
          requestedTeamId: body.requestedTeamId || null,
          teamApprovalStatus: "PENDING",
          requestedPosition: body.requestedPosition || null,
          positionApprovalStatus: body.requestedPosition ? "PENDING" : "PENDING",
          requestedJerseyNo: body.requestedJerseyNo || null,
          jerseyApprovalStatus: body.requestedJerseyNo ? "PENDING" : "PENDING",
          registrationStatus: "PENDING_APPROVAL",
        });
        playerId = player.id;
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
      const tokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

      let user;
      try {
        user = await storage.createUser({
          fullName: body.fullName,
          email: body.email,
          passwordHash,
          role: body.role,
          playerId,
          emailVerified: false,
          verificationToken: tokenHash,
          verificationTokenExp: tokenExp,
          accountStatus: "PENDING_APPROVAL",
        });
      } catch (err) {
        if (playerId) await storage.deletePlayer(playerId);
        throw err;
      }

      // ── Auto-record contract acceptance if ticked at registration ──
      if (body.contractAccepted) {
        try {
          const isMinorReg = (() => {
            if (!body.dob) return false;
            const birth = new Date(body.dob);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            return age < 18;
          })();
          await db.insert(schema.contractAcceptances).values({
            userId: user.id,
            playerId,
            contractKey: "AFROCAT_CONTRACT_2024_2026",
            contractVersionHash: "PDF_v1_2024_2026",
            sport: "VOLLEYBALL",
            isMinor: isMinorReg,
            acceptedBy: "SELF",
            accepterFullName: body.fullName,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
            userAgent: req.headers["user-agent"] || null,
          });
        } catch (contractErr: any) {
          console.warn("[REGISTER] Contract acceptance insert warning:", contractErr.message);
        }
      }

      const frontendUrl = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL
        : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");
      const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
      console.log(`[EMAIL VERIFY] ${body.email} → ${verifyLink}`);

      return res.status(201).json({
        message: "Registration successful. Please check your email to verify your account.",
        requiresVerification: settings?.requireEmailVerification !== false,
        requiresApproval: settings?.requireAdminApproval !== false,
        verificationLink: process.env.NODE_ENV !== "production" ? verifyLink : undefined,
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.post("/api/auth/verify-email", async (req, res, next) => {
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const user = await storage.getUserByVerificationToken(tokenHash);
      if (!user) return res.status(400).json({ message: "Invalid or expired verification token" });
      if (user.verificationTokenExp && new Date(user.verificationTokenExp) < new Date()) {
        return res.status(400).json({ message: "Verification token has expired. Please request a new one." });
      }

      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExp: null,
      } as any);

      const settings = await storage.getSecuritySettings();
      const needsApproval = settings?.requireAdminApproval !== false;

      return res.json({
        message: needsApproval
          ? "Email verified successfully. Your account is awaiting admin approval."
          : "Email verified successfully. You may now log in.",
        requiresApproval: needsApproval,
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
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

      const settings = await storage.getSecuritySettings();

      if (settings?.requireEmailVerification !== false && !user.emailVerified && user.role !== "ADMIN") {
        return res.status(403).json({ message: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" });
      }

      if (settings?.requireAdminApproval !== false && user.accountStatus !== "ACTIVE") {
        if (user.accountStatus === "REJECTED") {
          return res.status(403).json({ message: "Your registration has been rejected.", code: "ACCOUNT_REJECTED" });
        }
        if (user.accountStatus === "SUSPENDED") {
          return res.status(403).json({ message: "Your account has been suspended.", code: "ACCOUNT_SUSPENDED" });
        }
        return res.status(403).json({ message: "Your registration is awaiting approval by Afrocat management.", code: "PENDING_APPROVAL" });
      }

      const token = signToken({ userId: user.id, email: user.email, role: user.role, roles: user.roles || [user.role] });
      return res.json({
        token,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, roles: user.roles || [], isSuperAdmin: !!user.isSuperAdmin, playerId: user.playerId, accountStatus: user.accountStatus },
        mustChangePassword: user.mustChangePassword || false,
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, roles: user.roles || [], isSuperAdmin: !!user.isSuperAdmin, playerId: user.playerId, accountStatus: user.accountStatus, mustChangePassword: !!user.mustChangePassword });
    } catch (e) { next(e); }
  });

  // ─── CHANGE PASSWORD (authenticated) ─────────────
  app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
    try {
      const body = z.object({
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }).parse(req.body);

      const user = await storage.getUser(req.user!.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await comparePassword(body.oldPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const newHash = await hashPassword(body.newPassword);
      await storage.updateUser(user.id, {
        passwordHash: newHash,
        mustChangePassword: false,
        lastPasswordResetAt: new Date(),
      } as any);

      return res.json({ message: "Password changed successfully" });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── FORGOT PASSWORD (public, email-based) ────────
  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const body = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(body.email);
      if (!user) {
        return res.json({ message: "If an account with that email exists, a password reset link has been generated." });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const tokenExp = new Date(Date.now() + 60 * 60 * 1000);

      await storage.updateUser(user.id, {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExp: tokenExp,
      } as any);

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const frontendUrl = `${protocol}://${host}`;
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

      return res.json({
        message: "If an account with that email exists, a password reset link has been generated.",
        resetLink,
        expiresIn: "1 hour",
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── RESET PASSWORD (public, token-based) ────────
  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const body = z.object({
        email: z.string().email(),
        token: z.string().min(1),
        newPassword: z.string().min(6),
      }).parse(req.body);

      const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
      const user = await storage.getUserByResetToken(tokenHash);

      if (!user || user.email !== body.email) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      if (user.passwordResetTokenExp && new Date(user.passwordResetTokenExp) < new Date()) {
        return res.status(400).json({ message: "Reset token has expired. Contact admin for a new one." });
      }

      const newHash = await hashPassword(body.newPassword);
      await storage.updateUser(user.id, {
        passwordHash: newHash,
        passwordResetTokenHash: null,
        passwordResetTokenExp: null,
        mustChangePassword: false,
        lastPasswordResetAt: new Date(),
      } as any);

      return res.json({ message: "Password reset successfully. You may now log in." });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── ADMIN: USER MANAGEMENT ──────────────────────
  app.get("/api/admin/users", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const query = (req.query.query as string) || "";
      const users = query ? await storage.searchUsers(query) : await storage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        roles: u.roles || [],
        isSuperAdmin: !!u.isSuperAdmin,
        accountStatus: u.accountStatus,
        emailVerified: u.emailVerified,
        mustChangePassword: u.mustChangePassword,
        lastPasswordResetAt: u.lastPasswordResetAt,
        createdAt: u.createdAt,
      })));
    } catch (e) { next(e); }
  });

  app.post("/api/admin/users/:userId/reset-password", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const body = z.object({
        method: z.enum(["TEMP_PASSWORD", "ONE_TIME_LINK"]),
        tempPassword: z.string().min(6).optional(),
      }).parse(req.body);

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (body.method === "TEMP_PASSWORD") {
        if (!body.tempPassword) return res.status(400).json({ message: "tempPassword is required for TEMP_PASSWORD method" });

        const newHash = await hashPassword(body.tempPassword);
        await storage.updateUser(targetUser.id, {
          passwordHash: newHash,
          mustChangePassword: true,
          passwordResetTokenHash: null,
          passwordResetTokenExp: null,
          lastPasswordResetAt: new Date(),
        } as any);

        await storage.createPasswordResetAudit({
          adminUserId: req.user!.userId,
          targetUserId: targetUser.id,
          resetMethod: "TEMP_PASSWORD",
          notes: `Temporary password set by admin`,
        });

        return res.json({ ok: true, message: "Temporary password set. User must change password on next login." });
      } else {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const exp = new Date(Date.now() + 60 * 60 * 1000);

        await storage.updateUser(targetUser.id, {
          passwordResetTokenHash: tokenHash,
          passwordResetTokenExp: exp,
          mustChangePassword: true,
          lastPasswordResetAt: new Date(),
        } as any);

        await storage.createPasswordResetAudit({
          adminUserId: req.user!.userId,
          targetUserId: targetUser.id,
          resetMethod: "ONE_TIME_LINK",
          notes: `One-time reset link generated by admin`,
        });

        const frontendUrl = process.env.FRONTEND_URL
          ? process.env.FRONTEND_URL
          : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");
        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(targetUser.email)}`;

        return res.json({
          ok: true,
          message: "One-time reset link generated. Link expires in 1 hour.",
          resetLink,
        });
      }
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── ADMIN: ENV CHECK ────────────────────────────
  app.get("/api/admin/env-check", requireAuth, requireRole(["ADMIN"]), (_req, res) => {
    res.json({
      GMAIL_USER: !!process.env.GMAIL_USER,
      GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
      EMAIL_AUTO_CC: !!process.env.EMAIL_AUTO_CC,
      DATABASE_URL: !!process.env.DATABASE_URL,
    });
  });

  // ─── PUBLIC TEAMS (for registration dropdown) ───
  app.get("/api/public/teams", async (_req, res, next) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams.map(t => ({ id: t.id, name: t.name, category: t.category, season: t.season })));
    } catch (e) { next(e); }
  });

  // ─── PUBLIC SHOP ────────────────────────────────
  app.get("/api/public/shop", async (_req, res, next) => {
    try {
      const items = await storage.getShopItems(true);
      res.json(items);
    } catch (e) { next(e); }
  });

  // ─── PUBLIC MEDIA ────────────────────────────────
  app.get("/api/public/media", async (_req, res, next) => {
    try {
      const posts = await storage.getMediaPosts({ status: "APPROVED", visibility: "PUBLIC" });
      res.json(posts);
    } catch (e) { next(e); }
  });

  // ─── SHOP (ADMIN) ────────────────────────────────
  app.get("/api/shop", requireAuth, async (_req, res, next) => {
    try {
      res.json(await storage.getShopItems());
    } catch (e) { next(e); }
  });

  app.post("/api/shop", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        isPublic: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createShopItem(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/shop/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateShopItem(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Item not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/shop/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      await storage.deleteShopItem(req.params.id);
      res.json({ message: "Deleted" });
    } catch (e) { next(e); }
  });

  // ─── MEDIA MANAGEMENT ────────────────────────────
  app.get("/api/media", requireAuth, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const posts = await storage.getMediaPosts(status ? { status } : undefined);
      const postsWithTags = await Promise.all(posts.map(async (p) => {
        const tags = await storage.getMediaTags(p.id);
        return { ...p, tags };
      }));
      res.json(postsWithTags);
    } catch (e) { next(e); }
  });

  app.get("/api/media/pending", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (_req, res, next) => {
    try {
      const posts = await storage.getMediaPosts({ status: "PENDING_REVIEW" });
      res.json(posts);
    } catch (e) { next(e); }
  });

  app.post("/api/media", requireAuth, async (req, res, next) => {
    try {
      const isPrivileged = ["ADMIN","MANAGER","COACH"].includes(req.user!.role);
      const body = z.object({
        title: z.string().optional(),
        caption: z.string().optional(),
        imageUrl: z.string().min(1),
        visibility: z.enum(["PUBLIC","TEAM_ONLY","PRIVATE"]).optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createMediaPost({
        ...body,
        visibility: isPrivileged ? (body.visibility || "PUBLIC") : "TEAM_ONLY",
        status: isPrivileged ? "APPROVED" : "PENDING_REVIEW",
        uploadedByUserId: req.user!.userId,
      }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  const mediaUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), "public", "uploads", "media");
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.post("/api/media/upload", requireAuth, requireRole(["ADMIN","MANAGER"]), mediaUpload.array("files", 10), async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        if ((req as any).file) {
          const singleFile = (req as any).file as Express.Multer.File;
          const url = `/uploads/media/${singleFile.filename}`;
          const title = (req.body.title as string) || singleFile.originalname;
          const description = (req.body.description as string) || null;
          const isPublic = req.body.isPublic !== "false";
          const [item] = await db.insert(schema.mediaPosts).values({
            title, caption: description, imageUrl: url,
            visibility: isPublic ? "PUBLIC" : "TEAM_ONLY", status: "APPROVED",
            uploadedByUserId: req.user!.userId,
          }).returning();
          return res.status(201).json({ ok: true, item: { ...item, url: item.imageUrl, mimeType: singleFile.mimetype, description: item.caption, uploadedBy: req.user!.userId } });
        }
        return res.status(400).json({ ok: false, message: "No files uploaded" });
      }

      const titlePrefix = (req.body.title as string) || "";
      const description = (req.body.description as string) || null;
      const isPublic = req.body.isPublic !== "false";

      const items = [];
      for (const file of files) {
        const url = `/uploads/media/${file.filename}`;
        const fileTitle = titlePrefix ? `${titlePrefix} - ${file.originalname}` : file.originalname;
        const [item] = await db.insert(schema.mediaPosts).values({
          title: fileTitle, caption: description, imageUrl: url,
          visibility: isPublic ? "PUBLIC" : "TEAM_ONLY", status: "APPROVED",
          uploadedByUserId: req.user!.userId,
        }).returning();
        items.push({ ...item, url: item.imageUrl, mimeType: file.mimetype, description: item.caption, uploadedBy: req.user!.userId });
      }

      res.status(201).json({ ok: true, items, item: items[0] });
    } catch (e) { next(e); }
  });

  app.post("/api/media/:id/approve", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateMediaPost(req.params.id, { status: "APPROVED" } as any);
      if (!updated) return res.status(404).json({ message: "Media not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/media/:id/reject", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateMediaPost(req.params.id, { status: "REJECTED" } as any);
      if (!updated) return res.status(404).json({ message: "Media not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── MEDIA TAGGING ────────────────────────────────
  app.get("/api/media/:id/tags", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getMediaTags(req.params.id));
    } catch (e) { next(e); }
  });

  app.post("/api/media/:id/tags", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        taggedPlayerIds: z.array(z.string()).optional().default([]),
        taggedUserIds: z.array(z.string()).optional().default([]),
      }).parse(req.body);
      const created = [];
      for (const pid of body.taggedPlayerIds) {
        created.push(await storage.createMediaTag({
          mediaId: req.params.id,
          taggedPlayerId: pid,
          tagType: "PLAYER",
          createdByUserId: req.user!.userId,
        }));
      }
      for (const uid of body.taggedUserIds) {
        created.push(await storage.createMediaTag({
          mediaId: req.params.id,
          taggedUserId: uid,
          tagType: "STAFF",
          createdByUserId: req.user!.userId,
        }));
      }
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/media/tags/:tagId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      await storage.deleteMediaTag(req.params.tagId);
      res.json({ message: "Tag removed" });
    } catch (e) { next(e); }
  });

  app.post("/api/media/:id/tag-request", requireAuth, requireRole(["PLAYER"]), async (req, res, next) => {
    try {
      if (!req.user!.playerId) return res.status(400).json({ message: "No player profile linked" });
      res.status(201).json(await storage.createMediaTagRequest({
        mediaId: req.params.id,
        playerId: req.user!.playerId,
      }));
    } catch (e) { next(e); }
  });

  app.get("/api/media/tag-requests", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (_req, res, next) => {
    try {
      res.json(await storage.getMediaTagRequests("PENDING"));
    } catch (e) { next(e); }
  });

  app.post("/api/media/tag-requests/:id/approve", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const tagReq = await storage.updateMediaTagRequest(req.params.id, { status: "APPROVED" } as any);
      if (!tagReq) return res.status(404).json({ message: "Request not found" });
      await storage.createMediaTag({
        mediaId: tagReq.mediaId,
        taggedPlayerId: tagReq.playerId,
        tagType: "PLAYER",
        createdByUserId: req.user!.userId,
      });
      res.json(tagReq);
    } catch (e) { next(e); }
  });

  app.post("/api/media/tag-requests/:id/reject", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const updated = await storage.updateMediaTagRequest(req.params.id, { status: "REJECTED" } as any);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── PLAYER/COACH MEDIA (tagged photos) ──────────
  app.get("/api/players/me/media", requireAuth, async (req, res, next) => {
    try {
      if (!req.user!.playerId) return res.json([]);
      const tags = await storage.getMediaTagsByPlayer(req.user!.playerId);
      const posts = [];
      for (const tag of tags) {
        const post = await storage.getMediaPost(tag.mediaId);
        if (post && post.status === "APPROVED") posts.push(post);
      }
      res.json(posts);
    } catch (e) { next(e); }
  });

  app.get("/api/coaches/me/media", requireAuth, async (req, res, next) => {
    try {
      const tags = await storage.getMediaTagsByUser(req.user!.userId);
      const posts = [];
      for (const tag of tags) {
        const post = await storage.getMediaPost(tag.mediaId);
        if (post && post.status === "APPROVED") posts.push(post);
      }
      res.json(posts);
    } catch (e) { next(e); }
  });

  // ─── ATTENDANCE SELF-CHECK-IN ─────────────────────
  app.post("/api/attendance/sessions/:id/checkin", requireAuth, requireRole(["PLAYER"]), async (req, res, next) => {
    try {
      if (!req.user!.playerId) return res.status(400).json({ message: "No player profile linked" });
      const session = await storage.getAttendanceSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "CLOSED") return res.status(403).json({ message: "Attendance closed" });

      const body = z.object({
        status: z.enum(["PRESENT", "LATE", "ABSENT"]).optional(),
        reason: z.string().optional(),
      }).safeParse(req.body);

      const existing = await storage.getAttendanceRecordBySessionAndPlayer(req.params.id, req.user!.playerId);

      let status = body.success && body.data.status ? body.data.status : "PRESENT";
      // If no explicit status, auto-detect LATE based on session date/time
      if (!body.success || !body.data.status) {
        const now = new Date();
        const sessionDate = new Date(session.sessionDate);
        const isLate = now.getTime() - sessionDate.getTime() > 15 * 60 * 1000;
        status = isLate ? "LATE" : "PRESENT";
      }

      if (existing) {
        // Allow player to update their own self-marked record if not yet confirmed
        if (!existing.confirmedByUserId) {
          const updated = await storage.updateAttendanceRecord(existing.id, {
            status: status as any,
            reason: body.success ? body.data.reason : undefined,
            selfMarked: true,
          } as any);
          return res.json(updated);
        }
        return res.status(400).json({ message: "Attendance already confirmed by coach" });
      }

      const record = await storage.createAttendanceRecord({
        sessionId: req.params.id,
        playerId: req.user!.playerId,
        status: status as any,
        reason: body.success ? body.data.reason : undefined,
        selfMarked: true,
      });
      res.status(201).json(record);
    } catch (e) { next(e); }
  });

  // Get upcoming attendance sessions for the logged-in player's team + their own status
  app.get("/api/attendance/my-sessions", requireAuth, requireRole(["PLAYER"]), async (req, res, next) => {
    try {
      const playerId = req.user!.playerId;
      if (!playerId) return res.json([]);
      const player = await storage.getPlayer(playerId);
      if (!player?.teamId) return res.json([]);

      const sessions = await storage.getAttendanceSessions(player.teamId);
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      // Return sessions from past 30 days + next 14 days, sorted by date desc
      const cutoffPast = new Date(now);
      cutoffPast.setDate(cutoffPast.getDate() - 30);
      const cutoffPastStr = cutoffPast.toISOString().split("T")[0];

      const relevant = sessions.filter(s => s.sessionDate >= cutoffPastStr);
      const enriched = await Promise.all(relevant.map(async s => {
        const record = await storage.getAttendanceRecordBySessionAndPlayer(s.id, playerId);
        const isPast = s.sessionDate < todayStr;
        const isToday = s.sessionDate === todayStr;
        return {
          ...s,
          myStatus: record?.status || null,
          myReason: record?.reason || null,
          selfMarked: record?.selfMarked || false,
          confirmed: !!record?.confirmedByUserId,
          confirmedAt: record?.confirmedAt || null,
          recordId: record?.id || null,
          isPast,
          isToday,
          isOpen: s.status !== "CLOSED",
        };
      }));

      enriched.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.post("/api/attendance/records/:id/confirm", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        status: z.enum(["PRESENT","LATE","ABSENT","EXCUSED"]).optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const updated = await storage.updateAttendanceRecord(req.params.id, {
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes ? { reason: body.notes } : {}),
        confirmedByUserId: req.user!.userId,
        confirmedAt: new Date(),
      } as any);
      if (!updated) return res.status(404).json({ message: "Record not found" });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/attendance/pending-confirmations", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (_req, res, next) => {
    try {
      const sessions = await storage.getAttendanceSessions();
      const allPlayers = await storage.getPlayers();
      const playerMap: Record<string, any> = {};
      for (const p of allPlayers) playerMap[p.id] = p;

      const pending: any[] = [];
      for (const session of sessions) {
        const records = await storage.getAttendanceRecords(session.id);
        const unconfirmed = records.filter(r => r.selfMarked && !r.confirmedByUserId);
        if (unconfirmed.length > 0) {
          pending.push({
            session,
            records: unconfirmed.map(r => {
              const p = playerMap[r.playerId];
              return { ...r, playerName: p ? `${p.firstName} ${p.lastName}` : "Unknown" };
            }),
          });
        }
      }
      res.json(pending);
    } catch (e) { next(e); }
  });

  // ─── ADMIN CREATE USER ────────────────────────────
  app.post("/api/admin/users", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const body = z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL","PLAYER"]),
      }).parse(req.body);

      const existing = await storage.getUserByEmail(body.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const passwordHash = await hashPassword(body.password);
      let playerId: string | null = null;
      if (body.role === "PLAYER") {
        const nameParts = body.fullName.trim().split(/\s+/);
        const player = await storage.createPlayer({
          firstName: nameParts[0] || body.fullName,
          lastName: nameParts.slice(1).join(" ") || "",
          email: body.email,
          status: "ACTIVE",
          eligibilityStatus: "ELIGIBLE",
          registrationStatus: "APPROVED",
        });
        playerId = player.id;
      }

      const user = await storage.createUser({
        fullName: body.fullName,
        email: body.email,
        passwordHash,
        role: body.role,
        playerId,
        emailVerified: true,
        accountStatus: "ACTIVE",
      });

      res.status(201).json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/admin/users/:id/role", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const currentUser = await storage.getUser(req.user!.userId);
      if (!currentUser) return res.status(401).json({ message: "Unauthorized" });
      if (!currentUser.isSuperAdmin) return res.status(403).json({ message: "Only the Super Admin can assign roles" });

      const body = z.object({
        roles: z.array(z.enum(["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL","PLAYER"])).min(1),
      }).parse(req.body);

      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const primaryRole = body.roles.includes(user.role as any) ? user.role : body.roles[0];
      const updated = await storage.updateUser(req.params.id, { role: primaryRole, roles: body.roles } as any);
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const currentUser = await storage.getUser(req.user!.userId);
      if (!currentUser) return res.status(401).json({ message: "Unauthorized" });
      if (!currentUser.isSuperAdmin) return res.status(403).json({ message: "Only the Super Admin can delete users" });

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.isSuperAdmin) return res.status(403).json({ message: "Cannot delete the Super Admin account" });

      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (e) { next(e); }
  });

  // ─── TEAMS ───────────────────────────────────────
  app.get("/api/teams", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getTeams()); } catch (e) { next(e); }
  });

  app.post("/api/teams", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        name: z.string().min(1),
        category: z.enum(["MEN","WOMEN","VETERANS","JUNIORS"]),
        season: z.string(),
        isTournament: z.boolean().optional().default(false),
        tournamentName: z.string().optional(),
      }).parse(req.body);
      res.status(201).json(await storage.createTeam(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ── Tournament Roster ────────────────────────────────────────────────────
  app.get("/api/tournament-teams/:id/roster", requireAuth, async (req, res, next) => {
    try {
      const team = await db.select().from(schema.teams).where(eq(schema.teams.id, req.params.id)).then(r => r[0]);
      if (!team || !team.isTournament) return res.status(404).json({ message: "Not a tournament team" });
      const rosters = await db.select().from(schema.tournamentRosters)
        .where(eq(schema.tournamentRosters.tournamentTeamId, req.params.id));
      const allPlayers = await db.select().from(schema.players);
      const allTeams = await db.select().from(schema.teams);
      const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));
      const result = rosters.map(r => {
        const p = playerMap[r.playerId];
        return {
          ...r,
          player: p ? {
            id: p.id, firstName: p.firstName, lastName: p.lastName,
            fullName: `${p.firstName} ${p.lastName}`,
            position: r.position || p.position,
            jerseyNo: r.jerseyNo ?? p.jerseyNo,
            photoUrl: p.photoUrl, gender: p.gender,
            originalTeamId: p.teamId,
            originalTeamName: teamMap[p.teamId || ""] || "",
          } : null,
          originalTeamName: teamMap[r.originalTeamId || ""] || "",
        };
      }).filter(r => r.player).sort((a, b) =>
        (a.player?.fullName || "").localeCompare(b.player?.fullName || "")
      );
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post("/api/tournament-teams/:id/roster", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const team = await db.select().from(schema.teams).where(eq(schema.teams.id, req.params.id)).then(r => r[0]);
      if (!team || !team.isTournament) return res.status(404).json({ message: "Not a tournament team" });
      const { playerId, position, jerseyNo } = req.body;
      if (!playerId) return res.status(400).json({ message: "playerId required" });
      // Check for duplicate
      const existing = await db.select().from(schema.tournamentRosters)
        .where(and(
          eq(schema.tournamentRosters.tournamentTeamId, req.params.id),
          eq(schema.tournamentRosters.playerId, playerId)
        )).then(r => r[0]);
      if (existing) return res.status(409).json({ message: "Player already in this tournament team" });
      const player = await db.select().from(schema.players).where(eq(schema.players.id, playerId)).then(r => r[0]);
      const [row] = await db.insert(schema.tournamentRosters).values({
        id: crypto.randomUUID(),
        tournamentTeamId: req.params.id,
        playerId,
        originalTeamId: player?.teamId || null,
        position: position || player?.position || null,
        jerseyNo: jerseyNo ?? player?.jerseyNo ?? null,
      }).returning();
      res.status(201).json(row);
    } catch (e) { next(e); }
  });

  app.delete("/api/tournament-teams/:id/roster/:playerId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      await db.delete(schema.tournamentRosters).where(and(
        eq(schema.tournamentRosters.tournamentTeamId, req.params.id),
        eq(schema.tournamentRosters.playerId, req.params.playerId)
      ));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.patch("/api/tournament-teams/:id/roster/:playerId", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { position, jerseyNo } = req.body;
      const updates: any = {};
      if (position !== undefined) updates.position = position;
      if (jerseyNo !== undefined) updates.jerseyNo = jerseyNo;
      await db.update(schema.tournamentRosters).set(updates).where(and(
        eq(schema.tournamentRosters.tournamentTeamId, req.params.id),
        eq(schema.tournamentRosters.playerId, req.params.playerId)
      ));
      res.json({ ok: true });
    } catch (e) { next(e); }
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
  app.get("/api/players", requireAuth, requireRole(["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL"]), async (_req, res, next) => {
    try { res.json(await storage.getPlayers()); } catch (e) { next(e); }
  });

  app.get("/api/players/team/:teamId", requireAuth, async (req, res, next) => {
    try {
      const team = await db.select().from(schema.teams).where(eq(schema.teams.id, req.params.teamId)).then(r => r[0]);
      // For tournament teams, return players from the tournamentRosters table
      if (team?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters)
          .where(eq(schema.tournamentRosters.tournamentTeamId, req.params.teamId));
        const allPlayers = await db.select().from(schema.players);
        const allTeams = await db.select().from(schema.teams);
        const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));
        const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));
        const result = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return {
            ...p,
            // Override position/jersey with tournament-specific values if set
            position: r.position || p.position,
            jerseyNo: r.jerseyNo ?? p.jerseyNo,
            teamId: req.params.teamId,  // so stats link correctly to tournament team
            originalTeamId: p.teamId,
            originalTeamName: teamMap[p.teamId || ""] || "",
          };
        }).filter(Boolean).sort((a: any, b: any) =>
          (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`)
        );
        return res.json(result);
      }
      res.json(await storage.getPlayersByTeam(req.params.teamId));
    } catch (e) { next(e); }
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
        heightCm: z.number().int().min(50).max(250).optional(),
        weightKg: z.number().int().min(20).max(200).optional(),
        maritalStatus: z.string().optional(), facebookName: z.string().optional(),
      }).parse(req.body);

      const player = await storage.getPlayer(user.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      if (allowedFields.gender) {
        const teamId = player.teamId || player.requestedTeamId;
        if (teamId) {
          const team = await storage.getTeam(teamId);
          if (team) {
            const gv = validateTeamGender(team.name, allowedFields.gender);
            if (!gv.ok) return res.status(400).json({ message: gv.error });
          }
        }
      }

      if (player.registrationStatus === "APPROVED") {
        const cleanPatch: Record<string, any> = {};
        for (const [k, v] of Object.entries(allowedFields)) {
          if (v !== undefined) cleanPatch[k] = v;
        }
        if (Object.keys(cleanPatch).length === 0) {
          return res.status(400).json({ message: "No changes to submit" });
        }

        if (cleanPatch.weightKg !== undefined && Object.keys(cleanPatch).length === 1) {
          await storage.updatePlayer(user.playerId, {
            weightKg: cleanPatch.weightKg,
            lastWeightUpdatedAt: new Date(),
          } as any);
          const updatedPlayer = await storage.getPlayer(user.playerId);
          return res.json(updatedPlayer);
        }

        const request = await storage.createPlayerUpdateRequest({
          playerId: user.playerId,
          patchJson: cleanPatch,
          submittedBy: user.id,
          status: "PENDING",
        });

        return res.json({
          message: "Update submitted for admin approval",
          updateRequest: request,
          requiresApproval: true,
        });
      }

      const updateData: any = { ...allowedFields };
      if (allowedFields.weightKg !== undefined) {
        updateData.lastWeightUpdatedAt = new Date();
      }
      const updated = await storage.updatePlayer(user.playerId, updateData);
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
    try {
      const all = await storage.getMatches();
      res.json(all.map(enrichMatch));
    } catch (e) { next(e); }
  });

  app.get("/api/matches/upcoming", requireAuth, async (_req, res, next) => {
    try {
      const all = await storage.getMatches();
      const enriched = all.map(enrichMatch);
      const upcoming = enriched
        .filter((m: any) => m.status === "UPCOMING")
        .sort((a: any, b: any) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
      res.json(upcoming);
    } catch (e) { next(e); }
  });

  app.get("/api/awards/match-mvps", requireAuth, async (_req, res, next) => {
    try {
      const allAwards = await storage.getAwards();
      const formalMvps = allAwards.filter((a: any) => a.awardType === "MATCH_MVP");
      const formalMatchIds = new Set(formalMvps.map((a: any) => a.matchId).filter(Boolean));

      const allPlayers = await storage.getPlayers();
      const allMatches = await storage.getMatches();
      const pMap = new Map(allPlayers.map((p: any) => [p.id, p]));
      const mMap = new Map(allMatches.map((m: any) => [m.id, m]));

      // Derive MVP entries from matches with player_of_match_player_id that don't have a formal award yet
      const derivedMvps: any[] = allMatches
        .filter((m: any) => m.playerOfMatchPlayerId && !formalMatchIds.has(m.id))
        .map((m: any) => ({
          id: `derived-${m.id}`,
          playerId: m.playerOfMatchPlayerId,
          awardType: "MATCH_MVP",
          matchId: m.id,
          awardMonth: m.matchDate ? m.matchDate.slice(0, 7) : null,
          notes: "Player of the Match",
          createdAt: m.matchDate || m.createdAt,
          derived: true,
        }));

      const all = [...formalMvps, ...derivedMvps]
        .sort((a: any, b: any) => (b.createdAt || "").toString().localeCompare((a.createdAt || "").toString()));

      const enriched = all.map((a: any) => {
        const player = pMap.get(a.playerId);
        const match = a.matchId ? mMap.get(a.matchId) : null;
        return {
          ...a,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          playerJersey: player?.jerseyNo || "?",
          playerPosition: player?.position || "—",
          playerPhotoUrl: player?.photoUrl || null,
          matchDate: match?.matchDate || null,
          matchOpponent: match?.opponent || null,
          matchResult: match?.result || null,
          matchSets: match ? `${match.setsFor || 0}-${match.setsAgainst || 0}` : null,
          matchCompetition: match?.competition || null,
        };
      });
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/awards/player/:playerId/mvps", requireAuth, async (req, res, next) => {
    try {
      const awards = await storage.getAwardsByPlayer(req.params.playerId);
      const mvps = awards.filter((a: any) => a.awardType === "MATCH_MVP")
        .sort((a: any, b: any) => (b.createdAt || "").toString().localeCompare((a.createdAt || "").toString()));
      const allMatches = await storage.getMatches();
      const mMap = new Map(allMatches.map((m: any) => [m.id, m]));
      const enriched = mvps.map((a: any) => {
        const match = a.matchId ? mMap.get(a.matchId) : null;
        return {
          ...a,
          matchDate: match?.matchDate || null,
          matchOpponent: match?.opponent || null,
          matchResult: match?.result || null,
          matchSets: match ? `${match.setsFor || 0}-${match.setsAgainst || 0}` : null,
        };
      });
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/matches/played", requireAuth, async (_req, res, next) => {
    try {
      const all = await storage.getMatches();
      const enriched = all.map(enrichMatch);
      const played = enriched
        .filter((m: any) => m.status === "PLAYED" || m.status === "PAST_NO_SCORE")
        .sort((a: any, b: any) => new Date(b.startTime || b.matchDate).getTime() - new Date(a.startTime || a.matchDate).getTime());
      res.json(played);
    } catch (e) { next(e); }
  });

  app.get("/api/matches/:id", requireAuth, async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      res.json(enrichMatch(match));
    } catch (e) { next(e); }
  });

  app.post("/api/matches", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(), opponent: z.string(), matchDate: z.string(),
        startTime: z.string().optional().nullable(),
        venue: z.string(), competition: z.string(),
        notes: z.string().optional().nullable(),
        round: z.string().optional().nullable(),
      }).parse(req.body);

      const startTimeParsed = body.startTime ? new Date(body.startTime) : null;

      if (startTimeParsed && startTimeParsed < new Date()) {
        return res.status(400).json({ message: "Cannot schedule a match in the past." });
      }

      const endTimeParsed = startTimeParsed
        ? new Date(startTimeParsed.getTime() + 120 * 60 * 1000)
        : null;

      const matchData: any = {
        ...body,
        startTime: startTimeParsed,
        endTime: endTimeParsed,
        status: "UPCOMING",
        homeScore: null,
        awayScore: null,
        scoreSource: "NONE",
        scoreLocked: false,
        statsEntered: false,
        bestOf: 5,
      };

      const match = await storage.createMatch(matchData);
      res.status(201).json(enrichMatch(match));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/matches/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const existing = await storage.getMatch(req.params.id);
      if (!existing) return res.status(404).json({ message: "Match not found" });

      const body = z.object({
        teamId: z.string().optional(),
        opponent: z.string().optional(),
        matchDate: z.string().optional(),
        startTime: z.string().optional().nullable(),
        venue: z.string().optional(),
        competition: z.string().optional(),
        result: z.enum(["W","L"]).optional().nullable(),
        setsFor: z.number().optional(),
        setsAgainst: z.number().optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);

      const updateData: any = { ...body };
      if (body.startTime !== undefined) {
        updateData.startTime = body.startTime ? new Date(body.startTime) : null;
      }
      const effectiveStartTime = updateData.startTime !== undefined ? updateData.startTime : existing.startTime;
      if (effectiveStartTime && new Date(effectiveStartTime) > new Date() && existing.status !== "PLAYED") {
        updateData.status = "UPCOMING";
        updateData.homeScore = null;
        updateData.awayScore = null;
        updateData.scoreSource = "NONE";
        updateData.scoreLocked = false;
        updateData.statsEntered = false;
      }

      const updated = await storage.updateMatch(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Match not found" });
      if (updated.result) {
        await recomputeCoachPerformance(updated.teamId, updated.matchDate);
      }
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── STAFF-ELIGIBLE USERS (for match staff dropdown) ────────────────────
  app.get("/api/staff-eligible-users", requireAuth, async (_req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      const isCoach = (u: any) =>
        u.role === "COACH" || (Array.isArray(u.roles) && u.roles.includes("COACH"));
      const isMedic = (u: any) =>
        u.role === "MEDICAL" || (Array.isArray(u.roles) && u.roles.includes("MEDICAL"));
      const isManager = (u: any) =>
        u.role === "MANAGER" || (Array.isArray(u.roles) && u.roles.includes("MANAGER")) || u.role === "ADMIN";
      const eligible = users
        .filter((u: any) => u.accountStatus === "APPROVED" || u.accountStatus === "ACTIVE" || !u.accountStatus || u.isSuperAdmin)
        .map((u: any) => ({
          id: u.id,
          fullName: u.fullName,
          role: u.role,
          roles: u.roles || [],
          isCoach: isCoach(u),
          isMedic: isMedic(u),
          isManager: isManager(u),
        }));
      res.json(eligible);
    } catch (e) { next(e); }
  });

  // ─── ADMIN EDIT MATCH (with lock validation) ────────────────────
  app.patch("/api/matches/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      if (match.status === "PLAYED" || match.status === "CANCELLED") {
        return res.status(400).json({ message: "Cannot edit a played or cancelled match" });
      }
      if (match.statsEntered || match.scoreLocked) {
        return res.status(400).json({ message: "Cannot edit — stats already entered or score locked" });
      }

      const body = z.object({
        startTime: z.string().optional().nullable(),
        venue: z.string().optional(),
        competition: z.string().optional(),
        round: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        opponent: z.string().optional(),
      }).parse(req.body);

      const updateData: any = {};
      if (body.startTime !== undefined) updateData.startTime = body.startTime ? new Date(body.startTime) : null;
      if (body.venue !== undefined) updateData.venue = body.venue;
      if (body.competition !== undefined) updateData.competition = body.competition;
      if (body.round !== undefined) updateData.round = body.round;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.opponent !== undefined) updateData.opponent = body.opponent;

      const updated = await storage.updateMatch(req.params.id, updateData);
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── MATCH STAFF ASSIGNMENTS ────────────────────
  app.get("/api/matches/:id/staff", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const staffRows = await db.select().from(schema.matchStaffAssignments)
        .where(eq(schema.matchStaffAssignments.matchId, req.params.id));
      const staff = staffRows[0] || null;
      if (!staff) return res.json(null);

      const resolve = async (uid: string | null) => {
        if (!uid) return null;
        const u = await storage.getUser(uid);
        return u ? { id: u.id, fullName: u.fullName } : null;
      };
      const [headCoach, assistantCoach, medic, teamManager] = await Promise.all([
        resolve(staff.headCoachUserId),
        resolve(staff.assistantCoachUserId),
        resolve(staff.medicUserId),
        resolve(staff.teamManagerUserId),
      ]);
      res.json({ ...staff, headCoach, assistantCoach, medic, teamManager });
    } catch (e) { next(e); }
  });

  app.post("/api/matches/:id/staff", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const body = z.object({
        headCoachUserId: z.string().min(1),
        assistantCoachUserId: z.string().optional().nullable(),
        medicUserId: z.string().optional().nullable(),
        teamManagerUserId: z.string().optional().nullable(),
      }).parse(req.body);

      const existing = await db.select().from(schema.matchStaffAssignments)
        .where(eq(schema.matchStaffAssignments.matchId, req.params.id));

      let result;
      if (existing.length > 0) {
        [result] = await db.update(schema.matchStaffAssignments)
          .set({
            headCoachUserId: body.headCoachUserId,
            assistantCoachUserId: body.assistantCoachUserId || null,
            medicUserId: body.medicUserId || null,
            teamManagerUserId: body.teamManagerUserId || null,
          })
          .where(eq(schema.matchStaffAssignments.matchId, req.params.id))
          .returning();
      } else {
        [result] = await db.insert(schema.matchStaffAssignments).values({
          matchId: req.params.id,
          headCoachUserId: body.headCoachUserId,
          assistantCoachUserId: body.assistantCoachUserId || null,
          medicUserId: body.medicUserId || null,
          teamManagerUserId: body.teamManagerUserId || null,
        }).returning();
      }

      res.json(result);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.post("/api/matches/:id/score", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      if (match.startTime && new Date(match.startTime) > new Date()) {
        return res.status(400).json({ message: "Cannot set score for upcoming match" });
      }
      if (match.statsEntered) {
        return res.status(400).json({ message: "Score locked: stats already entered" });
      }
      if (match.scoreLocked && match.scoreSource === "STATS") {
        return res.status(400).json({ message: "Score locked: stats already entered" });
      }

      const body = z.object({
        homeScore: z.number(),
        awayScore: z.number(),
        result: z.enum(["W","L"]).optional(),
        setsFor: z.number().optional(),
        setsAgainst: z.number().optional(),
      }).parse(req.body);

      const result = body.result || (body.homeScore > body.awayScore ? "W" : "L");
      const updated = await storage.updateMatch(req.params.id, {
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        setsFor: body.setsFor ?? body.homeScore,
        setsAgainst: body.setsAgainst ?? body.awayScore,
        result,
        scoreSource: "MANUAL",
        scoreLocked: true,
        status: "PLAYED",
        lastScoreUpdatedBy: req.user!.userId,
        lastScoreUpdatedAt: new Date(),
      } as any);

      if (updated) {
        await recomputeCoachPerformance(updated.teamId, updated.matchDate);
      }
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.patch("/api/matches/:id/final-score", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const normalized = normalizeMatchStatus(match);
      if (normalized.status !== "PAST_NO_SCORE") {
        if (match.statsEntered || match.scoreSource === "STATS") {
          return res.status(400).json({ message: "Score locked: stats already entered." });
        }
        if (match.scoreLocked) {
          return res.status(400).json({ message: "Score already locked." });
        }
        if (normalized.status === "UPCOMING" || normalized.status === "LIVE") {
          return res.status(400).json({ message: "Match has not ended yet." });
        }
      }

      const body = z.object({
        homeScore: z.number().min(0),
        awayScore: z.number().min(0),
      }).parse(req.body);

      const result = body.homeScore > body.awayScore ? "W" : "L";
      const updated = await storage.updateMatch(req.params.id, {
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        setsFor: body.homeScore,
        setsAgainst: body.awayScore,
        result,
        scoreSource: "MANUAL",
        scoreLocked: true,
        status: "PLAYED",
        lastScoreUpdatedBy: req.user!.userId,
        lastScoreUpdatedAt: new Date(),
      } as any);

      if (updated) {
        await recomputeCoachPerformance(updated.teamId, updated.matchDate);
      }
      res.json(enrichMatch(updated!));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.post("/api/matches/:id/set-stats", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const body = z.object({
        sets: z.array(z.object({
          homePoints: z.number(),
          awayPoints: z.number(),
        })),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
      }).parse(req.body);

      const setStats = await storage.createMatchSetStats({
        matchId: req.params.id,
        sets: body.sets,
        enteredBy: req.user!.userId,
      });

      let homeSets = 0, awaySets = 0;
      for (const s of body.sets) {
        if (s.homePoints > s.awayPoints) homeSets++;
        else if (s.awayPoints > s.homePoints) awaySets++;
      }

      const result: "W" | "L" = homeSets > awaySets ? "W" : "L";
      const matchUpdate: any = {
        homeScore: homeSets,
        awayScore: awaySets,
        setsFor: homeSets,
        setsAgainst: awaySets,
        result,
        scoreSource: "STATS",
        scoreLocked: true,
        statsEntered: true,
        status: "PLAYED",
        lastScoreUpdatedBy: req.user!.userId,
        lastScoreUpdatedAt: new Date(),
      };

      if (body.startTime) matchUpdate.startTime = new Date(body.startTime);
      if (body.endTime) matchUpdate.endTime = new Date(body.endTime);

      await storage.updateMatch(req.params.id, matchUpdate);

      const updated = await storage.getMatch(req.params.id);
      if (updated) {
        await recomputeCoachPerformance(updated.teamId, updated.matchDate);
      }
      res.json({ setStats, match: updated });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
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


  // ─── SMART FOCUS ─────────────────────────────────
  app.get("/api/smart-focus/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getSmartFocusByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  // ─── ATTENDANCE ──────────────────────────────────
  // Helper: auto-generate sessions for current + next 7 days
  async function autoGenerateSessions() {
    const teams = await storage.getTeams();
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const dateStr = d.toISOString().split("T")[0];
      for (const team of teams) {
        const teamDays = [...(TRAINING_SCHEDULE[team.category] || []), ...TRAINING_SCHEDULE.ALL];
        if (!teamDays.includes(dow)) continue;
        const existing = (await storage.getAttendanceSessions(team.id))
          .find(s => s.sessionDate === dateStr && s.sessionType === "TRAINING");
        if (existing) continue;
        await storage.createAttendanceSession({
          teamId: team.id,
          sessionDate: dateStr,
          sessionType: "TRAINING",
          notes: `Auto-scheduled: ${d.toLocaleDateString("en-US", { weekday: "long" })} training`,
        });
      }
    }
  }

  app.get("/api/attendance/sessions", requireAuth, async (req, res, next) => {
    try {
      await autoGenerateSessions();
      res.json(await storage.getAttendanceSessions(req.query.teamId as string | undefined));
    } catch (e) { next(e); }
  });

  app.post("/api/attendance/sessions", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string(), sessionDate: z.string(),
        sessionType: z.enum(["TRAINING","MATCH","GYM"]), notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createAttendanceSession({ ...body, createdBy: req.user!.id }));
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
      const session = await storage.getAttendanceSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "CLOSED" && !req.user!.isSuperAdmin) {
        return res.status(403).json({ message: "Attendance closed" });
      }

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

  // Save attendance + auto-close (lock)
  app.post("/api/attendance/sessions/:id/save", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getAttendanceSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "CLOSED") {
        return res.status(403).json({ message: "Attendance closed" });
      }

      const lines = z.array(z.object({
        playerId: z.string(),
        status: z.enum(["PRESENT","LATE","ABSENT","EXCUSED"]),
        reason: z.string().optional().nullable(),
      })).parse(req.body);

      if (lines.length === 0) return res.status(400).json({ message: "Attendance lines required" });

      for (const rec of lines) {
        const existing = await storage.getAttendanceRecordBySessionAndPlayer(sessionId, rec.playerId);
        if (existing) {
          await storage.updateAttendanceRecord(existing.id, { status: rec.status, reason: rec.reason });
        } else {
          await storage.createAttendanceRecord({ ...rec, sessionId });
        }

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

      const updated = await storage.updateAttendanceSession(sessionId, {
        status: "CLOSED",
        lockedAt: new Date(),
        lockedBy: req.user!.id,
      } as any);

      res.json({ ok: true, session: updated });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // Super admin edit after closed
  app.patch("/api/attendance/sessions/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getAttendanceSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });

      if (session.status === "CLOSED" && !req.user!.isSuperAdmin) {
        return res.status(403).json({ message: "Attendance closed. Only Super Admin can edit." });
      }

      const body = z.object({
        sessionDate: z.string().optional(),
        sessionType: z.enum(["TRAINING","MATCH","GYM"]).optional(),
        lines: z.array(z.object({
          playerId: z.string(),
          status: z.enum(["PRESENT","LATE","ABSENT","EXCUSED"]),
          reason: z.string().optional().nullable(),
        })).optional(),
      }).parse(req.body);

      const updateData: any = {};
      if (body.sessionDate) updateData.sessionDate = body.sessionDate;
      if (body.sessionType) updateData.sessionType = body.sessionType;

      const updated = Object.keys(updateData).length > 0
        ? await storage.updateAttendanceSession(sessionId, updateData)
        : session;

      if (body.lines && body.lines.length > 0) {
        for (const rec of body.lines) {
          const existing = await storage.getAttendanceRecordBySessionAndPlayer(sessionId, rec.playerId);
          if (existing) {
            await storage.updateAttendanceRecord(existing.id, { status: rec.status, reason: rec.reason || null });
          } else {
            await storage.createAttendanceRecord({ playerId: rec.playerId, status: rec.status, reason: rec.reason || null, sessionId });
          }
        }
      }

      res.json({ ok: true, session: updated });
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
        awardType: z.enum(["MVP","MATCH_MVP","MOST_IMPROVED","BEST_SERVER","BEST_BLOCKER","COACH_AWARD"]),
        awardMonth: z.string(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createAward(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/awards/leaderboard", requireAuth, async (_req, res, next) => {
    try {
      const allPlayers = await storage.getPlayers();
      const pMap = new Map(allPlayers.map((p: any) => [p.id, p]));

      // Aggregate per-player stats from player_match_stats
      const rows = await db.execute(sql`
        SELECT
          pms.player_id,
          COUNT(DISTINCT pms.match_id)::int                AS matches_played,
          COALESCE(SUM(pms.points_total),0)::int           AS points_total,
          COALESCE(SUM(pms.serves_ace),0)::int             AS serves_ace,
          COALESCE(SUM(pms.spikes_kill),0)::int            AS spikes_kill,
          COALESCE(SUM(pms.blocks_solo + pms.blocks_assist),0)::int AS blocks_total,
          COALESCE(SUM(pms.digs),0)::int                   AS digs,
          COALESCE(SUM(pms.setting_assist),0)::int         AS setting_assist,
          COALESCE(SUM(pms.receive_perfect),0)::int        AS receive_perfect,
          COALESCE(SUM(pms.serves_error),0)::int           AS serves_error,
          COALESCE(SUM(pms.spikes_error),0)::int           AS spikes_error
        FROM player_match_stats pms
        GROUP BY pms.player_id
        ORDER BY points_total DESC
      `);

      const stats = (rows.rows as any[]).map((r: any) => {
        const player = pMap.get(r.player_id);
        return {
          playerId: r.player_id,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          playerJersey: player?.jerseyNo || "?",
          playerPosition: player?.position || "—",
          playerPhotoUrl: player?.photoUrl || null,
          teamId: player?.teamId || null,
          matchesPlayed: Number(r.matches_played) || 0,
          pointsTotal: Number(r.points_total) || 0,
          servesAce: Number(r.serves_ace) || 0,
          spikesKill: Number(r.spikes_kill) || 0,
          blocksTotal: Number(r.blocks_total) || 0,
          digs: Number(r.digs) || 0,
          settingAssist: Number(r.setting_assist) || 0,
          receivePerfect: Number(r.receive_perfect) || 0,
          servesError: Number(r.serves_error) || 0,
          spikesError: Number(r.spikes_error) || 0,
        };
      });

      // Count formal awards per player
      const allAwards = await storage.getAwards();
      const awardCounts: Record<string, number> = {};
      for (const a of allAwards) {
        awardCounts[a.playerId] = (awardCounts[a.playerId] || 0) + 1;
      }
      // Count player_of_match appearances
      const allMatches = await storage.getMatches();
      const potmCounts: Record<string, number> = {};
      for (const m of allMatches) {
        const id = (m as any).playerOfMatchPlayerId;
        if (id) potmCounts[id] = (potmCounts[id] || 0) + 1;
      }

      // Enrich with award counts and POTM
      const enriched = stats.map(s => ({
        ...s,
        totalAwards: (awardCounts[s.playerId] || 0) + (potmCounts[s.playerId] || 0),
        potmCount: potmCounts[s.playerId] || 0,
      }));

      // Build category leaders (top 3 per category, only players with at least 1 match)
      const played = enriched.filter(s => s.matchesPlayed > 0);
      const leaders = {
        topScorers:   [...played].sort((a, b) => b.pointsTotal - a.pointsTotal).slice(0, 5),
        topAcers:     [...played].sort((a, b) => b.servesAce - a.servesAce).slice(0, 5),
        topKillers:   [...played].sort((a, b) => b.spikesKill - a.spikesKill).slice(0, 5),
        topBlockers:  [...played].sort((a, b) => b.blocksTotal - a.blocksTotal).slice(0, 5),
        topDiggers:   [...played].sort((a, b) => b.digs - a.digs).slice(0, 5),
        topSetters:   [...played].sort((a, b) => b.settingAssist - a.settingAssist).slice(0, 5),
        allStats: enriched,
      };

      res.json(leaders);
    } catch (e) { next(e); }
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

  // Coach detailed performance — all teams, all assignments, per-match breakdown
  app.get("/api/coaches/:id/performance/detailed", requireAuth, async (req, res, next) => {
    try {
      const coachUserId = req.params.id;
      const coachUser = await storage.getUser(coachUserId);
      if (!coachUser) return res.status(404).json({ error: "Coach not found" });

      const allAssignments = await storage.getCoachAssignmentsByCoach(coachUserId);
      const allTeams = await db.select().from(schema.teams);
      const teamMap = Object.fromEntries(allTeams.map((t: any) => [t.id, t]));

      let careerMatches = 0, careerWins = 0, careerLosses = 0;
      const assignmentDetails = [];

      for (const a of allAssignments) {
        const team = teamMap[a.teamId] as any;
        const teamMatches = await storage.getMatchesByTeam(a.teamId);
        const coachedMatches = teamMatches
          .filter((m: any) => {
            if (!m.matchDate) return false;
            if (m.matchDate < a.startDate) return false;
            if (a.endDate && m.matchDate > a.endDate) return false;
            return true;
          })
          .sort((a: any, b: any) => b.matchDate.localeCompare(a.matchDate));

        const withResult = coachedMatches.filter((m: any) => m.result);
        const wins = withResult.filter((m: any) => m.result === "W").length;
        const losses = withResult.filter((m: any) => m.result === "L").length;

        if (a.assignmentRole === "HEAD_COACH") {
          careerMatches += withResult.length;
          careerWins += wins;
          careerLosses += losses;
        }

        assignmentDetails.push({
          id: a.id,
          teamId: a.teamId,
          teamName: team?.name || a.teamId,
          teamCategory: team?.category || "",
          assignmentRole: a.assignmentRole,
          startDate: a.startDate,
          endDate: a.endDate || null,
          active: a.active,
          isPrimary: a.isPrimary,
          isTemporary: a.isTemporary,
          tempReason: a.tempReason || null,
          matchCount: withResult.length,
          totalPlayed: coachedMatches.length,
          wins,
          losses,
          draws: withResult.length - wins - losses,
          winRate: withResult.length > 0 ? +(wins / withResult.length).toFixed(3) : 0,
          matches: coachedMatches.map((m: any) => ({
            id: m.id,
            matchDate: m.matchDate,
            opponent: m.opponent,
            result: m.result || null,
            setsFor: m.setsFor ?? m.homeSetsWon ?? null,
            setsAgainst: m.setsAgainst ?? m.awaySetsWon ?? null,
            homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null,
            statsEntered: !!m.statsEntered,
            scoreLocked: !!m.scoreLocked,
            venue: m.venue || null,
          })),
        });
      }

      const snap = await storage.getCoachPerformance(coachUserId);
      const winRate = careerMatches > 0 ? careerWins / careerMatches : 0;

      res.json({
        coachUserId,
        coachName: coachUser.fullName,
        coachPhoto: (coachUser as any).photoUrl || null,
        coachRole: coachUser.role,
        careerMatches,
        careerWins,
        careerLosses,
        winRate: +winRate.toFixed(3),
        stars: snap?.stars || computeStars(winRate),
        provisional: careerMatches < 5,
        assignments: assignmentDetails,
      });
    } catch (e) { next(e); }
  });

  // Coach users list for assignment picker
  app.get("/api/users/coaches", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const users = await storage.getUsers();
      const coaches = users
        .filter((u: any) => u.role === "COACH" || (u.roles as string[] || []).includes("COACH"))
        .map((u: any) => ({ id: u.id, fullName: u.fullName, email: u.email, photoUrl: u.photoUrl || null }))
        .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
      res.json(coaches);
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
        releaseFee: z.number().optional().nullable(),
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

  app.get("/api/contracts/my-contract", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      if (!user.playerId) return res.json(null);
      const contracts = await storage.getPlayerContracts(user.playerId);
      const activeContract = contracts.find((c: any) => c.status === "ACTIVE") || contracts.find((c: any) => c.status === "DRAFT") || contracts[0];
      if (!activeContract) return res.json(null);
      const items = await storage.getContractItems(activeContract.id);
      const transport = await storage.getContractTransportBenefits(activeContract.id);
      const contributions = await storage.getContractContributions(activeContract.id);
      const player = await storage.getPlayer(user.playerId);
      res.json({
        contract: activeContract,
        items,
        transport,
        contributions,
        player,
      });
    } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/player-sign", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const contract = await storage.getPlayerContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (!user.playerId || contract.playerId !== user.playerId) {
        return res.status(403).json({ message: "You can only sign your own contract" });
      }
      if (contract.signedByPlayer) {
        return res.status(400).json({ message: "Contract already signed" });
      }
      const updated = await storage.updatePlayerContract(req.params.id, {
        signedByPlayer: true,
        playerSignedAt: new Date(),
      } as any);
      const admins = await storage.getUsersByRole("ADMIN");
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: "CONTRACT_SIGNED",
          title: "Contract Signed",
          message: `${user.fullName} has signed their contract.`,
          metadata: { contractId: req.params.id, playerId: user.playerId },
        });
      }
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/contracts/send-unsigned-reminders", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const allContracts = await storage.getAllContracts();
      const unsigned = allContracts.filter((c: any) => (c.status === "ACTIVE" || c.status === "DRAFT") && !c.signedByPlayer);
      let sent = 0;
      for (const contract of unsigned) {
        const player = await storage.getPlayer(contract.playerId);
        if (!player) continue;
        const playerUser = await storage.getUserByPlayerId(contract.playerId);
        if (!playerUser) continue;
        await storage.createNotification({
          userId: playerUser.id,
          playerId: contract.playerId,
          type: "CONTRACT_REMINDER",
          title: "Contract Signature Required",
          message: "Please review and sign your contract in the My Contract section.",
          metadata: { contractId: contract.id },
        });
        sent++;
      }
      res.json({ sent, total: unsigned.length });
    } catch (e) { next(e); }
  });

  // ─── CONTRACT ISSUED ITEMS ────────────────────────────
  app.get("/api/contracts/:id/items", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getContractItems(req.params.id)); } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/items", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        itemName: z.string().min(1),
        quantity: z.number().int().min(1).default(1),
        unitValue: z.number().min(0).default(0),
        dateIssued: z.string(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const totalValue = body.quantity * body.unitValue;
      res.status(201).json(await storage.createContractItem({ contractId: req.params.id, ...body, totalValue }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/contracts/items/:itemId", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const data = z.object({
        itemName: z.string().min(1).optional(),
        quantity: z.number().int().min(1).optional(),
        unitValue: z.number().min(0).optional(),
        dateIssued: z.string().optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const updateData: any = { ...data };
      if (data.quantity != null && data.unitValue != null) updateData.totalValue = data.quantity * data.unitValue;
      const updated = await storage.updateContractItem(req.params.itemId, updateData);
      if (!updated) return res.status(404).json({ message: "Item not found" });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/contracts/items/:itemId", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteContractItem(req.params.itemId); res.status(204).end(); } catch (e) { next(e); }
  });

  // ─── CONTRACT TRANSPORT BENEFITS ────────────────────────────
  app.get("/api/contracts/:id/transport", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getContractTransportBenefits(req.params.id)); } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/transport", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        benefitType: z.enum(["TRAINING_TRANSPORT","MATCH_TRANSPORT","OTHER"]),
        dateFrom: z.string(),
        dateTo: z.string().optional().nullable(),
        amount: z.number().min(0),
        frequency: z.enum(["ONE_TIME","WEEKLY","MONTHLY","PER_TRIP"]),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createContractTransportBenefit({ contractId: req.params.id, ...body }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/contracts/transport/:benefitId", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const data = z.object({
        benefitType: z.enum(["TRAINING_TRANSPORT","MATCH_TRANSPORT","OTHER"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional().nullable(),
        amount: z.number().min(0).optional(),
        frequency: z.enum(["ONE_TIME","WEEKLY","MONTHLY","PER_TRIP"]).optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const updated = await storage.updateContractTransportBenefit(req.params.benefitId, data);
      if (!updated) return res.status(404).json({ message: "Transport benefit not found" });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/contracts/transport/:benefitId", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteContractTransportBenefit(req.params.benefitId); res.status(204).end(); } catch (e) { next(e); }
  });

  // ─── CONTRACT FEES ────────────────────────────
  app.put("/api/contracts/:id/fees", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        membershipFeeRequired: z.number().min(0).optional().nullable(),
        membershipFeePaid: z.number().min(0).optional().nullable(),
        developmentFeeRequired: z.number().min(0).optional().nullable(),
        developmentFeePaid: z.number().min(0).optional().nullable(),
      }).parse(req.body);
      const updated = await storage.updatePlayerContract(req.params.id, body);
      if (!updated) return res.status(404).json({ message: "Contract not found" });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── CONTRACT CONTRIBUTIONS ────────────────────────────
  app.get("/api/contracts/:id/contributions", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getContractContributions(req.params.id)); } catch (e) { next(e); }
  });

  app.get("/api/contributions/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getContractContributionsByPlayer(req.params.playerId)); } catch (e) { next(e); }
  });

  app.post("/api/contracts/:id/contributions", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(),
        itemName: z.string(),
        amount: z.number().min(0),
        status: z.enum(["PAID","DUE","PARTIAL"]).optional(),
        dueDate: z.string().optional().nullable(),
        paidDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const created = await storage.createContractContribution({ ...body, contractId: req.params.id });

      const contract = await storage.getPlayerContract(req.params.id);
      if (contract) {
        const allUsers = await storage.getAllUsers();
        const playerUser = allUsers.find((u: any) => u.playerId === contract.playerId);
        if (playerUser) {
          const statusLabel = body.status === "PAID" ? "marked as PAID" : `due ${body.dueDate || "soon"}`;
          await storage.createNotification({
            userId: playerUser.id,
            playerId: contract.playerId,
            type: "CONTRIBUTION_UPDATE",
            title: `Contribution: ${body.itemName}`,
            message: `${body.itemName} — N$${body.amount.toFixed(2)} ${statusLabel}`,
            metadata: { contractId: req.params.id, contributionId: created.id },
          });
        }
      }
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/contributions/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        status: z.enum(["PAID","DUE","PARTIAL"]).optional(),
        paidDate: z.string().optional().nullable(),
        amount: z.number().min(0).optional(),
        notes: z.string().optional().nullable(),
        dueDate: z.string().optional().nullable(),
      }).parse(req.body);
      const updated = await storage.updateContractContribution(req.params.id, body);
      if (!updated) return res.status(404).json({ message: "Contribution not found" });

      if (body.status && updated.playerId) {
        const allUsers = await storage.getAllUsers();
        const playerUser = allUsers.find((u: any) => u.playerId === updated.playerId);
        if (playerUser) {
          const statusLabel = body.status === "PAID" ? "has been marked as PAID" : body.status === "DUE" ? `is DUE` : "is PARTIALLY paid";
          await storage.createNotification({
            userId: playerUser.id,
            playerId: updated.playerId,
            type: "CONTRIBUTION_STATUS",
            title: `Payment Update: ${updated.itemName}`,
            message: `${updated.itemName} — N$${updated.amount?.toFixed(2)} ${statusLabel}`,
            metadata: { contributionId: updated.id },
          });
        }
      }
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.delete("/api/contributions/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteContractContribution(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });

  // ─── FUND RAISING ────────────────────────────
  app.get("/api/fundraising/activities", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getFundRaisingActivities()); } catch (e) { next(e); }
  });

  app.post("/api/fundraising/activities", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        name: z.string(),
        targetAmount: z.number().min(0),
        season: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createFundRaisingActivity({ ...body, createdByUserId: req.user!.userId }));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/fundraising/activities/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updateFundRaisingActivity(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Activity not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/fundraising/activities/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deleteFundRaisingActivity(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });

  app.get("/api/fundraising/contributions", requireAuth, async (req, res, next) => {
    try {
      const activityId = req.query.activityId as string | undefined;
      const playerId = req.query.playerId as string | undefined;
      res.json(await storage.getPlayerFundRaisingContributions(activityId, playerId));
    } catch (e) { next(e); }
  });

  app.post("/api/fundraising/contributions", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        activityId: z.string(),
        playerId: z.string(),
        amount: z.number().min(0),
        contributionDate: z.string(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createPlayerFundRaisingContribution(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/fundraising/contributions/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerFundRaisingContribution(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Contribution not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/fundraising/contributions/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { await storage.deletePlayerFundRaisingContribution(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });

  // ─── MEMBERSHIP NUMBER ────────────────────────────
  app.get("/api/membership/next", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try { res.json({ membershipNo: await storage.getNextMembershipNo() }); } catch (e) { next(e); }
  });

  app.post("/api/membership/assign/:playerId", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      if (player.membershipNo) return res.json({ membershipNo: player.membershipNo });
      const membershipNo = await storage.getNextMembershipNo();
      const updated = await storage.updatePlayer(req.params.playerId, { membershipNo } as any);
      res.json({ membershipNo, player: updated });
    } catch (e) { next(e); }
  });

  // ─── PLAYER VALUE CALCULATION ────────────────────────────
  app.get("/api/player-value/:playerId", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.params.playerId;
      const contracts = await storage.getPlayerContracts(playerId);
      const contributions = await storage.getContractContributionsByPlayer(playerId);
      const fundraisingContribs = await storage.getPlayerFundRaisingContributions(undefined, playerId);

      let signOnFees = 0;
      let developmentFees = 0;
      let itemsValue = 0;
      let transportValue = 0;

      for (const c of contracts) {
        signOnFees += c.signOnFee || 0;
        developmentFees += (c.developmentFeeRequired || 0);
        const items = await storage.getContractItems(c.id);
        itemsValue += items.reduce((s, i) => s + (i.totalValue || 0), 0);
        const transport = await storage.getContractTransportBenefits(c.id);
        transportValue += computeTransportValue(transport, new Date().toISOString().split("T")[0]);
      }

      const contributionsPaid = contributions.filter(c => c.status === "PAID").reduce((s, c) => s + (c.amount || 0), 0);
      const contributionsDue = contributions.filter(c => c.status !== "PAID").reduce((s, c) => s + (c.amount || 0), 0);
      const fundraisingTotal = fundraisingContribs.reduce((s, c) => s + (c.amount || 0), 0);

      const totalValue = signOnFees + developmentFees + itemsValue + transportValue + contributionsDue;

      res.json({
        signOnFees,
        developmentFees,
        itemsValue,
        transportValue,
        contributionsPaid,
        contributionsDue,
        fundraisingTotal,
        totalValue,
      });
    } catch (e) { next(e); }
  });

  // ─── NVF FEE CONFIG ────────────────────────────
  app.get("/api/nvf/fees", requireAuth, async (req, res, next) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      res.json(await storage.getNvfFees(year));
    } catch (e) { next(e); }
  });

  app.post("/api/nvf/fees", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const body = z.object({
        year: z.number().int(),
        feeType: z.enum(["INTER_ASSOCIATION_TRANSFER_FEE","OTHER"]),
        amount: z.number().min(0),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await storage.createNvfFee(body));
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.put("/api/nvf/fees/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const updated = await storage.updateNvfFee(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "NVF fee not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/nvf/fees/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try { await storage.deleteNvfFee(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });

  // ─── TRANSFER CALCULATOR ────────────────────────────
  function computeTransportValue(benefits: any[], transferDate: string): number {
    let total = 0;
    for (const b of benefits) {
      if (!b.dateFrom || !b.amount) continue;
      const from = new Date(b.dateFrom);
      if (isNaN(from.getTime())) continue;
      const to = b.dateTo ? new Date(b.dateTo) : new Date(transferDate);
      if (isNaN(to.getTime())) continue;
      const diffMs = to.getTime() - from.getTime();
      if (diffMs <= 0) continue;
      switch (b.frequency) {
        case "ONE_TIME": total += b.amount; break;
        case "WEEKLY": total += b.amount * Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)); break;
        case "MONTHLY": total += b.amount * Math.ceil(diffMs / (30.44 * 24 * 60 * 60 * 1000)); break;
        case "PER_TRIP": total += b.amount; break;
      }
    }
    return Math.round(total * 100) / 100;
  }

  app.post("/api/transfers/calculate", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(),
        fromClub: z.string(),
        toClub: z.string(),
        transferDate: z.string(),
        nvfYear: z.number().int(),
        contractId: z.string().optional().nullable(),
      }).parse(req.body);

      const warnings: string[] = [];
      const nvfSchedule = await storage.getNvfFeeByYearAndType(body.nvfYear, "INTER_ASSOCIATION_TRANSFER_FEE");
      const nvfFee = nvfSchedule?.amount ?? 0;
      if (!nvfSchedule) warnings.push(`NVF fee not configured for year ${body.nvfYear}`);

      let releaseFee = 0;
      let itemsValue = 0;
      let transportValue = 0;
      let membershipOutstanding = 0;
      let developmentOutstanding = 0;
      let contract: any = null;

      if (body.contractId) {
        contract = await storage.getPlayerContract(body.contractId);
        if (contract) {
          const contractRelease = contract.releaseFee ?? 0;
          releaseFee = Math.min(contractRelease, 3000);

          const items = await storage.getContractItems(body.contractId);
          itemsValue = items.reduce((sum: number, it: any) => sum + (it.totalValue || 0), 0);

          const benefits = await storage.getContractTransportBenefits(body.contractId);
          transportValue = computeTransportValue(benefits, body.transferDate);

          membershipOutstanding = Math.max(0, (contract.membershipFeeRequired || 0) - (contract.membershipFeePaid || 0));
          developmentOutstanding = Math.max(0, (contract.developmentFeeRequired || 0) - (contract.developmentFeePaid || 0));
        }
      }

      const totalDue = nvfFee + releaseFee + itemsValue + transportValue + membershipOutstanding + developmentOutstanding;

      const breakdown = {
        nvfFee, releaseFee, itemsValue, transportValue,
        membershipOutstanding, developmentOutstanding, totalDue,
        releaseFeeCapApplied: contract && (contract.releaseFee ?? 0) > 3000,
        originalReleaseFee: contract?.releaseFee ?? 0,
        currency: contract?.currency || "NAD",
        warnings,
      };

      res.json(breakdown);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.post("/api/transfers", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        playerId: z.string(),
        fromClub: z.string(),
        toClub: z.string(),
        transferDate: z.string(),
        nvfYear: z.number().int(),
        contractId: z.string().optional().nullable(),
      }).parse(req.body);

      const nvfSchedule = await storage.getNvfFeeByYearAndType(body.nvfYear, "INTER_ASSOCIATION_TRANSFER_FEE");
      const nvfFee = nvfSchedule?.amount ?? 0;

      let releaseFee = 0, itemsValue = 0, transportValue = 0;
      let membershipOutstanding = 0, developmentOutstanding = 0;

      if (body.contractId) {
        const contract = await storage.getPlayerContract(body.contractId);
        if (contract) {
          releaseFee = Math.min(contract.releaseFee ?? 0, 3000);
          const items = await storage.getContractItems(body.contractId);
          itemsValue = items.reduce((sum: number, it: any) => sum + (it.totalValue || 0), 0);
          const benefits = await storage.getContractTransportBenefits(body.contractId);
          transportValue = computeTransportValue(benefits, body.transferDate);
          membershipOutstanding = Math.max(0, (contract.membershipFeeRequired || 0) - (contract.membershipFeePaid || 0));
          developmentOutstanding = Math.max(0, (contract.developmentFeeRequired || 0) - (contract.developmentFeePaid || 0));
        }
      }

      const totalDue = nvfFee + releaseFee + itemsValue + transportValue + membershipOutstanding + developmentOutstanding;
      const breakdownJson = JSON.stringify({ nvfFee, releaseFee, itemsValue, transportValue, membershipOutstanding, developmentOutstanding, totalDue });

      const tc = await storage.createPlayerTransferCase({
        ...body, contractId: body.contractId || null,
        nvfFee, releaseFee, itemsValue, transportValue,
        membershipOutstanding, developmentOutstanding,
        totalDue, breakdownJson, status: "DRAFT",
      });
      res.status(201).json(tc);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/transfers/player/:playerId", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getPlayerTransferCases(req.params.playerId)); } catch (e) { next(e); }
  });

  app.put("/api/transfers/:id/status", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const { status } = z.object({ status: z.enum(["DRAFT","CONFIRMED","PAID","CLOSED"]) }).parse(req.body);
      const updated = await storage.updatePlayerTransferCase(req.params.id, { status });
      if (!updated) return res.status(404).json({ message: "Transfer case not found" });
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── CONTRACT INVESTMENT SUMMARY PDF ────────────────────────────
  app.post("/api/contracts/:id/investment-pdf", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const contract = await storage.getPlayerContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      const player = await storage.getPlayer(contract.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      const items = await storage.getContractItems(req.params.id);
      const benefits = await storage.getContractTransportBenefits(req.params.id);
      const today = new Date().toISOString().split("T")[0];
      const transportTotal = computeTransportValue(benefits, today);
      const itemsTotal = items.reduce((sum: number, it: any) => sum + (it.totalValue || 0), 0);
      const memReq = contract.membershipFeeRequired || 0;
      const memPaid = contract.membershipFeePaid || 0;
      const devReq = contract.developmentFeeRequired || 0;
      const devPaid = contract.developmentFeePaid || 0;
      const memOutstanding = Math.max(0, memReq - memPaid);
      const devOutstanding = Math.max(0, devReq - devPaid);
      const grandTotal = itemsTotal + transportTotal + memOutstanding + devOutstanding + (contract.signOnFee || 0) + (contract.salaryAmount || 0);
      const cur = contract.currency || "NAD";

      const itemRows = items.map((it: any) => `<tr><td>${esc(it.dateIssued)}</td><td>${esc(it.itemName)}</td><td>${it.quantity}</td><td>${cur} ${(it.unitValue || 0).toFixed(2)}</td><td>${cur} ${(it.totalValue || 0).toFixed(2)}</td><td>${esc(it.notes)}</td></tr>`).join("");
      const benefitRows = benefits.map((b: any) => `<tr><td>${esc(b.benefitType)}</td><td>${esc(b.frequency)}</td><td>${cur} ${(b.amount || 0).toFixed(2)}</td><td>${esc(b.dateFrom)}</td><td>${esc(b.dateTo)}</td><td>${esc(b.notes)}</td></tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Contract Investment Summary</title>
<style>body{font-family:'Segoe UI',sans-serif;margin:40px;color:#333}
.header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #0d7377;padding-bottom:16px;margin-bottom:24px}
.header h1{color:#0d7377;margin:0;font-size:22px}.header h2{margin:4px 0;font-size:14px;color:#666}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd;font-size:13px}
th{background:#0d7377;color:white}
.section{margin-top:24px}
.section h3{color:#0d7377;border-bottom:1px solid #ddd;padding-bottom:6px}
.total-row{font-weight:bold;background:#f0f9f9}
.summary-table td{border:none;padding:4px 12px}
.summary-table .label{color:#666;width:250px}
.summary-table .value{font-weight:bold;text-align:right}
.grand-total{font-size:18px;color:#0d7377;font-weight:bold;margin-top:16px;padding:12px;background:#f0f9f9;border:2px solid #0d7377;text-align:right}
</style></head><body>
<div class="header"><div><h1>AFROCAT VOLLEYBALL CLUB</h1><h2>Contract Investment Summary</h2><p style="font-size:12px;color:#999;margin:2px 0">Generated: ${new Date().toLocaleDateString()}</p></div></div>
<div class="section"><h3>Player & Contract</h3>
<table class="summary-table"><tr><td class="label">Player</td><td class="value">${esc(player.firstName)} ${esc(player.lastName)} (#${player.jerseyNo || '—'})</td></tr>
<tr><td class="label">Contract Type</td><td class="value">${esc(contract.contractType)}</td></tr>
<tr><td class="label">Period</td><td class="value">${esc(contract.startDate)} to ${esc(contract.endDate)}</td></tr>
<tr><td class="label">Status</td><td class="value">${esc(contract.status)}</td></tr>
<tr><td class="label">Currency</td><td class="value">${esc(cur)}</td></tr>
</table></div>
${items.length > 0 ? `<div class="section"><h3>Items Issued (${items.length})</h3>
<table><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th><th>Notes</th></tr></thead><tbody>${itemRows}
<tr class="total-row"><td colspan="4">Items Total</td><td>${cur} ${itemsTotal.toFixed(2)}</td><td></td></tr></tbody></table></div>` : ''}
${benefits.length > 0 ? `<div class="section"><h3>Transport Benefits (${benefits.length})</h3>
<table><thead><tr><th>Type</th><th>Frequency</th><th>Amount</th><th>From</th><th>To</th><th>Notes</th></tr></thead><tbody>${benefitRows}
<tr class="total-row"><td colspan="2">Transport Total</td><td>${cur} ${transportTotal.toFixed(2)}</td><td colspan="3"></td></tr></tbody></table></div>` : ''}
<div class="section"><h3>Fees</h3>
<table class="summary-table">
<tr><td class="label">Membership Fee Required</td><td class="value">${cur} ${memReq.toFixed(2)}</td></tr>
<tr><td class="label">Membership Fee Paid</td><td class="value">${cur} ${memPaid.toFixed(2)}</td></tr>
<tr><td class="label">Membership Outstanding</td><td class="value">${cur} ${Math.max(0, memReq - memPaid).toFixed(2)}</td></tr>
<tr><td class="label">Development Fee Required</td><td class="value">${cur} ${devReq.toFixed(2)}</td></tr>
<tr><td class="label">Development Fee Paid</td><td class="value">${cur} ${devPaid.toFixed(2)}</td></tr>
<tr><td class="label">Development Outstanding</td><td class="value">${cur} ${Math.max(0, devReq - devPaid).toFixed(2)}</td></tr>
${contract.signOnFee ? `<tr><td class="label">Sign-On Fee</td><td class="value">${cur} ${contract.signOnFee.toFixed(2)}</td></tr>` : ''}
${contract.salaryAmount ? `<tr><td class="label">Salary</td><td class="value">${cur} ${contract.salaryAmount.toFixed(2)}</td></tr>` : ''}
</table></div>
<div class="grand-total">Total Club Investment: ${cur} ${grandTotal.toFixed(2)}</div>
</body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  // ─── TRANSFER FEE BREAKDOWN PDF ────────────────────────────
  app.post("/api/transfers/:id/pdf", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const tc = await storage.getPlayerTransferCase(req.params.id);
      if (!tc) return res.status(404).json({ message: "Transfer case not found" });
      const player = await storage.getPlayer(tc.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      let cur = "NAD";
      if (tc.contractId) {
        const contract = await storage.getPlayerContract(tc.contractId);
        if (contract?.currency) cur = contract.currency;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Transfer Fee Breakdown</title>
<style>body{font-family:'Segoe UI',sans-serif;margin:40px;color:#333}
.header{border-bottom:3px solid #0d7377;padding-bottom:16px;margin-bottom:24px}
.header h1{color:#0d7377;margin:0;font-size:22px}.header h2{margin:4px 0;font-size:14px;color:#666}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #ddd;font-size:13px}
th{background:#0d7377;color:white}
.total{font-size:20px;color:#0d7377;font-weight:bold;margin-top:20px;padding:14px;background:#f0f9f9;border:2px solid #0d7377;text-align:right}
.status{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;background:#eee}
</style></head><body>
<div class="header"><h1>AFROCAT VOLLEYBALL CLUB</h1><h2>Transfer Fee Breakdown</h2><p style="font-size:12px;color:#999">Generated: ${new Date().toLocaleDateString()}</p></div>
<table><tbody>
<tr><td><strong>Player</strong></td><td>${esc(player.firstName)} ${esc(player.lastName)} (#${player.jerseyNo || '—'})</td></tr>
<tr><td><strong>From Club</strong></td><td>${esc(tc.fromClub)}</td></tr>
<tr><td><strong>To Club</strong></td><td>${esc(tc.toClub)}</td></tr>
<tr><td><strong>Transfer Date</strong></td><td>${esc(tc.transferDate)}</td></tr>
<tr><td><strong>NVF Year</strong></td><td>${tc.nvfYear}</td></tr>
<tr><td><strong>Status</strong></td><td><span class="status">${esc(tc.status)}</span></td></tr>
</tbody></table>
<h3 style="color:#0d7377;margin-top:24px">Fee Breakdown</h3>
<table><thead><tr><th>Component</th><th style="text-align:right">Amount</th></tr></thead><tbody>
<tr><td>NVF Inter-Association Transfer Fee</td><td style="text-align:right">${cur} ${(tc.nvfFee || 0).toFixed(2)}</td></tr>
<tr><td>Contract Release Fee (capped at ${cur} 3,000)</td><td style="text-align:right">${cur} ${(tc.releaseFee || 0).toFixed(2)}</td></tr>
<tr><td>Items Issued Value</td><td style="text-align:right">${cur} ${(tc.itemsValue || 0).toFixed(2)}</td></tr>
<tr><td>Transport Benefits Value</td><td style="text-align:right">${cur} ${(tc.transportValue || 0).toFixed(2)}</td></tr>
<tr><td>Membership Fee Outstanding</td><td style="text-align:right">${cur} ${(tc.membershipOutstanding || 0).toFixed(2)}</td></tr>
<tr><td>Development Fee Outstanding</td><td style="text-align:right">${cur} ${(tc.developmentOutstanding || 0).toFixed(2)}</td></tr>
</tbody></table>
<div class="total">TOTAL TRANSFER AMOUNT DUE: ${cur} ${(tc.totalDue || 0).toFixed(2)}</div>
<p style="margin-top:30px;font-size:11px;color:#999">Per NVF regulations, the contract release fee may not exceed N$3,000 for transfer to any club/team.</p>
</body></html>`;

      res.json({ html });
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

  function calculateAge(dob: string): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  async function getCaptainPlayerIds(): Promise<Set<string>> {
    const allUsers = await db.select().from(schema.users);
    const captainIds = new Set<string>();
    for (const u of allUsers) {
      const roles: string[] = (u as any).roles || [];
      if (roles.includes("CAPTAIN") && (u as any).playerId) {
        captainIds.add((u as any).playerId);
      }
    }
    return captainIds;
  }

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
        playerOverrides: z.record(z.string(), z.object({
          position: z.string().optional(),
          jerseyNo: z.number().optional(),
        })).optional(),
      }).parse(req.body);

      const team = await storage.getTeam(body.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      if (req.user!.role === "COACH") {
        const assignments = await storage.getCoachAssignmentsByTeam(body.teamId);
        const isAssigned = assignments.some(a => a.coachUserId === req.user!.userId && a.active);
        if (!isAssigned) return res.status(403).json({ message: "You are not assigned to this team" });
      }

      const o2bisTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, body.teamId)).then(r => r[0]);
      let allTeamPlayers: any[];
      if (o2bisTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, body.teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        allTeamPlayers = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo };
        }).filter(Boolean) as any[];
      } else {
        allTeamPlayers = await storage.getPlayersByTeam(body.teamId);
      }
      let playerList: any[];
      if (body.selectedPlayerIds && body.selectedPlayerIds.length > 0) {
        playerList = allTeamPlayers.filter((p: any) => body.selectedPlayerIds!.includes(p.id));
      } else {
        playerList = allTeamPlayers;
      }

      const captainIds = await getCaptainPlayerIds();
      const officials = await storage.getTeamOfficials(body.teamId);

      const coachAssignments = await storage.getCoachAssignmentsByTeam(body.teamId);
      const activeCoaches = coachAssignments.filter(a => a.active);
      let headCoachName = body.coachName || "";
      let assistantCoaches: string[] = [];
      for (const a of activeCoaches) {
        const coachUser = await storage.getUser(a.coachUserId);
        if (coachUser) {
          if (a.role === "HEAD_COACH" && !headCoachName) headCoachName = coachUser.fullName;
          else assistantCoaches.push(coachUser.fullName);
        }
      }

      const overrides = body.playerOverrides || {};
      const sortedPlayers = [...playerList].sort((a, b) => {
        const jA = overrides[a.id]?.jerseyNo ?? a.jerseyNo ?? 0;
        const jB = overrides[b.id]?.jerseyNo ?? b.jerseyNo ?? 0;
        return jA - jB;
      });

      const teamGender = team.gender || (sortedPlayers.length > 0 ? sortedPlayers[0].gender : "");
      const teamCountry = sortedPlayers.length > 0 ? (sortedPlayers[0].nationality || "Namibia") : "Namibia";

      const o2bisData = {
        clubName: "AFROCAT VOLLEYBALL CLUB",
        motto: "One Team One Dream — Passion Discipline Victory",
        teamName: team.name,
        gender: teamGender || "",
        country: teamCountry,
        code: team.code || "",
        opponent: body.opponent,
        matchDate: body.matchDate,
        matchTime: body.matchTime || "",
        venue: body.venue,
        competition: body.competition,
        headCoach: headCoachName,
        assistantCoaches,
        players: sortedPlayers.map(p => ({
          jerseyNo: overrides[p.id]?.jerseyNo ?? p.jerseyNo,
          name: `${(p.lastName || "").toUpperCase()} ${p.firstName}`,
          position: overrides[p.id]?.position || p.position,
          dob: p.dob || "",
          age: calculateAge(p.dob || ""),
          isCaptain: captainIds.has(p.id),
          nationality: p.nationality || "Namibia",
        })),
        officials: officials.map(o => ({ role: o.role, name: o.name })),
        teamManager: officials.find(o => o.role === "TEAM_MANAGER")?.name || "",
        therapist: officials.find(o => o.role === "THERAPIST")?.name || "",
        doctor: officials.find(o => o.role === "DOCTOR")?.name || "",
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

  // ─── O2BIS COMPLETENESS CHECK ────────────────────
  app.get("/api/docs/o2bis/:matchId/check", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const missing: string[] = [];
      if (!match.venue) missing.push("Venue");
      if (!match.startTime) missing.push("Start Time");
      if (!match.competition) missing.push("Competition");

      const staffRows = await db.select().from(schema.matchStaffAssignments)
        .where(eq(schema.matchStaffAssignments.matchId, req.params.matchId));
      const staff = staffRows[0];
      if (!staff) {
        missing.push("Head Coach", "Assistant Coach", "Medic", "Team Manager");
      } else {
        if (!staff.headCoachUserId) missing.push("Head Coach");
        if (!staff.assistantCoachUserId) missing.push("Assistant Coach");
        if (!staff.medicUserId) missing.push("Medic");
        if (!staff.teamManagerUserId) missing.push("Team Manager");
      }

      const squad = await storage.getMatchSquad(req.params.matchId, match.teamId);
      if (!squad) {
        missing.push("Squad Selection");
      } else {
        const entries = await storage.getMatchSquadEntries(squad.id);
        if (entries.length === 0) missing.push("Squad Selection");
      }

      res.json({ ok: true, canGenerate: true, missing });
    } catch (e) { next(e); }
  });

  // ─── O2BIS PDF DOWNLOAD ────────────────────
  app.get("/api/docs/o2bis/:matchId.pdf", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const matchId = req.params.matchId;
      const skipMissing = req.query.skipMissing === "true";
      const teamId = (req.query.teamId as string) || undefined;

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const resolvedTeamId = teamId || match.teamId;
      if (resolvedTeamId !== match.teamId) {
        return res.status(400).json({ message: "teamId does not match this match's team" });
      }
      const liberoCheck = await validateLiberoRule(storage, matchId, resolvedTeamId);
      if (!liberoCheck.valid) {
        return res.status(400).json({
          message: "Libero validation failed",
          needsLiberos: true,
          totalSelected: liberoCheck.totalSelected,
          liberoCount: liberoCheck.liberoCount,
        });
      }

      const pdfBuffer = await generateO2BISPdf(storage, { matchId, teamId: resolvedTeamId, skipMissing });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="O2BIS_${matchId}.pdf"`);
      res.send(pdfBuffer);
    } catch (e) { next(e); }
  });

  app.get("/api/docs/o2bis/:matchId/preview.pdf", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const matchId = req.params.matchId;
      const teamId = (req.query.teamId as string) || undefined;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const resolvedTeamId = teamId || match.teamId;
      const pdfBuffer = await generateO2BISPdf(storage, { matchId, teamId: resolvedTeamId, skipMissing: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="O2BIS_Preview_${matchId}.pdf"`);
      res.send(pdfBuffer);
    } catch (e) { next(e); }
  });

  // ─── AUTO-SELECT LIBEROS ─────────────────────────
  app.post("/api/matches/:matchId/squad/auto-select-liberos", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const body = z.object({ teamId: z.string() }).parse(req.body);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (body.teamId !== match.teamId) {
        return res.status(400).json({ message: "teamId does not match this match's team" });
      }

      const check = await validateLiberoRule(storage, matchId, body.teamId);
      if (check.totalSelected < 14) {
        return res.status(400).json({ message: "Libero auto-select only applies when squad has 14+ players" });
      }

      const selectedPlayerIds = await autoSelectLiberos(storage, matchId, body.teamId);
      res.json({ ok: true, selectedLiberos: selectedPlayerIds });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── LIBERO VALIDATION CHECK ────────────────────
  app.get("/api/matches/:matchId/squad/libero-check", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ message: "teamId query parameter required" });

      const result = await validateLiberoRule(storage, matchId, teamId);
      res.json(result);
    } catch (e) { next(e); }
  });

  // ─── TEAM LIST GENERATION ─────────────────────────
  app.post("/api/team-list/generate", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({ teamId: z.string() }).parse(req.body);

      const team = await storage.getTeam(body.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const allPlayers = await storage.getPlayersByTeam(body.teamId);
      const activePlayers = allPlayers.filter(p => p.status === "ACTIVE");
      const captainIds = await getCaptainPlayerIds();

      const coachAssignments = await storage.getCoachAssignmentsByTeam(body.teamId);
      const activeCoaches = coachAssignments.filter(a => a.active);
      let headCoachName = "";
      let assistantCoaches: string[] = [];
      for (const a of activeCoaches) {
        const coachUser = await storage.getUser(a.coachUserId);
        if (coachUser) {
          if (a.role === "HEAD_COACH") headCoachName = coachUser.fullName;
          else assistantCoaches.push(coachUser.fullName);
        }
      }

      const officials = await storage.getTeamOfficials(body.teamId);

      const sortedPlayers = [...activePlayers].sort((a, b) => (a.jerseyNo || 0) - (b.jerseyNo || 0));

      const data = {
        clubName: "AFROCAT VOLLEYBALL CLUB",
        motto: "One Team One Dream — Passion Discipline Victory",
        teamName: team.name || "",
        gender: team.gender || "",
        generatedDate: new Date().toISOString().split("T")[0],
        headCoach: headCoachName || "",
        assistantCoaches,
        players: sortedPlayers.map(p => ({
          jerseyNo: p.jerseyNo ?? 0,
          name: `${(p.lastName || "").toUpperCase()} ${p.firstName || ""}`.trim(),
          position: p.position || "",
          dob: p.dob || "",
          age: calculateAge(p.dob || ""),
          isCaptain: captainIds.has(p.id),
          nationality: p.nationality || "",
          country: (p.nationality || "").substring(0, 3).toUpperCase(),
          gender: (p.gender || "").charAt(0).toUpperCase() || "",
          phone: p.phone || "",
        })),
        officials: officials.map(o => ({ role: o.role || "", name: o.name || "" })),
        teamManager: officials.find(o => o.role === "TEAM_MANAGER")?.name || "",
      };

      const docRecord = await storage.createMatchDocument({
        matchId: null,
        teamId: body.teamId,
        documentType: "TEAM_LIST",
        fileUrl: `/api/team-list/view/${Date.now()}`,
        metadata: data,
      });

      res.status(201).json({ documentId: docRecord.id, data });
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

      // Count attack attempts per player from raw events (for efficiency calculation)
      const matchEvents = await storage.getMatchEvents(matchId);
      const attackAttemptsMap: Record<string, number> = {};
      const setScoresMap: Record<number, { home: number; away: number }> = {};
      for (const ev of matchEvents) {
        if (ev.action === "ATTACK") attackAttemptsMap[ev.playerId] = (attackAttemptsMap[ev.playerId] || 0) + 1;
        const sn = (ev as any).setNumber || 1;
        if (!setScoresMap[sn]) setScoresMap[sn] = { home: 0, away: 0 };
        if ((ev as any).pointWonByTeamId === teamId) setScoresMap[sn].home++;
        else if ((ev as any).pointWonByTeamId === "OPPONENT") setScoresMap[sn].away++;
      }
      const setScores = Object.entries(setScoresMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([sn, sc]) => ({ setNumber: Number(sn), home: sc.home, away: sc.away, won: sc.home > sc.away }));

      const assignments = await storage.getCoachAssignmentsByTeam(teamId);
      const headCoach = assignments.find(a => a.assignmentRole === "HEAD_COACH" && a.active);
      let coachName = "";
      if (headCoach) {
        const coachUser = await storage.getUser(headCoach.coachUserId);
        coachName = coachUser?.fullName || "";
      }

      const enrichedStats = stats.map(s => {
        const player = playerMap.get(s.playerId);
        const attackAtt = attackAttemptsMap[s.playerId] || 0;
        const attackEff = attackAtt > 0 ? Math.round(((s.spikesKill || 0) - (s.spikesError || 0)) / attackAtt * 100) : null;
        return {
          ...s,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          jerseyNo: player?.jerseyNo ?? 0,
          position: player?.position ?? "",
          attackAtt,
          attackEff,
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
        attackAtt: enrichedStats.reduce((sum, s) => sum + (s.attackAtt || 0), 0),
      };
      // Team attack efficiency
      const teamAttackEff = teamTotals.attackAtt > 0
        ? Math.round((teamTotals.spikesKill - teamTotals.spikesError) / teamTotals.attackAtt * 100)
        : null;
      (teamTotals as any).attackEff = teamAttackEff;

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
        setScores,
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
          receivePerfect: s.receivePerfect || 0,
          totalErrors: (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0),
          attackAtt: s.attackAtt || 0,
          attackEff: s.attackEff,
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
          receivePerfect: s.receivePerfect || 0,
          totalErrors: (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0),
          attackAtt: s.attackAtt || 0,
          attackEff: s.attackEff,
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
      const team = await db.select().from(schema.teams).where(eq(schema.teams.id, req.params.teamId)).then(r => r[0]);
      let players: any[];
      if (team?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, req.params.teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        players = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo, teamId: req.params.teamId };
        }).filter(Boolean) as any[];
      } else {
        players = await storage.getPlayersByTeam(req.params.teamId);
      }

      const injuries = await storage.getInjuries();
      const contracts = await storage.getAllContracts();

      const enriched = players.map((p: any) => {
        const warnings: string[] = [];
        if (p.status && p.status !== "ACTIVE") warnings.push(`Status: ${p.status}`);
        if (p.eligibilityStatus === "NOT_ELIGIBLE") warnings.push(p.eligibilityNotes || "Marked ineligible");
        const openInjury = injuries.find((i: any) => i.playerId === p.id && i.status === "OPEN");
        if (openInjury) warnings.push(`Injury: ${openInjury.injuryType}`);
        const activeContract = contracts.find((c: any) => c.playerId === p.id && c.status === "ACTIVE");
        const contractWarning = !activeContract;
        const missingFields: string[] = [];
        if (!p.firstName) missingFields.push("firstName");
        if (!p.lastName) missingFields.push("lastName");
        if (!p.dob) missingFields.push("dob");
        if (!p.nationality) missingFields.push("nationality");
        if (!p.jerseyNo) missingFields.push("jerseyNo");
        if (!p.position) missingFields.push("position");
        return {
          ...p,
          eligible: true,
          ineligibilityReasons: warnings,
          hasWarnings: warnings.length > 0,
          contractWarning,
          missingFields,
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
      // Enrich each entry with full player details (match-specific overrides take priority)
      const enriched = await Promise.all(entries.map(async (e) => {
        const p = await storage.getPlayer(e.playerId);
        return {
          ...e,
          player: p ? {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            fullName: p.fullName || [p.firstName, p.lastName].filter(Boolean).join(" "),
            position: p.position,
            jerseyNo: p.jerseyNo,
            photoUrl: p.photoUrl,
            gender: p.gender,
          } : null,
          // Effective values: entry overrides player defaults
          effectiveJerseyNo: e.jerseyNo ?? (p?.jerseyNo ?? null),
          effectivePosition: e.matchPosition || p?.position || "",
          displayName: p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.fullName || "Unknown" : "Unknown",
        };
      }));
      res.json({ squad, entries: enriched });
    } catch (e) { next(e); }
  });

  app.post("/api/squad", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        matchId: z.string(),
        teamId: z.string(),
        playerIds: z.array(z.string()).min(1).max(14),
        playerDetails: z.record(z.string(), z.object({
          isLibero: z.boolean().optional(),
          isCaptain: z.boolean().optional(),
          matchPosition: z.string().optional(),
        })).optional(),
      }).parse(req.body);

      if (body.playerIds.length > 14) {
        return res.status(400).json({ message: "Maximum 14 players allowed in a match squad" });
      }

      const details = body.playerDetails || {};
      const captainCount = Object.values(details).filter(d => d.isCaptain).length;
      if (captainCount > 1) {
        return res.status(400).json({ message: "Only one captain allowed per squad" });
      }

      if (body.playerIds.length >= 14) {
        const liberoCount = Object.values(details).filter(d => d.isLibero).length;
        if (liberoCount < 2) {
          return res.status(400).json({ message: "Squads with 14 players must have at least 2 liberos designated" });
        }
      }

      const squadTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, body.teamId)).then(r => r[0]);
      let teamPlayers: any[];
      if (squadTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, body.teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        teamPlayers = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo, teamId: body.teamId };
        }).filter(Boolean) as any[];
      } else {
        teamPlayers = await storage.getPlayersByTeam(body.teamId);
      }
      const teamPlayerIds = new Set(teamPlayers.map((p: any) => p.id));
      const invalidIds = body.playerIds.filter(id => !teamPlayerIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ message: "Some players do not belong to this team" });
      }

      const existing = await storage.getMatchSquad(body.matchId, body.teamId);
      let previousPlayerIds: Set<string> = new Set();
      if (existing) {
        const prevEntries = await storage.getMatchSquadEntries(existing.id);
        previousPlayerIds = new Set(prevEntries.map((e: any) => e.playerId));
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
        const d = details[pid] || {};
        const entry = await storage.createMatchSquadEntry({
          squadId: squad.id,
          playerId: pid,
          jerseyNo: player?.jerseyNo || null,
          isLibero: d.isLibero || false,
          isCaptain: d.isCaptain || false,
          matchPosition: d.matchPosition || null,
        });
        entries.push(entry);
      }

      const match = await storage.getMatch(body.matchId);
      const team = await storage.getTeam(body.teamId);
      const newlyAdded = body.playerIds.filter(pid => !previousPlayerIds.has(pid));

      if (match && team && newlyAdded.length > 0) {
        const matchLabel = `${team.name} vs ${match.opponent} on ${match.matchDate}${match.venue ? ` at ${match.venue}` : ""}`;
        for (const pid of newlyAdded) {
          const player = teamPlayers.find(p => p.id === pid);
          if (player?.userId) {
            try {
              await storage.createNotification({
                userId: player.userId,
                playerId: pid,
                type: "MATCH_SELECTION",
                title: "🏐 You've been selected!",
                message: `You are selected for: ${matchLabel}.`,
                metadata: { matchId: body.matchId, teamId: body.teamId },
              });
            } catch (_) {}
          }
        }

        const admins = await storage.getUsersByRole("ADMIN");
        for (const admin of admins) {
          if (admin.id === req.user!.userId) continue;
          try {
            await storage.createNotification({
              userId: admin.id,
              type: "MATCH_SELECTION",
              title: "Squad Updated",
              message: `${newlyAdded.length} player(s) added to squad for ${matchLabel}.`,
              metadata: { matchId: body.matchId },
            });
          } catch (_) {}
        }
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

      const teams = await storage.getTeams();
      const teamMap = new Map(teams.map(t => [t.id, t]));
      const playerTeam = teamMap.get(player.teamId);

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
            isHome: m?.venue === "Home",
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
          result: s.result,
          isHome: s.isHome,
        }));

      const totals = {
        matches: allStats.length,
        pointsTotal: allStats.reduce((s, st) => s + (st.pointsTotal ?? 0), 0),
        kills: allStats.reduce((s, st) => s + (st.spikesKill ?? 0), 0),
        aces: allStats.reduce((s, st) => s + (st.servesAce ?? 0), 0),
        blocks: allStats.reduce((s, st) => s + (st.blocksSolo ?? 0) + (st.blocksAssist ?? 0), 0),
        digs: allStats.reduce((s, st) => s + (st.digs ?? 0), 0),
        settingAssist: allStats.reduce((s, st) => s + (st.settingAssist ?? 0), 0),
        spikesError: allStats.reduce((s, st) => s + (st.spikesError ?? 0), 0),
        servesError: allStats.reduce((s, st) => s + (st.servesError ?? 0), 0),
        receiveError: allStats.reduce((s, st) => s + (st.receiveError ?? 0), 0),
        settingError: allStats.reduce((s, st) => s + (st.settingError ?? 0), 0),
        minutesPlayed: allStats.reduce((s, st) => s + (st.minutesPlayed ?? 0), 0),
      };

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

      const teamMatches = player.teamId ? await storage.getMatchesByTeam(player.teamId) : [];
      const enrichedTeamMatches = teamMatches.map(enrichMatch);

      const upcomingFixture = enrichedTeamMatches
        .filter((m: any) => m.status === "UPCOMING")
        .sort((a: any, b: any) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0] || null;

      const recentTeamMatches = enrichedTeamMatches
        .filter((m: any) => m.status === "PLAYED" || m.status === "PAST_NO_SCORE")
        .sort((a: any, b: any) => new Date(b.startTime || b.matchDate).getTime() - new Date(a.startTime || a.matchDate).getTime())
        .slice(0, 5)
        .map((m: any) => ({
          matchId: m.id,
          opponent: m.opponent,
          date: m.matchDate,
          venue: m.venue,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          result: m.result,
          status: m.status,
          statusLabel: m.status === "PLAYED" ? "Past Match (Final)" : "Past Match (Score Missing)",
        }));

      let upcomingCoachName: string | null = null;
      if (upcomingFixture && player.teamId) {
        const headCoach = await storage.getActiveHeadCoachForTeam(player.teamId, upcomingFixture.matchDate);
        if (headCoach) {
          const coachUser = await storage.getUser(headCoach.coachUserId);
          upcomingCoachName = coachUser?.fullName || null;
        }
      }

      const motivationalMessages: string[] = [];
      const attRate = attendanceSummary.total > 0 ? ((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 100 : 100;
      if (attRate >= 90) motivationalMessages.push("🔥 Elite discipline! Keep leading by example.");
      else if (attRate >= 70) motivationalMessages.push("✅ Good consistency — aim for 90% attendance this month.");
      else if (attendanceSummary.total > 0) motivationalMessages.push("⚠️ Attendance is holding you back. Let's commit to training this week.");

      if (statsWithMatch.length >= 3) {
        const last3 = statsWithMatch.slice(0, 3);
        const trend = last3.map(s => s.pointsTotal ?? 0);
        if (trend[0] > trend[1] && trend[1] > trend[2]) motivationalMessages.push("📈 Great progress! Keep building on your strengths.");
        else if (trend[0] < trend[1] && trend[1] < trend[2]) motivationalMessages.push("🛠️ Tough stretch — focus on your Smart Focus areas.");
      }

      const totalErrors = (totals.spikesError || 0) + (totals.servesError || 0) + (totals.receiveError || 0);
      if (allStats.length > 0 && totalErrors / allStats.length > 3) {
        const worstError = Math.max(totals.spikesError || 0, totals.servesError || 0, totals.receiveError || 0);
        const area = worstError === (totals.servesError || 0) ? "Serving" : worstError === (totals.spikesError || 0) ? "Spiking" : "Receiving";
        motivationalMessages.push(`🎯 Focus: ${area} consistency — reduce errors next session.`);
      }

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
          teamName: playerTeam?.name || null,
        },
        totals,
        recentStats: statsWithMatch,
        performanceTrend,
        motivationalMessages,
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
        upcomingFixture: upcomingFixture ? {
          matchId: upcomingFixture.id,
          date: upcomingFixture.matchDate,
          startTime: upcomingFixture.startTime,
          venue: upcomingFixture.venue,
          competition: upcomingFixture.competition,
          opponent: upcomingFixture.opponent,
          teamName: playerTeam?.name || null,
          isHome: upcomingFixture.venue === "Home",
          coachName: upcomingCoachName,
          timeLeftLabel: upcomingFixture.timeLeftLabel || null,
          timeLeftSeconds: upcomingFixture.timeLeftSeconds || null,
        } : null,
        recentTeamMatches,
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

  // ─── ADMIN: REGISTRATION APPROVALS ─────────────────
  app.get("/api/admin/registrations/pending", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const roleFilter = req.query.role as string | undefined;
      const pending = await storage.getPendingRegistrations();
      const filtered = roleFilter
        ? pending.filter(({ user: u }) => u.role === roleFilter)
        : pending;
      res.json(filtered.map(({ user: u, player: p }) => ({
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        accountStatus: u.accountStatus,
        createdAt: u.createdAt,
        playerId: p?.id,
        requestedTeamId: p?.requestedTeamId,
        teamApprovalStatus: p?.teamApprovalStatus,
        requestedPosition: p?.requestedPosition,
        positionApprovalStatus: p?.positionApprovalStatus,
        requestedJerseyNo: p?.requestedJerseyNo,
        jerseyApprovalStatus: p?.jerseyApprovalStatus,
        registrationStatus: p?.registrationStatus,
      })));
    } catch (e) { next(e); }
  });

  app.post("/api/admin/registrations/:userId/approve", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({ roleOverride: z.enum(["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL","PLAYER"]).optional() }).parse(req.body || {});
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.accountStatus === "ACTIVE") return res.status(400).json({ message: "User is already active" });

      const finalRole = body.roleOverride || user.role;
      await storage.updateUser(user.id, { accountStatus: "ACTIVE", role: finalRole } as any);

      if (user.playerId) {
        const updateData: any = { registrationStatus: "APPROVED" };

        const settings = await storage.getSecuritySettings();
        const player = await storage.getPlayer(user.playerId);

        if (settings?.autoApproveTeamRequests && player?.requestedTeamId) {
          updateData.teamId = player.requestedTeamId;
          updateData.teamApprovalStatus = "APPROVED";
          updateData.teamApprovedByUserId = req.user!.userId;
        }
        if (settings?.autoApprovePosition && player?.requestedPosition) {
          updateData.position = player.requestedPosition;
          updateData.positionApprovalStatus = "APPROVED";
          updateData.positionApprovedByUserId = req.user!.userId;
        }
        if (settings?.autoApproveJersey && player?.requestedJerseyNo && updateData.teamId) {
          const existing = await storage.getPlayersByJerseyAndTeam(updateData.teamId, player.requestedJerseyNo);
          if (existing.length === 0) {
            updateData.jerseyNo = player.requestedJerseyNo;
            updateData.jerseyApprovalStatus = "APPROVED";
            updateData.jerseyApprovedByUserId = req.user!.userId;
          }
        }
        updateData.approvedAt = new Date();
        await storage.updatePlayer(user.playerId, updateData);
      }

      res.json({ message: "Registration approved" });
    } catch (e) { next(e); }
  });

  app.post("/api/admin/registrations/:userId/reject", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      await storage.updateUser(user.id, { accountStatus: "REJECTED" } as any);
      if (user.playerId) {
        await storage.updatePlayer(user.playerId, {
          registrationStatus: "REJECTED",
          registrationNotes: reason || null,
        } as any);
      }
      res.json({ message: "Registration rejected" });
    } catch (e) { next(e); }
  });

  app.post("/api/admin/registrations/:userId/verify-email", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExp: null,
      } as any);
      res.json({ message: "Email verified by admin" });
    } catch (e) { next(e); }
  });

  // ─── PLAYER APPROVAL ENDPOINTS (Position/Jersey/Team) ────
  app.post("/api/players/:playerId/approve-team", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { teamId } = z.object({ teamId: z.string().min(1) }).parse(req.body);
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      const team = await storage.getTeam(teamId);
      if (!team) return res.status(400).json({ message: "Team not found" });

      if (player.gender) {
        const gv = validateTeamGender(team.name, player.gender);
        if (!gv.ok) return res.status(400).json({ message: gv.error });
      }

      await storage.updatePlayer(player.id, {
        teamId,
        teamApprovalStatus: "APPROVED",
        teamApprovedByUserId: req.user!.userId,
        approvedAt: new Date(),
      } as any);
      res.json({ message: "Team approved" });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.post("/api/players/:playerId/reject-team", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      await storage.updatePlayer(player.id, { teamApprovalStatus: "REJECTED" } as any);
      res.json({ message: "Team request rejected" });
    } catch (e) { next(e); }
  });

  app.post("/api/players/:playerId/approve-position", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { position } = z.object({
        position: z.enum(["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"]),
      }).parse(req.body);
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      await storage.updatePlayer(player.id, {
        position,
        positionApprovalStatus: "APPROVED",
        positionApprovedByUserId: req.user!.userId,
        approvedAt: new Date(),
      } as any);
      res.json({ message: "Position approved" });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.post("/api/players/:playerId/reject-position", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      await storage.updatePlayer(player.id, { positionApprovalStatus: "REJECTED" } as any);
      res.json({ message: "Position request rejected" });
    } catch (e) { next(e); }
  });

  app.post("/api/players/:playerId/approve-jersey", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { jerseyNo } = z.object({ jerseyNo: z.number().int().min(1).max(99) }).parse(req.body);
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      if (!player.teamId || player.teamApprovalStatus !== "APPROVED") {
        return res.status(400).json({ message: "Approve team first, then assign jersey." });
      }

      const existing = await storage.getPlayersByJerseyAndTeam(player.teamId, jerseyNo);
      const conflicting = existing.filter(p => p.id !== player.id);
      if (conflicting.length > 0) {
        return res.status(400).json({ message: `Jersey #${jerseyNo} is already taken in this team.` });
      }

      await storage.updatePlayer(player.id, {
        jerseyNo,
        jerseyApprovalStatus: "APPROVED",
        jerseyApprovedByUserId: req.user!.userId,
        approvedAt: new Date(),
      } as any);
      res.json({ message: "Jersey number approved" });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.post("/api/players/:playerId/reject-jersey", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      await storage.updatePlayer(player.id, { jerseyApprovalStatus: "REJECTED" } as any);
      res.json({ message: "Jersey request rejected" });
    } catch (e) { next(e); }
  });

  // ─── SECURITY SETTINGS ──────────────────────────────
  app.get("/api/admin/security-settings", requireAuth, requireRole(["ADMIN"]), async (_req, res, next) => {
    try {
      let settings = await storage.getSecuritySettings();
      if (!settings) {
        settings = await storage.upsertSecuritySettings({
          id: "security",
          requireEmailVerification: true,
          requireAdminApproval: true,
          autoApproveTeamRequests: false,
          autoApprovePosition: false,
          autoApproveJersey: false,
        });
      }
      res.json(settings);
    } catch (e) { next(e); }
  });

  app.put("/api/admin/security-settings", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const body = z.object({
        requireEmailVerification: z.boolean().optional(),
        requireAdminApproval: z.boolean().optional(),
        autoApproveTeamRequests: z.boolean().optional(),
        autoApprovePosition: z.boolean().optional(),
        autoApproveJersey: z.boolean().optional(),
        allowedEmailDomains: z.string().nullable().optional(),
      }).parse(req.body);
      const settings = await storage.upsertSecuritySettings(body);
      res.json(settings);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  // ─── TRAINING SCHEDULE & NOTIFICATIONS ──────────

  app.get("/api/training/my-schedule", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.user!.playerId;
      if (!playerId) return res.json({ todaySession: null, upcomingSessions: [], pendingCheckin: [] });

      const player = await storage.getPlayer(playerId);
      if (!player) return res.json({ todaySession: null, upcomingSessions: [], pendingCheckin: [] });

      const team = player.teamId ? (await storage.getTeams()).find(t => t.id === player.teamId) : null;
      const category = team?.category || "MEN";

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const dayOfWeek = now.getDay();

      const trainingDays = [...(TRAINING_SCHEDULE[category] || []), ...TRAINING_SCHEDULE.ALL];

      const isTrainingDay = trainingDays.includes(dayOfWeek);

      let todaySession: any = null;
      const pendingCheckin: any[] = [];

      if (team) {
        const sessions = await storage.getAttendanceSessions(team.id);
        const todaySess = sessions.find(s => s.sessionDate === todayStr && s.sessionType === "TRAINING");
        if (todaySess) {
          const existingRecord = await storage.getAttendanceRecordBySessionAndPlayer(todaySess.id, playerId);
          todaySession = {
            ...todaySess,
            teamName: team.name,
            alreadyCheckedIn: !!existingRecord,
            checkinStatus: existingRecord?.status || null,
          };
        }

        for (const sess of sessions) {
          if (sess.sessionDate <= todayStr && sess.sessionType === "TRAINING") {
            const record = await storage.getAttendanceRecordBySessionAndPlayer(sess.id, playerId);
            if (!record) {
              pendingCheckin.push({ ...sess, teamName: team.name });
            }
          }
        }
      }

      const upcoming: any[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dow = d.getDay();
        if (trainingDays.includes(dow)) {
          const dateStr = d.toISOString().split("T")[0];
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
          upcoming.push({ date: dateStr, dayName, teamName: team?.name || "Unassigned" });
        }
      }

      res.json({
        todaySession,
        isTrainingDay,
        trainingDays: trainingDays.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]),
        upcomingSessions: upcoming,
        pendingCheckin: pendingCheckin.slice(0, 5),
      });
    } catch (e) { next(e); }
  });

  app.post("/api/training/auto-generate", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const teams = await storage.getTeams();
      const now = new Date();
      const created: any[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dow = d.getDay();
        const dateStr = d.toISOString().split("T")[0];

        for (const team of teams) {
          const teamDays = [...(TRAINING_SCHEDULE[team.category] || []), ...TRAINING_SCHEDULE.ALL];
          if (!teamDays.includes(dow)) continue;

          const existing = (await storage.getAttendanceSessions(team.id))
            .find(s => s.sessionDate === dateStr && s.sessionType === "TRAINING");
          if (existing) continue;

          const session = await storage.createAttendanceSession({
            teamId: team.id,
            sessionDate: dateStr,
            sessionType: "TRAINING",
            notes: `Auto-scheduled: ${d.toLocaleDateString("en-US", { weekday: "long" })} training`,
          });
          created.push({ ...session, teamName: team.name });
        }
      }

      res.json({ generated: created.length, sessions: created });
    } catch (e) { next(e); }
  });

  app.post("/api/training/schedule-custom", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        teamId: z.string().optional(),
        playerIds: z.array(z.string()).optional(),
        sessionDate: z.string(),
        sessionType: z.enum(["TRAINING","MATCH","GYM"]).default("TRAINING"),
        notes: z.string().optional(),
      }).parse(req.body);

      const teams = await storage.getTeams();
      const allUsers = await db.select().from(schema.users);
      const created: any[] = [];

      if (body.teamId) {
        const team = teams.find(t => t.id === body.teamId);
        const session = await storage.createAttendanceSession({
          teamId: body.teamId,
          sessionDate: body.sessionDate,
          sessionType: body.sessionType as any,
          notes: body.notes || `Scheduled by ${req.user!.role}`,
        });
        created.push(session);

        const players = await storage.getPlayersByTeam(body.teamId);
        for (const p of players) {
          const linkedUser = allUsers.find(u => u.playerId === p.id);
          await storage.createNotification({
            userId: linkedUser?.id || null,
            playerId: p.id,
            type: "TRAINING_SCHEDULED",
            title: `${body.sessionType} Session Scheduled`,
            message: `${team?.name || "Your team"} has a ${body.sessionType.toLowerCase()} session on ${body.sessionDate}. ${body.notes || ""}`.trim(),
            metadata: { sessionId: session.id, teamId: body.teamId, date: body.sessionDate },
            read: false,
          });
        }
      }

      if (body.playerIds && body.playerIds.length > 0) {
        const playerIdSet = new Set(body.playerIds);
        const teamPlayerMap = new Map<string, string[]>();
        for (const pid of body.playerIds) {
          const player = await storage.getPlayer(pid);
          if (!player) continue;
          const list = teamPlayerMap.get(player.teamId) || [];
          list.push(pid);
          teamPlayerMap.set(player.teamId, list);
        }

        for (const [teamId] of teamPlayerMap) {
          const existing = (await storage.getAttendanceSessions(teamId))
            .find(s => s.sessionDate === body.sessionDate && s.sessionType === body.sessionType);
          const session = existing || await storage.createAttendanceSession({
            teamId,
            sessionDate: body.sessionDate,
            sessionType: body.sessionType as any,
            notes: body.notes || `Scheduled by ${req.user!.role} for selected players`,
          });
          if (!existing) created.push(session);
        }

        for (const pid of body.playerIds) {
          const linkedUser = allUsers.find(u => u.playerId === pid);
          const player = await storage.getPlayer(pid);
          await storage.createNotification({
            userId: linkedUser?.id || null,
            playerId: pid,
            type: "TRAINING_SCHEDULED",
            title: `${body.sessionType} Session Scheduled`,
            message: `You have been scheduled for a ${body.sessionType.toLowerCase()} session on ${body.sessionDate}. ${body.notes || ""}`.trim(),
            metadata: { date: body.sessionDate, teamId: player?.teamId },
            read: false,
          });
        }
      }

      res.json({ success: true, sessionsCreated: created.length });
    } catch (e) { next(e); }
  });

  app.get("/api/training/coach-summary", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      const sessions = await storage.getAttendanceSessions(teamId || undefined);
      const today = new Date().toISOString().split("T")[0];
      const todaySessions = sessions.filter(s => s.sessionDate === today);

      const summaries: any[] = [];
      for (const sess of todaySessions) {
        const records = await storage.getAttendanceRecords(sess.id);
        const teams = await storage.getTeams();
        const team = teams.find(t => t.id === sess.teamId);
        const players = await storage.getPlayersByTeam(sess.teamId);

        summaries.push({
          session: { ...sess, teamName: team?.name },
          totalPlayers: players.length,
          present: records.filter(r => r.status === "PRESENT").length,
          late: records.filter(r => r.status === "LATE").length,
          absent: players.length - records.length,
          checkedIn: records.length,
          records: records.map(r => {
            const p = players.find(pl => pl.id === r.playerId);
            return { ...r, playerName: p ? `${p.firstName} ${p.lastName}` : "Unknown", jerseyNo: p?.jerseyNo };
          }),
        });
      }

      res.json(summaries);
    } catch (e) { next(e); }
  });

  app.get("/api/training/attendance-report", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.query.playerId as string || req.user!.playerId;
      if (!playerId) return res.json({ weekly: null, monthly: null });

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const monthStartStr = monthStart.toISOString().split("T")[0];

      const allRecords = await storage.getAttendanceRecordsByPlayer(playerId);

      const player = await storage.getPlayer(playerId);
      const teamSessions = player?.teamId ? await storage.getAttendanceSessions(player.teamId) : [];

      const weekSessions = teamSessions.filter(s => s.sessionDate >= weekStartStr && s.sessionType === "TRAINING");
      const monthSessions = teamSessions.filter(s => s.sessionDate >= monthStartStr && s.sessionType === "TRAINING");

      const weekRecords = allRecords.filter(r => weekSessions.some(s => s.id === r.sessionId));
      const monthRecords = allRecords.filter(r => monthSessions.some(s => s.id === r.sessionId));

      const summarize = (records: any[], total: number) => ({
        total,
        present: records.filter(r => r.status === "PRESENT").length,
        late: records.filter(r => r.status === "LATE").length,
        absent: total - records.length,
        excused: records.filter(r => r.status === "EXCUSED").length,
        rate: total > 0 ? Math.round((records.filter(r => r.status === "PRESENT" || r.status === "LATE").length / total) * 100) : 0,
      });

      res.json({
        weekly: summarize(weekRecords, weekSessions.length),
        monthly: summarize(monthRecords, monthSessions.length),
        weekRange: `${weekStartStr} to ${now.toISOString().split("T")[0]}`,
        monthRange: `${monthStartStr} to ${now.toISOString().split("T")[0]}`,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const notifs = await storage.getNotifications(req.user!.userId);
      res.json(notifs.slice(0, 50));
    } catch (e) { next(e); }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res, next) => {
    try {
      await storage.markAllNotificationsRead(req.user!.userId);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  app.get("/api/birthdays", requireAuth, async (_req, res, next) => {
    try {
      const allPlayers = await storage.getPlayers();
      const teams = await storage.getTeams();
      const teamMap = new Map(teams.map(t => [t.id, t.name]));
      const now = new Date();
      const todayMM = String(now.getMonth() + 1).padStart(2, "0");
      const todayDD = String(now.getDate()).padStart(2, "0");

      const birthdays: any[] = [];
      for (const p of allPlayers) {
        if (!p.dob) continue;
        const parts = p.dob.split("-");
        if (parts.length < 3) continue;
        const mm = parts[1];
        const dd = parts[2];

        const thisYearBday = new Date(now.getFullYear(), parseInt(mm) - 1, parseInt(dd));
        if (thisYearBday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          thisYearBday.setFullYear(now.getFullYear() + 1);
        }
        const diffDays = Math.floor((thisYearBday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
          const birthYear = parseInt(parts[0]);
          const turningAge = thisYearBday.getFullYear() - birthYear;
          birthdays.push({
            playerId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            photoUrl: p.photoUrl,
            jerseyNo: p.jerseyNo,
            position: p.position,
            teamName: teamMap.get(p.teamId) || null,
            dob: p.dob,
            isToday: mm === todayMM && dd === todayDD,
            daysUntil: diffDays,
            turningAge,
          });
        }
      }
      birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
      res.json(birthdays);
    } catch (e) { next(e); }
  });

  // ─── CLUB CONTRACT ACCEPTANCE ────────────────────────────────
  const CONTRACT_KEY = "AFROCAT_CONTRACT_2024_2026";
  const CONTRACT_VERSION = "PDF_v1_2024_2026";

  app.get("/api/contract/status", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const [acceptance] = await db.select().from(schema.contractAcceptances)
        .where(and(
          eq(schema.contractAcceptances.userId, userId),
          eq(schema.contractAcceptances.contractKey, CONTRACT_KEY)
        ));
      if (acceptance) {
        return res.json({
          ok: true, required: true, accepted: true,
          acceptedAt: acceptance.acceptedAt,
          acceptedBy: acceptance.acceptedBy,
          accepterFullName: acceptance.accepterFullName,
          isMinor: acceptance.isMinor,
          contractKey: CONTRACT_KEY,
          signedPdfUrl: acceptance.signedPdfUrl,
        });
      }
      return res.json({ ok: true, required: true, accepted: false, contractKey: CONTRACT_KEY });
    } catch (e) { next(e); }
  });

  app.post("/api/contract/accept", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const playerId = req.user!.playerId || null;

      const [existing] = await db.select().from(schema.contractAcceptances)
        .where(and(
          eq(schema.contractAcceptances.userId, userId),
          eq(schema.contractAcceptances.contractKey, CONTRACT_KEY)
        ));
      if (existing) return res.status(400).json({ message: "Contract already accepted" });

      let playerDob: string | null = null;
      let playerName = "";
      let playerTeamName = "";
      if (playerId) {
        const player = await storage.getPlayer(playerId);
        if (player) {
          playerDob = player.dob || null;
          playerName = `${player.firstName || ""} ${player.lastName || ""}`.trim();
          if (player.teamId) {
            const team = await storage.getTeam(player.teamId);
            if (team) playerTeamName = team.name;
          }
        }
      }

      let isMinor = false;
      if (playerDob) {
        isMinor = calcAge(playerDob) !== null && calcAge(playerDob)! < 18;
      }

      const body = z.object({
        accepterFullName: z.string().min(1),
        acceptedBy: z.enum(["SELF", "GUARDIAN"]),
        guardianIdNumber: z.string().optional().nullable(),
        guardianPhoneNumber: z.string().optional().nullable(),
      }).parse(req.body);

      if (isMinor) {
        if (body.acceptedBy !== "GUARDIAN") {
          return res.status(400).json({ message: "Minors must have a guardian accept the contract" });
        }
        if (!body.guardianIdNumber || !body.guardianPhoneNumber) {
          return res.status(400).json({ message: "Guardian ID number and phone number are required for minors" });
        }
      }

      const acceptedAtISO = new Date().toISOString();
      let signedPdfUrl: string | null = null;

      try {
        const contractPdfPath = path.resolve("public/contracts/afrocat-volleyball-contract.pdf");
        if (fs.existsSync(contractPdfPath)) {
          const pdfBytes = fs.readFileSync(contractPdfPath);
          const doc = await PDFDocument.load(pdfBytes);

          const page = doc.addPage();
          const { width, height } = page.getSize();
          const font = await doc.embedFont(StandardFonts.Helvetica);
          const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
          const margin = 48;
          let y = height - margin;

          const drawLine = () => {
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0, 0, 0) });
            y -= 18;
          };
          const drawText = (txt: string, size = 11, bold = false) => {
            page.drawText(txt, { x: margin, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
            y -= size + 8;
          };
          const drawCheckbox = (label: string, checked: boolean) => {
            const boxSize = 12;
            const x = margin;
            const boxY = y - 2;
            page.drawRectangle({ x, y: boxY, width: boxSize, height: boxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 });
            if (checked) {
              page.drawText("X", { x: x + 2.5, y: boxY + 1, size: 12, font: fontBold, color: rgb(0, 0, 0) });
            }
            page.drawText(label, { x: x + 18, y: boxY + 2, size: 11, font, color: rgb(0, 0, 0) });
            y -= 20;
          };

          drawText("AFROCAT VOLLEYBALL CLUB - CONTRACT CONFIRMATION", 14, true);
          drawText(`Contract Key: ${CONTRACT_KEY}`, 10, false);
          drawText("Sport: VOLLEYBALL", 10, true);
          drawLine();

          drawText("PLAYER DETAILS", 12, true);
          drawText(`Player Name: ${playerName}`);
          drawText(`Date of Birth: ${playerDob || "N/A"}`);
          drawText(`Team: ${playerTeamName || "Unassigned"}`);
          drawText(`User ID: ${userId}`, 9, false);
          drawLine();

          drawText("CONFIRMATION TYPE", 12, true);
          drawCheckbox("Adult Player (SELF confirmation)", body.acceptedBy === "SELF");
          drawCheckbox("Minor Player (GUARDIAN confirmation)", body.acceptedBy === "GUARDIAN");
          drawLine();

          drawText("CONFIRMATION STATEMENT", 12, true);
          drawText("I confirm that I have read the Afrocat Volleyball Club Contract and agree to the terms.", 11, false);
          y -= 6;
          drawText("This confirmation is electronically recorded and attached to the official contract PDF.", 11, false);
          drawLine();

          drawText("SIGNATORY DETAILS", 12, true);
          drawText(`Confirmed By: ${body.accepterFullName}`, 11, true);

          if (body.acceptedBy === "GUARDIAN") {
            drawText(`Guardian ID Number: ${body.guardianIdNumber || ""}`);
            drawText(`Guardian Phone Number: ${body.guardianPhoneNumber || ""}`);
          } else {
            drawText("Guardian ID Number: (Not applicable)");
            drawText("Guardian Phone Number: (Not applicable)");
          }

          y -= 8;
          drawText(`Confirmed At: ${acceptedAtISO}`, 11, false);

          y -= 10;
          page.drawLine({ start: { x: margin, y }, end: { x: margin + 240, y }, thickness: 1, color: rgb(0, 0, 0) });
          y -= 14;
          drawText("Signature (electronic acknowledgement)", 10, false);

          const outBytes = await doc.save();

          const outDir = path.resolve("public/contracts/signed");
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          const fileName = `signed_${CONTRACT_KEY}_${userId}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");
          const outPath = path.join(outDir, fileName);
          fs.writeFileSync(outPath, outBytes);

          signedPdfUrl = `/contracts/signed/${fileName}`;
        }
      } catch (pdfErr: any) {
        console.error("Signed PDF generation warning:", pdfErr.message);
      }

      const [record] = await db.insert(schema.contractAcceptances).values({
        userId,
        playerId,
        contractKey: CONTRACT_KEY,
        contractVersionHash: CONTRACT_VERSION,
        sport: "VOLLEYBALL",
        isMinor,
        acceptedBy: body.acceptedBy,
        accepterFullName: body.accepterFullName,
        guardianIdNumber: isMinor ? body.guardianIdNumber || null : null,
        guardianPhoneNumber: isMinor ? body.guardianPhoneNumber || null : null,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        signedPdfUrl,
      }).returning();

      res.status(201).json({
        ok: true, accepted: true, acceptedAt: record.acceptedAt, contractKey: CONTRACT_KEY,
        signedPdfUrl: record.signedPdfUrl,
        acceptedBy: body.acceptedBy,
        isMinor,
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  app.get("/api/contract/admin/summary", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
    try {
      const allAcceptances = await db.select().from(schema.contractAcceptances)
        .where(eq(schema.contractAcceptances.contractKey, CONTRACT_KEY));
      const acceptedUserIds = new Set(allAcceptances.map(a => a.userId));

      const allUsers = await db.select().from(schema.users);
      const activePlayers = allUsers.filter(u => u.accountStatus === "ACTIVE");

      const accepted = activePlayers.filter(u => acceptedUserIds.has(u.id));
      const notAccepted = activePlayers.filter(u => !acceptedUserIds.has(u.id));

      res.json({
        totalActive: activePlayers.length,
        accepted: accepted.length,
        notAccepted: notAccepted.length,
        notAcceptedUsers: notAccepted.map(u => ({
          id: u.id, fullName: u.fullName, email: u.email, role: u.role,
        })),
        acceptedUsers: accepted.map(u => {
          const acc = allAcceptances.find(a => a.userId === u.id);
          return {
            id: u.id, fullName: u.fullName, email: u.email, role: u.role,
            acceptedAt: acc?.acceptedAt, acceptedBy: acc?.acceptedBy,
          };
        }),
      });
    } catch (e) { next(e); }
  });

  // ─── ADMIN BULK AUTO-SIGN CONTRACT ───────────────────
  app.post("/api/contract/bulk-auto-sign", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
    try {
      const allAcceptances = await db.select().from(schema.contractAcceptances)
        .where(eq(schema.contractAcceptances.contractKey, "AFROCAT_CONTRACT_2024_2026"));
      const acceptedUserIds = new Set(allAcceptances.map(a => a.userId));

      const allUsers = await db.select().from(schema.users);
      const toSign = allUsers.filter(u => u.accountStatus === "ACTIVE" && !acceptedUserIds.has(u.id));

      let signed = 0;
      for (const u of toSign) {
        try {
          await db.insert(schema.contractAcceptances).values({
            userId: u.id,
            playerId: u.playerId || null,
            contractKey: "AFROCAT_CONTRACT_2024_2026",
            contractVersionHash: "PDF_v1_2024_2026",
            sport: "VOLLEYBALL",
            isMinor: false,
            acceptedBy: "SELF",
            accepterFullName: u.fullName || u.email,
            ipAddress: "ADMIN_BULK_SIGN",
            userAgent: "ADMIN_BULK_AUTO_SIGN",
          });
          signed++;
        } catch (_) {}
      }

      res.json({ ok: true, signed, skipped: toSign.length - signed, total: allUsers.length });
    } catch (e) { next(e); }
  });

  // ─── STATS COMPARISON ────────────────────
  app.get("/api/stats/compare", requireAuth, async (req, res, next) => {
    try {
      const p1Id = req.query.player1 as string;
      const p2Id = req.query.player2 as string;
      if (!p1Id || !p2Id) return res.status(400).json({ message: "Two player IDs required" });

      const getPlayerStats = async (playerId: string) => {
        const player = await storage.getPlayer(playerId);
        if (!player) return null;
        const team = player.teamId ? await storage.getTeam(player.teamId) : null;
        const stats = await db.select().from(schema.playerMatchStats)
          .where(eq(schema.playerMatchStats.playerId, playerId));
        const awards = await db.select().from(schema.awards)
          .where(eq(schema.awards.playerId, playerId));

        return {
          id: player.id,
          fullName: `${player.firstName} ${player.lastName}`,
          firstName: player.firstName,
          lastName: player.lastName,
          photoUrl: player.photoUrl,
          position: player.position,
          jerseyNo: player.jerseyNo,
          teamName: team?.name || null,
          age: calcAge(player.dob),
          heightCm: player.heightCm,
          weightKg: player.weightKg,
          careerStats: {
            matchesPlayed: stats.length,
            totalKills: stats.reduce((s, st) => s + (st.spikesKill || 0), 0),
            totalAces: stats.reduce((s, st) => s + (st.servesAce || 0), 0),
            totalBlocks: stats.reduce((s, st) => s + (st.blocksSolo || 0) + (st.blocksAssist || 0), 0),
            totalDigs: stats.reduce((s, st) => s + (st.digs || 0), 0),
            totalAssists: stats.reduce((s, st) => s + (st.settingAssist || 0), 0),
            totalPoints: stats.reduce((s, st) => s + (st.pointsTotal || 0), 0),
            totalErrors: stats.reduce((s, st) => s + (st.spikesError || 0) + (st.servesError || 0) + (st.receiveError || 0) + (st.settingError || 0), 0),
          },
          totalAwards: awards.length,
          awards: awards.map(a => ({ awardType: a.awardType, awardMonth: a.awardMonth })),
        };
      };

      const [player1, player2] = await Promise.all([getPlayerStats(p1Id), getPlayerStats(p2Id)]);
      if (!player1 || !player2) return res.status(404).json({ message: "One or both players not found" });

      res.json({ player1, player2 });
    } catch (e) { next(e); }
  });

  // ─── MATCH SIMULATION ────────────────────
  app.get("/api/simulation/team-stats/:teamId", requireAuth, requireRole(["ADMIN", "MANAGER", "COACH"]), async (req, res, next) => {
    try {
      const team = await storage.getTeam(req.params.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const allPlayers = await storage.getPlayers();
      const teamPlayers = allPlayers.filter((p: any) => p.teamId === req.params.teamId && p.status === "ACTIVE");

      const playersWithStats = await Promise.all(teamPlayers.map(async (p: any) => {
        const stats = await db.select().from(schema.playerMatchStats)
          .where(eq(schema.playerMatchStats.playerId, p.id));
        const mp = stats.length || 1;
        return {
          id: p.id,
          fullName: `${p.firstName} ${p.lastName}`,
          firstName: p.firstName,
          lastName: p.lastName,
          photoUrl: p.photoUrl,
          position: p.position,
          jerseyNo: p.jerseyNo,
          heightCm: p.heightCm,
          weightKg: p.weightKg,
          matchesPlayed: stats.length,
          avgKills: +(stats.reduce((s, st) => s + (st.spikesKill || 0), 0) / mp).toFixed(1),
          avgAces: +(stats.reduce((s, st) => s + (st.servesAce || 0), 0) / mp).toFixed(1),
          avgBlocks: +(stats.reduce((s, st) => s + (st.blocksSolo || 0) + (st.blocksAssist || 0), 0) / mp).toFixed(1),
          avgDigs: +(stats.reduce((s, st) => s + (st.digs || 0), 0) / mp).toFixed(1),
          avgAssists: +(stats.reduce((s, st) => s + (st.settingAssist || 0), 0) / mp).toFixed(1),
          avgPoints: +(stats.reduce((s, st) => s + (st.pointsTotal || 0), 0) / mp).toFixed(1),
          totalErrors: stats.reduce((s, st) => s + (st.spikesError || 0) + (st.servesError || 0) + (st.receiveError || 0) + (st.settingError || 0), 0),
          efficiency: stats.length > 0 ? +((stats.reduce((s, st) => s + (st.pointsTotal || 0), 0) - stats.reduce((s, st) => s + (st.spikesError || 0) + (st.servesError || 0) + (st.receiveError || 0) + (st.settingError || 0), 0)) / mp).toFixed(1) : 0,
        };
      }));

      res.json({ team: { id: team.id, name: team.name }, players: playersWithStats });
    } catch (e) { next(e); }
  });

  // ─── REPORT TEMPLATES ────────────────────
  function esc(s: string | null | undefined): string {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  app.post("/api/reports/season-summary", requireAuth, requireRole(["ADMIN", "MANAGER", "COACH", "STATISTICIAN"]), async (req, res, next) => {
    try {
      const { teamId } = req.body;
      const allMatches = await storage.getMatches();
      const teamMatches = teamId ? allMatches.filter((m: any) => m.teamId === teamId) : allMatches;
      const played = teamMatches.filter((m: any) => m.status === "PLAYED");
      const wins = played.filter((m: any) => m.result === "W").length;
      const losses = played.length - wins;
      const team = teamId ? await storage.getTeam(teamId) : null;

      const allStats = await db.select().from(schema.playerMatchStats);
      const matchIds = new Set(played.map((m: any) => m.id));
      const relevantStats = allStats.filter(s => matchIds.has(s.matchId));

      const playerTotals: Record<string, any> = {};
      for (const s of relevantStats) {
        if (!playerTotals[s.playerId]) playerTotals[s.playerId] = { playerId: s.playerId, kills: 0, aces: 0, blocks: 0, digs: 0, assists: 0, points: 0, matches: 0 };
        const t = playerTotals[s.playerId];
        t.kills += s.spikesKill || 0; t.aces += s.servesAce || 0;
        t.blocks += (s.blocksSolo || 0) + (s.blocksAssist || 0);
        t.digs += s.digs || 0; t.assists += s.settingAssist || 0;
        t.points += s.pointsTotal || 0; t.matches++;
      }
      const topPerformers = Object.values(playerTotals).sort((a: any, b: any) => b.points - a.points).slice(0, 10);
      const allPlayers = await storage.getPlayers();
      const pMap: Record<string, any> = {};
      for (const p of allPlayers) pMap[p.id] = p;
      const allTeams = await storage.getTeams();
      const teamMap: Record<string, string> = {};
      for (const t of allTeams) teamMap[t.id] = t.name;

      const winRate = played.length > 0 ? ((wins / played.length) * 100).toFixed(0) : "0";
      const teamTotals = Object.values(playerTotals).reduce((acc: any, t: any) => {
        acc.kills += t.kills; acc.aces += t.aces; acc.blocks += t.blocks;
        acc.digs += t.digs; acc.assists += t.assists; acc.points += t.points;
        return acc;
      }, { kills: 0, aces: 0, blocks: 0, digs: 0, assists: 0, points: 0 });

      const reportCss = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a2e;font-size:12px}.hdr{border-bottom:4px solid #0F8B7D;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.hdr-left .club{font-size:20px;font-weight:900;color:#0F8B7D;letter-spacing:1px}.hdr-left .motto{font-size:9px;color:#888;margin-top:2px;letter-spacing:0.5px}.hdr-right{text-align:right;font-size:10px;color:#555;line-height:1.8}.report-title{font-size:15px;font-weight:700;color:#333;margin-bottom:4px}.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}.kpi{background:#f0faf9;border:1px solid #b2dfdb;border-radius:10px;padding:12px;text-align:center}.kpi .val{font-size:26px;font-weight:900;color:#0F8B7D}.kpi .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}.section-title{font-size:11px;font-weight:700;color:#0F8B7D;text-transform:uppercase;letter-spacing:0.6px;border-bottom:2px solid #0F8B7D;padding-bottom:4px;margin:20px 0 10px}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}th{background:#0F8B7D;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.3px}td{padding:6px 8px;border-bottom:1px solid #e8edf0}tr:nth-child(even) td{background:#f8fbfa}tfoot td{background:#0F8B7D;color:#fff;font-weight:700;padding:6px 8px}.win{color:#15803d;font-weight:700}.loss{color:#dc2626;font-weight:700}.num{text-align:center}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}@media print{body{padding:10px;max-width:100%}@page{margin:10mm}}`;

      let html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Season Summary — ${esc(team?.name || "All Teams")}</title><style>${reportCss}</style></head><body>`;
      html += `<div class="hdr"><div class="hdr-left"><div class="club">AFROCAT VOLLEYBALL CLUB</div><div class="motto">One Team One Dream — Passion Discipline Victory</div></div><div class="hdr-right"><div class="report-title">Season Summary Report</div><div><strong>Team:</strong> ${esc(team?.name || "All Teams")}</div><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div></div>`;

      html += `<div class="kpi-row">
        <div class="kpi"><div class="val">${played.length}</div><div class="lbl">Matches Played</div></div>
        <div class="kpi"><div class="val" style="color:#15803d">${wins}</div><div class="lbl">Wins</div></div>
        <div class="kpi"><div class="val" style="color:#dc2626">${losses}</div><div class="lbl">Losses</div></div>
        <div class="kpi"><div class="val">${winRate}%</div><div class="lbl">Win Rate</div></div>
      </div>`;

      html += `<div class="kpi-row">
        <div class="kpi"><div class="val">${teamTotals.kills}</div><div class="lbl">Total Kills</div></div>
        <div class="kpi"><div class="val">${teamTotals.aces}</div><div class="lbl">Total Aces</div></div>
        <div class="kpi"><div class="val">${teamTotals.blocks}</div><div class="lbl">Total Blocks</div></div>
        <div class="kpi"><div class="val">${teamTotals.digs}</div><div class="lbl">Total Digs</div></div>
      </div>`;

      html += `<div class="section-title">Match Results (${played.length} played)</div>`;
      html += `<table><thead><tr><th>Date</th><th>Opponent</th><th>Competition</th><th>Venue</th><th class="num">Score</th><th class="num">Result</th></tr></thead><tbody>`;
      for (const m of played.sort((a: any, b: any) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())) {
        const resClass = m.result === "W" ? "win" : "loss";
        const resLabel = m.result === "W" ? "WIN" : "LOSS";
        html += `<tr><td>${esc(m.matchDate)}</td><td><strong>${esc(m.opponent)}</strong></td><td>${esc(m.competition || "—")}</td><td>${esc(m.venue || "—")}</td><td class="num">${m.setsFor || 0}–${m.setsAgainst || 0}</td><td class="num ${resClass}">${resLabel}</td></tr>`;
      }
      if (played.length === 0) html += `<tr><td colspan="6" style="text-align:center;color:#888;padding:16px">No matches played yet</td></tr>`;
      html += `</tbody></table>`;

      html += `<div class="section-title">Top 10 Performers by Total Points</div>`;
      html += `<table><thead><tr><th class="num">#</th><th>Player</th><th>Team</th><th class="num">Matches</th><th class="num">Points</th><th class="num">Kills</th><th class="num">Aces</th><th class="num">Blocks</th><th class="num">Digs</th><th class="num">Assists</th><th class="num">Avg Pts</th></tr></thead><tbody>`;
      topPerformers.forEach((t: any, i: number) => {
        const p = pMap[t.playerId];
        const pName = p ? `${p.firstName} ${p.lastName}` : "Unknown";
        const pTeamName = p?.teamId ? (teamMap[p.teamId] || "—") : "—";
        const avg = t.matches > 0 ? (t.points / t.matches).toFixed(1) : "—";
        html += `<tr><td class="num">${i + 1}</td><td><strong>${esc(pName)}</strong>${p?.position ? ` <span style="font-size:9px;color:#888">(${esc(p.position)})</span>` : ""}</td><td style="font-size:10px;color:#666">${esc(pTeamName)}</td><td class="num">${t.matches}</td><td class="num" style="font-weight:700;color:#0F8B7D">${t.points}</td><td class="num">${t.kills}</td><td class="num">${t.aces}</td><td class="num">${t.blocks}</td><td class="num">${t.digs}</td><td class="num">${t.assists}</td><td class="num" style="color:#555">${avg}</td></tr>`;
      });
      if (topPerformers.length === 0) html += `<tr><td colspan="11" style="text-align:center;color:#888;padding:16px">No statistics recorded yet</td></tr>`;
      html += `</tbody></table>`;

      html += `<div class="footer"><span>AFROCAT VOLLEYBALL CLUB — One Team One Dream</span><span>Generated: ${new Date().toLocaleString()}</span></div>`;
      html += `</body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  app.post("/api/reports/player-report/:playerId", requireAuth, requireRole(["ADMIN", "MANAGER", "COACH", "STATISTICIAN"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });
      const team = player.teamId ? await storage.getTeam(player.teamId) : null;
      const stats = await db.select().from(schema.playerMatchStats).where(eq(schema.playerMatchStats.playerId, player.id));
      const awards = await db.select().from(schema.awards).where(eq(schema.awards.playerId, player.id));
      const age = calcAge(player.dob);

      const totals = {
        kills: stats.reduce((s, st) => s + (st.spikesKill || 0), 0),
        aces: stats.reduce((s, st) => s + (st.servesAce || 0), 0),
        blocks: stats.reduce((s, st) => s + (st.blocksSolo || 0) + (st.blocksAssist || 0), 0),
        digs: stats.reduce((s, st) => s + (st.digs || 0), 0),
        assists: stats.reduce((s, st) => s + (st.settingAssist || 0), 0),
        points: stats.reduce((s, st) => s + (st.pointsTotal || 0), 0),
      };

      const allMatches = await storage.getMatches();
      const matchMap = new Map(allMatches.map((m: any) => [m.id, m]));
      const matchHistory = stats
        .map((s: any) => {
          const m = matchMap.get(s.matchId);
          const totalErr = (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0);
          return {
            date: m?.matchDate || "—",
            opponent: m?.opponent || "Unknown",
            competition: m?.competition || "—",
            result: m?.result || "—",
            kills: s.spikesKill || 0,
            aces: s.servesAce || 0,
            blocks: (s.blocksSolo || 0) + (s.blocksAssist || 0),
            digs: s.digs || 0,
            assists: s.settingAssist || 0,
            errors: totalErr,
            pts: s.pointsTotal || 0,
          };
        })
        .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

      const avgPts = stats.length > 0 ? (totals.points / stats.length).toFixed(1) : "—";
      const avgKills = stats.length > 0 ? (totals.kills / stats.length).toFixed(1) : "—";

      const pCss = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a2e;font-size:12px}.hdr{border-bottom:4px solid #0F8B7D;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.club{font-size:20px;font-weight:900;color:#0F8B7D;letter-spacing:1px}.motto{font-size:9px;color:#888;margin-top:2px}.hdr-right{text-align:right;font-size:10px;color:#555;line-height:1.8}.rpt-title{font-size:15px;font-weight:700;color:#333;margin-bottom:4px}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;border:1px solid #e0e0e0;border-radius:10px;padding:16px}.profile-row{display:flex;flex-direction:column;gap:8px}.pf-item{display:flex;gap:8px;font-size:11px}.pf-label{color:#888;min-width:100px;font-size:10px}.pf-val{font-weight:600;color:#1a1a2e}.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.kpi{background:#f0faf9;border:1px solid #b2dfdb;border-radius:10px;padding:12px;text-align:center}.kpi .val{font-size:26px;font-weight:900;color:#0F8B7D}.kpi .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}.section-title{font-size:11px;font-weight:700;color:#0F8B7D;text-transform:uppercase;letter-spacing:0.6px;border-bottom:2px solid #0F8B7D;padding-bottom:4px;margin:20px 0 10px}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}th{background:#0F8B7D;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.3px}td{padding:6px 8px;border-bottom:1px solid #e8edf0}tr:nth-child(even) td{background:#f8fbfa}.num{text-align:center}.win{color:#15803d;font-weight:700}.loss{color:#dc2626;font-weight:700}.award-badge{display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;margin-right:4px}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}@media print{body{padding:10px;max-width:100%}@page{margin:10mm}}`;

      const playerFullName = `${player.firstName} ${player.lastName}`;
      let html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Player Report — ${esc(playerFullName)}</title><style>${pCss}</style></head><body>`;

      html += `<div class="hdr"><div><div class="club">AFROCAT VOLLEYBALL CLUB</div><div class="motto">One Team One Dream — Passion Discipline Victory</div></div><div class="hdr-right"><div class="rpt-title">Player Report</div><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div></div>`;

      html += `<div class="profile-grid">
        <div class="profile-row">
          <div class="pf-item"><span class="pf-label">Full Name</span><span class="pf-val" style="font-size:15px;color:#0F8B7D">${esc(playerFullName)}</span></div>
          <div class="pf-item"><span class="pf-label">Position</span><span class="pf-val">${esc(player.position || "—")}</span></div>
          <div class="pf-item"><span class="pf-label">Jersey Number</span><span class="pf-val">#${player.jerseyNo || "—"}</span></div>
          <div class="pf-item"><span class="pf-label">Team</span><span class="pf-val">${esc(team?.name || "Unassigned")}</span></div>
          <div class="pf-item"><span class="pf-label">Status</span><span class="pf-val">${esc(player.status || "ACTIVE")}</span></div>
        </div>
        <div class="profile-row">
          <div class="pf-item"><span class="pf-label">Date of Birth</span><span class="pf-val">${esc(player.dob || "—")}</span></div>
          <div class="pf-item"><span class="pf-label">Age</span><span class="pf-val">${age ?? "—"} years</span></div>
          <div class="pf-item"><span class="pf-label">Gender</span><span class="pf-val">${esc(player.gender || "—")}</span></div>
          <div class="pf-item"><span class="pf-label">Height</span><span class="pf-val">${player.heightCm ? player.heightCm + " cm" : "—"}</span></div>
          <div class="pf-item"><span class="pf-label">Weight</span><span class="pf-val">${player.weightKg ? player.weightKg + " kg" : "—"}</span></div>
          <div class="pf-item"><span class="pf-label">Nationality</span><span class="pf-val">${esc(player.nationality || "—")}</span></div>
        </div>
      </div>`;

      html += `<div class="section-title">Career Statistics — ${stats.length} Matches Played</div>`;
      html += `<div class="kpi-row">
        <div class="kpi"><div class="val">${totals.points}</div><div class="lbl">Total Points</div></div>
        <div class="kpi"><div class="val">${totals.kills}</div><div class="lbl">Total Kills</div></div>
        <div class="kpi"><div class="val">${totals.aces}</div><div class="lbl">Total Aces</div></div>
        <div class="kpi"><div class="val">${totals.blocks}</div><div class="lbl">Total Blocks</div></div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="val">${totals.digs}</div><div class="lbl">Total Digs</div></div>
        <div class="kpi"><div class="val">${totals.assists}</div><div class="lbl">Total Assists</div></div>
        <div class="kpi"><div class="val">${avgPts}</div><div class="lbl">Avg Pts/Match</div></div>
        <div class="kpi"><div class="val">${avgKills}</div><div class="lbl">Avg Kills/Match</div></div>
      </div>`;

      html += `<div class="section-title">Match-by-Match History</div>`;
      html += `<table><thead><tr><th>Date</th><th>Opponent</th><th>Competition</th><th class="num">Result</th><th class="num">Kills</th><th class="num">Aces</th><th class="num">Blks</th><th class="num">Digs</th><th class="num">Ast</th><th class="num">Err</th><th class="num">Pts</th></tr></thead><tbody>`;
      if (matchHistory.length === 0) {
        html += `<tr><td colspan="11" style="text-align:center;color:#888;padding:16px">No match statistics recorded</td></tr>`;
      } else {
        for (const m of matchHistory) {
          const resClass = m.result === "W" ? "win" : m.result === "L" ? "loss" : "";
          html += `<tr><td>${esc(m.date)}</td><td><strong>${esc(m.opponent)}</strong></td><td style="font-size:10px;color:#666">${esc(m.competition)}</td><td class="num ${resClass}">${esc(m.result)}</td><td class="num">${m.kills}</td><td class="num">${m.aces}</td><td class="num">${m.blocks}</td><td class="num">${m.digs}</td><td class="num">${m.assists}</td><td class="num" style="${m.errors > 3 ? "color:#dc2626;font-weight:700" : ""}">${m.errors}</td><td class="num" style="font-weight:700;color:#0F8B7D">${m.pts > 0 ? "+" : ""}${m.pts}</td></tr>`;
        }
      }
      html += `</tbody></table>`;

      if (awards.length > 0) {
        html += `<div class="section-title">Awards & Honours (${awards.length})</div>`;
        html += `<table><thead><tr><th>Award Type</th><th>Month</th><th>Notes</th></tr></thead><tbody>`;
        for (const a of awards) {
          html += `<tr><td><span class="award-badge">${esc(a.awardType)}</span></td><td>${esc(a.awardMonth)}</td><td style="color:#555">${esc(a.notes || "—")}</td></tr>`;
        }
        html += `</tbody></table>`;
      }

      html += `<div class="footer"><span>AFROCAT VOLLEYBALL CLUB — One Team One Dream</span><span>Generated: ${new Date().toLocaleString()}</span></div>`;
      html += `</body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  app.post("/api/reports/team-roster/:teamId", requireAuth, requireRole(["ADMIN", "MANAGER", "COACH", "STATISTICIAN"]), async (req, res, next) => {
    try {
      const team = await storage.getTeam(req.params.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const allPlayers = await storage.getPlayers();
      const teamPlayers = allPlayers.filter((p: any) => p.teamId === req.params.teamId && p.status === "ACTIVE");

      const playersWithStats = await Promise.all(teamPlayers.map(async (p: any) => {
        const stats = await db.select().from(schema.playerMatchStats).where(eq(schema.playerMatchStats.playerId, p.id));
        return { ...p, matchesPlayed: stats.length, totalPoints: stats.reduce((s: number, st: any) => s + (st.pointsTotal || 0), 0) };
      }));

      const sortedPlayers = [...playersWithStats].sort((a: any, b: any) => (a.jerseyNo || 99) - (b.jerseyNo || 99));
      const byPosition: Record<string, any[]> = {};
      for (const p of sortedPlayers) {
        const pos = p.position || "Unassigned";
        if (!byPosition[pos]) byPosition[pos] = [];
        byPosition[pos].push(p);
      }

      const rCss = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a2e;font-size:12px}.hdr{border-bottom:4px solid #0F8B7D;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.club{font-size:20px;font-weight:900;color:#0F8B7D;letter-spacing:1px}.motto{font-size:9px;color:#888;margin-top:2px}.hdr-right{text-align:right;font-size:10px;color:#555;line-height:1.8}.rpt-title{font-size:15px;font-weight:700;color:#333;margin-bottom:4px}.kpi-row{display:flex;gap:12px;margin-bottom:22px}.kpi{background:#f0faf9;border:1px solid #b2dfdb;border-radius:10px;padding:12px 20px;text-align:center;flex:1}.kpi .val{font-size:26px;font-weight:900;color:#0F8B7D}.kpi .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}.section-title{font-size:11px;font-weight:700;color:#0F8B7D;text-transform:uppercase;letter-spacing:0.6px;border-bottom:2px solid #0F8B7D;padding-bottom:4px;margin:20px 0 10px}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}th{background:#0F8B7D;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.3px}td{padding:6px 8px;border-bottom:1px solid #e8edf0}tr:nth-child(even) td{background:#f8fbfa}.num{text-align:center}.pos-badge{display:inline-block;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}@media print{body{padding:10px;max-width:100%}@page{margin:10mm}}`;

      const genders = [...new Set(sortedPlayers.map((p: any) => p.gender).filter(Boolean))];
      const avgAge = sortedPlayers.filter((p: any) => p.dob).length > 0
        ? (sortedPlayers.filter((p: any) => p.dob).map((p: any) => {
            const today = new Date(); const dob = new Date(p.dob);
            return today.getFullYear() - dob.getFullYear();
          }).reduce((a: number, b: number) => a + b, 0) / sortedPlayers.filter((p: any) => p.dob).length).toFixed(1)
        : "—";

      let html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Team Roster — ${esc(team.name)}</title><style>${rCss}</style></head><body>`;
      html += `<div class="hdr"><div><div class="club">AFROCAT VOLLEYBALL CLUB</div><div class="motto">One Team One Dream — Passion Discipline Victory</div></div><div class="hdr-right"><div class="rpt-title">Official Team Roster</div><div><strong>Team:</strong> ${esc(team.name)}</div><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div></div>`;

      html += `<div class="kpi-row">
        <div class="kpi"><div class="val">${sortedPlayers.length}</div><div class="lbl">Active Players</div></div>
        <div class="kpi"><div class="val">${Object.keys(byPosition).length}</div><div class="lbl">Positions Covered</div></div>
        <div class="kpi"><div class="val">${avgAge}</div><div class="lbl">Avg Age</div></div>
        <div class="kpi"><div class="val">${genders.join(" / ") || "—"}</div><div class="lbl">Gender</div></div>
      </div>`;

      html += `<div class="section-title">Full Roster — Sorted by Jersey Number</div>`;
      html += `<table><thead><tr><th class="num">No.</th><th class="num">Jersey</th><th>Full Name</th><th>Position</th><th class="num">DOB</th><th class="num">Age</th><th class="num">Height</th><th class="num">Weight</th><th class="num">Nationality</th><th class="num">Matches</th><th class="num">Points</th></tr></thead><tbody>`;
      sortedPlayers.forEach((p: any, i: number) => {
        const today = new Date(); const dobDate = p.dob ? new Date(p.dob) : null;
        const pAge = dobDate ? today.getFullYear() - dobDate.getFullYear() : "—";
        html += `<tr><td class="num">${i + 1}</td><td class="num" style="font-weight:700">#${p.jerseyNo || "—"}</td><td><strong>${esc(`${p.firstName} ${p.lastName}`)}</strong></td><td><span class="pos-badge">${esc(p.position || "—")}</span></td><td class="num" style="font-size:10px">${esc(p.dob || "—")}</td><td class="num">${pAge}</td><td class="num">${p.heightCm ? p.heightCm + "cm" : "—"}</td><td class="num">${p.weightKg ? p.weightKg + "kg" : "—"}</td><td class="num" style="font-size:10px">${esc(p.nationality || "—")}</td><td class="num">${p.matchesPlayed}</td><td class="num" style="font-weight:700;color:#0F8B7D">${p.totalPoints}</td></tr>`;
      });
      if (sortedPlayers.length === 0) {
        html += `<tr><td colspan="11" style="text-align:center;color:#888;padding:16px">No active players registered for this team</td></tr>`;
      }
      html += `</tbody></table>`;

      html += `<div class="section-title">Players by Position</div>`;
      for (const [pos, posPlayers] of Object.entries(byPosition)) {
        html += `<div style="margin-bottom:4px;font-size:11px"><strong><span class="pos-badge">${esc(pos)}</span></strong> — ${posPlayers.map((p: any) => `#${p.jerseyNo || "?"} ${esc(`${p.firstName} ${p.lastName}`)}`).join(", ")}</div>`;
      }

      html += `<div class="footer"><span>AFROCAT VOLLEYBALL CLUB — One Team One Dream</span><span>Generated: ${new Date().toLocaleString()}</span></div>`;
      html += `</body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  app.post("/api/reports/attendance-summary", requireAuth, requireRole(["ADMIN", "MANAGER", "COACH"]), async (req, res, next) => {
    try {
      const { teamId, startDate, endDate } = req.body;
      const sessions = await db.select().from(schema.attendanceSessions);
      const filtered = sessions.filter((s: any) => {
        if (teamId && s.teamId !== teamId) return false;
        if (startDate && s.sessionDate < startDate) return false;
        if (endDate && s.sessionDate > endDate) return false;
        return true;
      });

      const records = await db.select().from(schema.attendanceRecords);
      const allPlayers = await storage.getPlayers();
      const pMap: Record<string, any> = {};
      for (const p of allPlayers) pMap[p.id] = p;
      const team = teamId ? await storage.getTeam(teamId) : null;

      const sessionIds = new Set(filtered.map(s => s.id));
      const relevantRecords = records.filter((r: any) => sessionIds.has(r.sessionId));

      const playerAttendance: Record<string, { present: number; late: number; absent: number; name: string }> = {};
      for (const r of relevantRecords) {
        if (!playerAttendance[r.playerId]) { const pp = pMap[r.playerId]; playerAttendance[r.playerId] = { present: 0, late: 0, absent: 0, name: pp ? `${pp.firstName} ${pp.lastName}` : "Unknown" }; }
        if (r.status === "PRESENT") playerAttendance[r.playerId].present++;
        else if (r.status === "LATE") playerAttendance[r.playerId].late++;
        else playerAttendance[r.playerId].absent++;
      }

      const sortedAtt = Object.entries(playerAttendance).sort((a, b) => {
        const totA = a[1].present + a[1].late + a[1].absent;
        const totB = b[1].present + b[1].late + b[1].absent;
        const rateA = totA > 0 ? (a[1].present + a[1].late) / totA : 0;
        const rateB = totB > 0 ? (b[1].present + b[1].late) / totB : 0;
        return rateB - rateA;
      });

      const totalSessions = filtered.length;
      const avgRate = sortedAtt.length > 0
        ? (sortedAtt.reduce((sum, [, d]) => {
            const tot = d.present + d.late + d.absent;
            return sum + (tot > 0 ? (d.present + d.late) / tot : 0);
          }, 0) / sortedAtt.length * 100).toFixed(0)
        : "0";
      const perfect = sortedAtt.filter(([, d]) => d.absent === 0).length;

      const aCss = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a2e;font-size:12px}.hdr{border-bottom:4px solid #0F8B7D;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.club{font-size:20px;font-weight:900;color:#0F8B7D;letter-spacing:1px}.motto{font-size:9px;color:#888;margin-top:2px}.hdr-right{text-align:right;font-size:10px;color:#555;line-height:1.8}.rpt-title{font-size:15px;font-weight:700;color:#333;margin-bottom:4px}.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}.kpi{background:#f0faf9;border:1px solid #b2dfdb;border-radius:10px;padding:12px;text-align:center}.kpi .val{font-size:26px;font-weight:900;color:#0F8B7D}.kpi .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}.section-title{font-size:11px;font-weight:700;color:#0F8B7D;text-transform:uppercase;letter-spacing:0.6px;border-bottom:2px solid #0F8B7D;padding-bottom:4px;margin:20px 0 10px}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}th{background:#0F8B7D;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.3px}td{padding:6px 8px;border-bottom:1px solid #e8edf0}tr:nth-child(even) td{background:#f8fbfa}.num{text-align:center}.good{color:#15803d;font-weight:700}.bad{color:#dc2626;font-weight:700}.warn{color:#d97706;font-weight:700}.bar-bg{background:#e5e7eb;border-radius:4px;height:8px;width:100%;display:inline-block;vertical-align:middle;overflow:hidden}.bar-fill{height:100%;border-radius:4px;display:inline-block}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}@media print{body{padding:10px;max-width:100%}@page{margin:10mm}}`;

      let html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Attendance Summary</title><style>${aCss}</style></head><body>`;
      html += `<div class="hdr"><div><div class="club">AFROCAT VOLLEYBALL CLUB</div><div class="motto">One Team One Dream — Passion Discipline Victory</div></div><div class="hdr-right"><div class="rpt-title">Attendance Summary Report</div><div><strong>Team:</strong> ${esc(team?.name || "All Teams")}</div><div><strong>Period:</strong> ${esc(startDate || "All time")} to ${esc(endDate || "Present")}</div><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div></div>`;

      html += `<div class="kpi-row">
        <div class="kpi"><div class="val">${totalSessions}</div><div class="lbl">Sessions Held</div></div>
        <div class="kpi"><div class="val">${sortedAtt.length}</div><div class="lbl">Players Tracked</div></div>
        <div class="kpi"><div class="val">${avgRate}%</div><div class="lbl">Avg Attendance Rate</div></div>
        <div class="kpi"><div class="val">${perfect}</div><div class="lbl">Perfect Attendance</div></div>
      </div>`;

      html += `<div class="section-title">Player Attendance — Sorted by Rate (Highest First)</div>`;
      html += `<table><thead><tr><th class="num">#</th><th>Player</th><th class="num">Present</th><th class="num">Late</th><th class="num">Absent</th><th class="num">Total</th><th class="num">Rate</th><th style="width:80px">Visual</th></tr></thead><tbody>`;
      sortedAtt.forEach(([_id, data], i) => {
        const total = data.present + data.late + data.absent;
        const rate = total > 0 ? ((data.present + data.late) / total * 100) : 0;
        const rateStr = rate.toFixed(0);
        const cls = rate >= 90 ? "good" : rate >= 75 ? "warn" : "bad";
        const barColor = rate >= 90 ? "#15803d" : rate >= 75 ? "#d97706" : "#dc2626";
        html += `<tr><td class="num">${i + 1}</td><td><strong>${esc(data.name)}</strong></td><td class="num" style="color:#15803d;font-weight:600">${data.present}</td><td class="num" style="color:#d97706">${data.late}</td><td class="num" style="color:#dc2626">${data.absent}</td><td class="num">${total}</td><td class="num ${cls}">${rateStr}%</td><td><div class="bar-bg"><div class="bar-fill" style="width:${rateStr}%;background:${barColor}"></div></div></td></tr>`;
      });
      if (sortedAtt.length === 0) {
        html += `<tr><td colspan="8" style="text-align:center;color:#888;padding:16px">No attendance records found for the selected period</td></tr>`;
      }
      html += `</tbody></table>`;

      html += `<div class="footer"><span>AFROCAT VOLLEYBALL CLUB — One Team One Dream &bull; Attendance threshold: 75% = Acceptable, 90%+ = Excellent</span><span>Generated: ${new Date().toLocaleString()}</span></div>`;
      html += `</body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  app.post("/api/reports/financial-summary", requireAuth, requireRole(["ADMIN", "MANAGER", "FINANCE"]), async (req, res, next) => {
    try {
      const { startDate, endDate } = req.body;
      const txns = await storage.getFinanceTxns();
      const filtered = txns.filter((t: any) => {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      });

      const income = filtered.filter((t: any) => t.type === "INCOME");
      const expense = filtered.filter((t: any) => t.type === "EXPENSE");
      const totalIncome = income.reduce((s: number, t: any) => s + t.amount, 0);
      const totalExpense = expense.reduce((s: number, t: any) => s + t.amount, 0);

      const categories: Record<string, number> = {};
      for (const t of filtered) {
        const cat = t.category || "Uncategorized";
        categories[cat] = (categories[cat] || 0) + (t.type === "INCOME" ? t.amount : -t.amount);
      }

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Summary</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#0F8B7D}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0F8B7D;color:white}.income{color:green}.expense{color:red}.net{font-size:24px;font-weight:bold}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>AFROCAT VOLLEYBALL CLUB — Financial Summary</h1>`;
      html += `<p><strong>Period:</strong> ${esc(startDate || "Start")} to ${esc(endDate || "Now")}</p>`;
      html += `<div class="net">Net: <span class="${totalIncome - totalExpense >= 0 ? 'income' : 'expense'}">N$${(totalIncome - totalExpense).toLocaleString()}</span></div>`;
      html += `<p><span class="income">Income: N$${totalIncome.toLocaleString()}</span> | <span class="expense">Expenses: N$${totalExpense.toLocaleString()}</span></p>`;

      html += `<h3>By Category</h3><table><tr><th>Category</th><th>Net Amount</th></tr>`;
      for (const [cat, amt] of Object.entries(categories).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
        html += `<tr><td>${esc(cat)}</td><td class="${amt >= 0 ? 'income' : 'expense'}">N$${amt.toLocaleString()}</td></tr>`;
      }
      html += `</table>`;

      html += `<h3>All Transactions (${filtered.length})</h3><table><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr>`;
      filtered.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((t: any) => {
        html += `<tr><td>${esc(t.date)}</td><td class="${t.type === 'INCOME' ? 'income' : 'expense'}">${t.type}</td><td>${esc(t.category)}</td><td>${esc(t.description)}</td><td>N$${t.amount?.toLocaleString()}</td></tr>`;
      });
      html += `</table></body></html>`;

      res.json({ html });
    } catch (e) { next(e); }
  });

  // ─── CHAT MESSAGES (REST fallback) ────────────────────
  app.get("/api/chat/messages/:roomId", requireAuth, async (req, res, next) => {
    try {
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.roomId, req.params.roomId));
      const sorted = messages.sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime()).slice(-50);
      res.json(sorted);
    } catch (e) { next(e); }
  });

  app.post("/api/chat/messages", requireAuth, async (req, res, next) => {
    try {
      const body = z.object({
        roomId: z.string().min(1),
        message: z.string().min(1).max(2000),
      }).parse(req.body);

      const [msg] = await db.insert(schema.chatMessages).values({
        roomId: body.roomId,
        senderId: req.user!.userId,
        senderName: req.user!.fullName || "Unknown",
        senderRole: req.user!.role || "PLAYER",
        message: body.message,
      }).returning();

      if (body.roomId.startsWith("dm:")) {
        const parts = body.roomId.split(":");
        const recipientId = parts.find(p => p !== "dm" && p !== req.user!.userId);
        if (recipientId) {
          try {
            await db.insert(schema.notifications).values({
              userId: recipientId,
              type: "CHAT_MESSAGE",
              title: `New message from ${req.user!.fullName}`,
              body: body.message.substring(0, 100),
              linkUrl: `/chat?dm=${body.roomId}`,
            });
          } catch {}
        }
      }

      res.status(201).json(msg);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.get("/api/chat/rooms", requireAuth, async (req, res, next) => {
    try {
      const rooms: { id: string; name: string }[] = [{ id: "general", name: "General Chat" }];
      const teams = await storage.getTeams();
      for (const t of teams) rooms.push({ id: `team:${t.id}`, name: t.name });
      res.json(rooms);
    } catch (e) { next(e); }
  });

  // ─── PLAYER SPOTLIGHT (daily rotation) ────────────────────
  app.get("/api/player-spotlight", requireAuth, async (_req, res, next) => {
    try {
      const allPlayers = await storage.getPlayers();
      const approved = allPlayers
        .filter((p: any) => p.registrationStatus === "APPROVED" && p.status === "ACTIVE")
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      if (approved.length === 0) return res.json(null);

      const today = new Date();
      const dayIndex = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
      const player = approved[dayIndex % approved.length];

      const team = player.teamId ? await storage.getTeam(player.teamId) : null;

      const allStats = await db.select().from(schema.playerMatchStats)
        .where(eq(schema.playerMatchStats.playerId, player.id));

      const careerStats = {
        matchesPlayed: allStats.length,
        totalKills: allStats.reduce((s, st) => s + (st.spikesKill || 0), 0),
        totalAces: allStats.reduce((s, st) => s + (st.servesAce || 0), 0),
        totalBlocks: allStats.reduce((s, st) => s + (st.blocksSolo || 0) + (st.blocksAssist || 0), 0),
        totalDigs: allStats.reduce((s, st) => s + (st.digs || 0), 0),
        totalAssists: allStats.reduce((s, st) => s + (st.settingAssist || 0), 0),
        totalPoints: allStats.reduce((s, st) => s + (st.pointsTotal || 0), 0),
      };

      const playerAwards = await db.select().from(schema.awards)
        .where(eq(schema.awards.playerId, player.id));

      const age = calcAge(player.dob);

      res.json({
        id: player.id,
        fullName: `${player.firstName} ${player.lastName}`,
        firstName: player.firstName,
        lastName: player.lastName,
        photoUrl: player.photoUrl,
        position: player.position,
        jerseyNo: player.jerseyNo,
        teamName: team?.name || null,
        age,
        heightCm: player.heightCm,
        weightKg: player.weightKg,
        nationality: player.nationality,
        careerStats,
        awards: playerAwards.map((a: any) => ({
          id: a.id,
          awardType: a.awardType,
          awardMonth: a.awardMonth,
          notes: a.notes,
        })),
      });
    } catch (e) { next(e); }
  });

  // ─── TEAM GENDER RULES API ────────────────────
  app.get("/api/team-gender-rules", (_req, res) => {
    res.json(TEAM_GENDER_RULES);
  });

  // ─── PLAYER UPDATE REQUESTS ────────────────────
  app.get("/api/player-update-requests/pending", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
    try {
      const requests = await storage.getPendingUpdateRequests();
      const enriched = await Promise.all(requests.map(async (r) => {
        const player = await storage.getPlayer(r.playerId);
        const submitter = r.submittedBy ? await storage.getUser(r.submittedBy) : null;
        const patchFields = typeof r.patchJson === "string" ? JSON.parse(r.patchJson) : (r.patchJson || {});
        const currentValues: Record<string, any> = {};
        if (player) {
          for (const key of Object.keys(patchFields)) {
            currentValues[key] = (player as any)[key] ?? null;
          }
        }
        return {
          ...r,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          playerPhotoUrl: player?.photoUrl || null,
          submitterName: submitter?.fullName || null,
          currentValues,
        };
      }));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/player-update-requests/mine", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.playerId) return res.json([]);
      const requests = await storage.getPlayerUpdateRequests(user.playerId);
      res.json(requests);
    } catch (e) { next(e); }
  });

  app.post("/api/player-update-requests/:id/approve", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
    try {
      const { reviewNote } = req.body || {};
      const updated = await storage.approvePlayerUpdateRequest(req.params.id, req.user!.userId, reviewNote);
      if (!updated) return res.status(404).json({ message: "Request not found or already processed" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/player-update-requests/:id/reject", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
    try {
      const { reviewNote } = req.body || {};
      const updated = await storage.rejectPlayerUpdateRequest(req.params.id, req.user!.userId, reviewNote);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── WEIGHT STATUS API ────────────────────
  app.get("/api/players/me/weight-status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.playerId) return res.status(404).json({ message: "No player profile linked" });
      const player = await storage.getPlayer(user.playerId);
      if (!player) return res.status(404).json({ message: "Player not found" });

      const lastUpdate = player.lastWeightUpdatedAt ? new Date(player.lastWeightUpdatedAt) : null;
      const isOverdue = !lastUpdate || (Date.now() - lastUpdate.getTime()) > 90 * 24 * 60 * 60 * 1000;
      const quarterKey = getQuarterKey();

      res.json({
        weightKg: player.weightKg,
        heightCm: player.heightCm,
        lastWeightUpdatedAt: player.lastWeightUpdatedAt,
        isOverdue,
        quarterKey,
      });
    } catch (e) { next(e); }
  });

  // ─── WEIGHT UPDATE NOTIFICATION CRON (daily at 08:00) ────────────────────
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("[CRON] Running weight update notification check...");
      const overduePlayers = await storage.getPlayersWithOverdueWeight();
      const quarterKey = getQuarterKey();

      for (const player of overduePlayers) {
        const user = await storage.getUserByPlayerId(player.id);
        if (!user) continue;

        const existingNotifs = await storage.getNotifications(user.id);
        const isDuplicate = existingNotifs.some((n: any) => {
          const meta = n.metadata as any;
          return n.type === "WEIGHT_UPDATE" && meta?.quarterKey === quarterKey;
        });
        if (isDuplicate) continue;

        await storage.createNotification({
          userId: user.id,
          playerId: player.id,
          type: "WEIGHT_UPDATE",
          title: "Weight Update Required",
          message: `Please update your weight for ${quarterKey}. Regular weight tracking helps monitor your fitness.`,
          metadata: { quarterKey },
        });
        console.log(`[CRON] Weight notification sent to ${user.email} for ${quarterKey}`);
      }
    } catch (err) {
      console.error("[CRON] Weight notification error:", err);
    }
  });

  // ─── FINANCE REMINDER CRON (weekly, Monday 9 AM) ────────────────────
  cron.schedule("0 9 * * 1", async () => {
    try {
      console.log("[CRON] Running weekly finance reminder check...");
      const allPlayers = await storage.getPlayers();
      const configs = await storage.getFeeConfigs();
      const feeMap: Record<string, number> = {};
      configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

      for (const player of allPlayers) {
        if (player.status !== "ACTIVE") continue;
        const user = await storage.getUserByPlayerId(player.id);
        if (!user) continue;

        const payments = await storage.getPlayerPayments(player.id);
        const membershipFee = (player as any).employmentClass === "WORKING" ? (feeMap.membershipFeeWorking || 800) : (feeMap.membershipFeeNonWorking || 400);
        const developmentFee = feeMap.developmentFee || 2500;
        const resourceFee = feeMap.resourceFee || 1500;
        const leagueFee = feeMap.leagueAffiliationFeePerPlayer || 0;

        const approved = payments.filter((p: any) => p.status === "APPROVED");
        const paidByType: Record<string, number> = {};
        approved.forEach((p: any) => { paidByType[p.feeType] = (paidByType[p.feeType] || 0) + p.amount; });

        let totalOutstanding = 0;
        const feeTypes = [
          { type: "MEMBERSHIP", due: membershipFee },
          { type: "DEVELOPMENT", due: developmentFee },
          { type: "RESOURCE", due: resourceFee },
          { type: "LEAGUE_AFFILIATION", due: leagueFee },
        ];
        for (const ft of feeTypes) {
          const paid = paidByType[ft.type] || 0;
          if (paid < ft.due) totalOutstanding += ft.due - paid;
        }

        if (totalOutstanding <= 0) continue;

        const weekKey = new Date().toISOString().split("T")[0];
        const existingNotifs = await storage.getNotifications(user.id);
        const isDuplicate = existingNotifs.some((n: any) => {
          const meta = n.metadata as any;
          return n.type === "FINANCE_REMINDER" && meta?.weekKey === weekKey;
        });
        if (isDuplicate) continue;

        await storage.createNotification({
          userId: user.id,
          playerId: player.id,
          type: "FINANCE_REMINDER",
          title: "Outstanding Fees Reminder",
          message: `You have N$${totalOutstanding.toLocaleString()} in outstanding fees. Please make your payments to stay in good standing.`,
          metadata: { weekKey, totalOutstanding },
        });
        console.log(`[CRON] Finance reminder sent to ${user.email}: N$${totalOutstanding}`);
      }
    } catch (err) {
      console.error("[CRON] Finance reminder error:", err);
    }
  });

  // ─── MATCH REMINDER CRON (every 15 minutes) ────────────────────
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const upcomingMatches = await storage.getUpcomingMatches(now, in48h);

      for (const match of upcomingMatches) {
        if (!match.startTime) continue;
        const startTime = new Date(match.startTime);
        const diffMs = startTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        const reminders: Array<{ type: string; label: string; withinHours: number }> = [
          { type: "48H", label: "48 hours", withinHours: 48 },
          { type: "24H", label: "24 hours", withinHours: 24 },
          { type: "2H", label: "2 hours", withinHours: 2 },
          { type: "TODAY", label: "today", withinHours: 24 },
        ];

        for (const reminder of reminders) {
          if (reminder.type === "TODAY") {
            const matchDay = startTime.toISOString().split("T")[0];
            const today = now.toISOString().split("T")[0];
            if (matchDay !== today) continue;
          } else {
            if (diffHours > reminder.withinHours) continue;
          }

          const team = await storage.getTeam(match.teamId);
          const teamName = team?.name || "your team";
          const title = `Match Reminder`;
          const message = `${teamName} vs ${match.opponent} is ${reminder.type === "TODAY" ? "today" : `in ${reminder.label}`}! ${match.venue} — ${match.competition}`;

          const existingNotifs = await storage.getNotifications();
          const isDuplicate = existingNotifs.some((n: any) => {
            const meta = n.metadata as any;
            return meta?.matchId === match.id && meta?.reminderType === reminder.type;
          });
          if (isDuplicate) continue;

          const adminUsers = await storage.getUsersByRole("ADMIN");
          const managerUsers = await storage.getUsersByRole("MANAGER");
          const allRecipients = [...adminUsers, ...managerUsers];

          const coachAssignments = await storage.getCoachAssignmentsByTeam(match.teamId);
          for (const ca of coachAssignments) {
            if (ca.active) {
              const coachUser = await storage.getUser(ca.coachUserId);
              if (coachUser && !allRecipients.find(u => u.id === coachUser.id)) {
                allRecipients.push(coachUser);
              }
            }
          }

          const teamPlayers = await storage.getPlayersByTeam(match.teamId);
          for (const player of teamPlayers) {
            const playerUser = await storage.getUserByPlayerId(player.id);
            if (playerUser && !allRecipients.find(u => u.id === playerUser.id)) {
              allRecipients.push(playerUser);
            }
          }

          for (const user of allRecipients) {
            await storage.createNotification({
              userId: user.id,
              type: "MATCH_REMINDER",
              title,
              message,
              metadata: { matchId: match.id, reminderType: reminder.type },
            });
          }
        }
      }
    } catch (err) {
      console.error("Match reminder cron error:", err);
    }
  });

  // ─── ADVANCED DEVELOPMENT STATS ────────────────────
  app.get("/api/matches/:matchId/devstats/init", requireAuth, async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ ok: false, message: "teamId required" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ ok: false, message: "Match not found" });

      const devInitTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);
      let players: any[];
      if (devInitTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        players = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo };
        }).filter(Boolean) as any[];
      } else {
        players = await storage.getPlayersByTeam(teamId);
      }
      const events = await storage.getMatchEvents(matchId);
      const teamEvents = events.filter((e: any) => e.teamId === teamId);

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");

      res.json({
        ok: true,
        match: { ...match, isLocked },
        locked: isLocked,
        players: players.map((p: any) => ({
          id: p.id, firstName: p.firstName, lastName: p.lastName,
          jerseyNo: p.jerseyNo, position: p.position, photoUrl: p.photoUrl,
        })),
        events: teamEvents,
        enums: ALL_ENUMS,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/devstats/events", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const b = req.body || {};

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ ok: false, message: "Match not found" });

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");
      if (isLocked) return res.status(403).json({ ok: false, message: "Stats locked: match already submitted." });

      const required = ["teamId", "playerId", "skillType", "outcome"];
      for (const k of required) {
        if (!b[k]) return res.status(400).json({ ok: false, message: `Missing ${k}` });
      }

      if (!SKILL_TYPES.includes(b.skillType)) return res.status(400).json({ ok: false, message: "Invalid skillType" });
      if (!OUTCOME.includes(b.outcome)) return res.status(400).json({ ok: false, message: "Invalid outcome" });

      if (b.outcome === "MINUS") {
        if (!b.outcomeDetail) return res.status(400).json({ ok: false, message: "Outcome detail required for MINUS" });
        if (!b.errorCategory || b.errorCategory === "NONE") return res.status(400).json({ ok: false, message: "Error category required for MINUS" });
      }

      const event = await storage.createMatchEvent({
        matchId,
        teamId: b.teamId,
        playerId: b.playerId,
        action: b.skillType,
        outcome: b.outcome,
        rotation: b.rotation ?? null,
        subType: b.subType ?? null,
        zone: b.zone ?? null,
        tempo: b.tempo ?? null,
        outcomeDetail: b.outcomeDetail ?? null,
        errorCategory: b.errorCategory ?? "NONE",
        errorType: b.errorType ?? null,
        pressureFlag: !!b.pressureFlag,
        fatigueFlag: !!b.fatigueFlag,
        tacticalIntention: b.tacticalIntention ?? null,
        notes: b.notes ?? null,
        createdBy: (req as any).user?.id || null,
      });

      res.json({ ok: true, event });
    } catch (err) { next(err); }
  });

  app.delete("/api/matches/:matchId/devstats/events/:eventId", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId, eventId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ ok: false, message: "Match not found" });

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");
      if (isLocked) return res.status(403).json({ ok: false, message: "Stats locked" });

      await storage.deleteMatchEvent(eventId);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/devstats/report/generate", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const teamId = req.body?.teamId;
      if (!teamId) return res.status(400).json({ ok: false, message: "teamId required" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ ok: false, message: "Match not found" });

      const devReportTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);
      let rosterPlayers: any[];
      if (devReportTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        rosterPlayers = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo };
        }).filter(Boolean) as any[];
      } else {
        rosterPlayers = await storage.getPlayersByTeam(teamId);
      }
      const allEvents = await storage.getMatchEvents(matchId);
      const events = allEvents.filter((e: any) => e.teamId === teamId);

      const report = generateDevelopmentReport({ match, teamId, rosterPlayers, events });
      res.json({ ok: true, report });
    } catch (err) { next(err); }
  });

  app.get("/api/coach/devstats/dashboard", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      const matchId = req.query.matchId as string;
      if (!teamId || !matchId) return res.status(400).json({ ok: false, message: "teamId and matchId required" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ ok: false, message: "Match not found" });

      const coachDashTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);
      let rosterPlayers: any[];
      if (coachDashTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        rosterPlayers = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo };
        }).filter(Boolean) as any[];
      } else {
        rosterPlayers = await storage.getPlayersByTeam(teamId);
      }
      const allEvents = await storage.getMatchEvents(matchId);
      const events = allEvents.filter((e: any) => e.teamId === teamId);

      const report = generateDevelopmentReport({ match, teamId, rosterPlayers, events });

      res.json({
        ok: true,
        dashboard: report.coachAlerts,
        teamSummary: report.teamSummary,
        focus: report.playerSummaries.map((p: any) => ({
          playerId: p.playerId, playerName: p.playerName, focusAreas: p.focusAreas
        })),
      });
    } catch (err) { next(err); }
  });

  // ─── TOUCH STATS (LEGACY) ────────────────────
  app.get("/api/matches/:matchId/stats-touch/init", requireAuth, async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ error: "teamId query parameter required" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const touchTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);
      let players: any[];
      if (touchTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        players = rosters.map(r => {
          const p = playerMap[r.playerId];
          if (!p) return null;
          return { ...p, position: r.position || p.position, jerseyNo: r.jerseyNo ?? p.jerseyNo };
        }).filter(Boolean) as any[];
      } else {
        players = await storage.getPlayersByTeam(teamId);
      }
      const events = await storage.getMatchEvents(matchId);

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");

      const team = await storage.getTeam(teamId);
      let scorerName: string | null = null;
      if ((match as any).scorerUserId) {
        const scorer = await storage.getUser((match as any).scorerUserId);
        if (scorer) scorerName = scorer.fullName;
      } else {
        const currentUser = await storage.getUser(req.user!.userId);
        if (currentUser) scorerName = currentUser.fullName;
      }

      const staffRows = await db.select().from(schema.matchStaffAssignments)
        .where(eq(schema.matchStaffAssignments.matchId, matchId));
      const staffRow = staffRows[0] || null;
      let headCoach: { id: string; fullName: string } | null = null;
      let assistantCoach: { id: string; fullName: string } | null = null;
      if (staffRow?.headCoachUserId) {
        const hc = await storage.getUser(staffRow.headCoachUserId);
        if (hc) headCoach = { id: hc.id, fullName: hc.fullName };
      }
      if (staffRow?.assistantCoachUserId) {
        const ac = await storage.getUser(staffRow.assistantCoachUserId);
        if (ac) assistantCoach = { id: ac.id, fullName: ac.fullName };
      }

      res.json({
        match: {
          ...match,
          isLocked,
          liveHomePoints: (match as any).liveHomePoints || 0,
          liveAwayPoints: (match as any).liveAwayPoints || 0,
          homeSetsWon: (match as any).homeSetsWon || 0,
          awaySetsWon: (match as any).awaySetsWon || 0,
          currentSetNumber: (match as any).currentSetNumber || 1,
          bestOf: (match as any).bestOf || 5,
          playerOfMatchPlayerId: (match as any).playerOfMatchPlayerId || null,
        },
        teamName: team?.name || "Home",
        scorerName,
        staff: { headCoach, assistantCoach },
        players: players.map((p: any) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          jerseyNo: p.jerseyNo,
          position: p.position,
          photoUrl: p.photoUrl,
        })),
        events,
      });
    } catch (err) { next(err); }
  });

  app.get("/api/matches/:matchId/events", requireAuth, async (req, res, next) => {
    try {
      const events = await storage.getMatchEvents(req.params.matchId);
      res.json(events);
    } catch (err) { next(err); }
  });

  const VALID_ACTIONS = ["SERVE", "RECEIVE", "SET", "ATTACK", "BLOCK", "DIG", "FREEBALL"];
  const VALID_OUTCOMES = ["PLUS", "ZERO", "MINUS"];

  app.post("/api/matches/:matchId/events", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const { playerId, action, outcome, teamId, outcomeDetail, combinationType, pointWonByTeamId, pointSide } = req.body;

      if (!playerId || !action || !outcome || !teamId) {
        return res.status(400).json({ error: "Missing playerId, action, outcome, or teamId" });
      }

      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` });
      }
      if (!VALID_OUTCOMES.includes(outcome)) {
        return res.status(400).json({ error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` });
      }

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      if (match.teamId !== teamId) {
        return res.status(400).json({ error: "Team does not match this match's team" });
      }

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");
      if (isLocked) return res.status(403).json({ error: "Stats locked: match already submitted" });

      const eventTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);
      let eventPlayers: any[];
      if (eventTeam?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters).where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        const allPs = await db.select().from(schema.players);
        const playerMap = Object.fromEntries(allPs.map(p => [p.id, p]));
        eventPlayers = rosters.map(r => playerMap[r.playerId]).filter(Boolean) as any[];
      } else {
        eventPlayers = await storage.getPlayersByTeam(teamId);
      }
      const playerBelongs = eventPlayers.some((p: any) => p.id === playerId);
      if (!playerBelongs) {
        return res.status(400).json({ error: "Player does not belong to this team" });
      }

      if (!match.scorerUserId) {
        await storage.updateMatch(matchId, {
          scorerUserId: req.user!.userId,
          scoringStartedAt: new Date(),
        } as any);
      }

      const currentSet = (match as any).currentSetNumber || 1;

      const resolvedPointSide = pointSide || (pointWonByTeamId ? (pointWonByTeamId === match.teamId ? "home" : "away") : null);

      const event = await storage.createMatchEvent({
        matchId,
        teamId,
        playerId,
        action,
        outcome,
        outcomeDetail: outcomeDetail || null,
        combinationType: combinationType || null,
        setNumber: currentSet,
        pointWonByTeamId: resolvedPointSide === "home" ? match.teamId : resolvedPointSide === "away" ? "OPPONENT" : null,
        createdBy: req.user?.userId || null,
      });

      if (action === "SERVE" && outcomeDetail === "ACE") {
        try {
          const acePlayer = await storage.getPlayer(playerId);
          if (acePlayer?.userId) {
            await storage.createNotification({
              userId: acePlayer.userId,
              type: "MATCH_STAT",
              title: "🎆 You served an ACE!",
              message: `Great serve in ${match.opponent ? "vs " + match.opponent : "your match"}! Keep it up!`,
              metadata: { matchId },
            });
          }
        } catch (_) {}
      }

      let setResult = null;
      if (resolvedPointSide) {
        const isHome = resolvedPointSide === "home";
        await storage.updateMatch(matchId, {
          liveHomePoints: ((match as any).liveHomePoints || 0) + (isHome ? 1 : 0),
          liveAwayPoints: ((match as any).liveAwayPoints || 0) + (isHome ? 0 : 1),
        } as any);
        setResult = await checkSetEndFIVB(matchId);
      }

      const updatedMatch = await storage.getMatch(matchId);
      res.json({ event, match: updatedMatch, setResult });
    } catch (err) { next(err); }
  });

  // ── Match Activity Report (HTML print) ──────────────────────
  app.get("/api/matches/:matchId/activity-report", requireAuth, async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const events = await storage.getMatchEvents(matchId);
      const teamId = (match as any).teamId;
      const team = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).then(r => r[0]);

      // Build playerMap from base players table
      const allPlayers = await db.select().from(schema.players);
      const playerMap: Record<string, any> = Object.fromEntries(allPlayers.map((p: any) => [p.id, { ...p }]));

      // For tournament teams: overlay roster-specific jerseyNo and position from tournamentRosters
      if (team?.isTournament) {
        const rosters = await db.select().from(schema.tournamentRosters)
          .where(eq(schema.tournamentRosters.tournamentTeamId, teamId));
        for (const r of rosters) {
          if (playerMap[r.playerId]) {
            if (r.jerseyNo != null) playerMap[r.playerId].jerseyNo = r.jerseyNo;
            if (r.position) playerMap[r.playerId].position = r.position;
          }
        }
      }

      // Further enrich with match squad entries (jerseyNo/position set at squad save time — most accurate)
      const squad = await storage.getMatchSquad(matchId, teamId);
      if (squad) {
        const squadEntries = await storage.getMatchSquadEntries(squad.id);
        for (const e of squadEntries) {
          if (playerMap[e.playerId]) {
            if ((e as any).jerseyNo != null) playerMap[e.playerId].jerseyNo = (e as any).jerseyNo;
            if ((e as any).matchPosition) playerMap[e.playerId].position = (e as any).matchPosition;
          }
        }
      }

      // Per-player stats aggregation from events — aligned with finalizeMatchInternal formula
      const stats: Record<string, any> = {};
      for (const ev of events) {
        const pid = ev.playerId;
        if (!stats[pid]) stats[pid] = { kills: 0, aces: 0, blocks: 0, blockTouches: 0, digs: 0, assists: 0, recvPerfect: 0, attackErr: 0, serveErr: 0, receiveErr: 0, settingErr: 0, attackAtt: 0, total: 0 };
        const s = stats[pid];
        const a = ev.action; const o = ev.outcome;
        if (a === "ATTACK") {
          s.attackAtt++;
          if (o === "PLUS") s.kills++;
          else if (o === "MINUS") s.attackErr++;
        } else if (a === "SERVE") {
          if (o === "PLUS") s.aces++;
          else if (o === "MINUS") s.serveErr++;
        } else if (a === "BLOCK") {
          if (o === "PLUS") s.blocks++;
          else if (o === "ZERO") s.blockTouches++;
        } else if (a === "DIG" && o === "PLUS") {
          s.digs++;
        } else if (a === "SET") {
          if (o === "PLUS") s.assists++;
          else if (o === "MINUS") s.settingErr++;
        } else if (a === "RECEIVE") {
          if (o === "PLUS") s.recvPerfect++;
          else if (o === "MINUS") s.receiveErr++;
        }
        // Net Pts = (Kills + Aces + Block kills) − (Attack + Serve + Receive + Setting errors)
        const totalErrors = s.attackErr + s.serveErr + s.receiveErr + s.settingErr;
        s.total = s.kills + s.aces + s.blocks - totalErrors;
        s.errors = totalErrors;
      }

      // Set breakdown
      const sets: Record<number, { home: number; away: number; events: any[] }> = {};
      for (const ev of events) {
        const sn = (ev as any).setNumber || 1;
        if (!sets[sn]) sets[sn] = { home: 0, away: 0, events: [] };
        if ((ev as any).pointWonByTeamId === (match as any).teamId) sets[sn].home++;
        else if ((ev as any).pointWonByTeamId === "OPPONENT") sets[sn].away++;
        sets[sn].events.push(ev);
      }

      const esc = (s: any) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const matchDate = (match as any).startTime
        ? new Date((match as any).startTime).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : (match as any).matchDate || "Unknown";
      const bestOf = (match as any).bestOf || 5;
      const homeSets = (match as any).homeSetsWon || 0;
      const awaySets = (match as any).awaySetsWon || 0;

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Match Activity Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:#1a1a2e;padding:20mm;max-width:210mm;margin:0 auto;font-size:11px}
  h1{font-size:20px;font-weight:900;color:#0F8B7D;margin-bottom:4px}
  h2{font-size:13px;font-weight:700;color:#0F8B7D;margin:14px 0 6px;border-bottom:2px solid #0F8B7D;padding-bottom:3px}
  h3{font-size:11px;font-weight:700;color:#444;margin:10px 0 4px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #0F8B7D;margin-bottom:14px}
  .logo-area h1{font-size:22px} .logo-area p{color:#666;font-size:10px;margin-top:2px}
  .match-meta{text-align:right;font-size:10px;color:#444;line-height:1.6}
  .score-banner{display:flex;align-items:center;justify-content:center;gap:20px;background:#0F8B7D;color:#fff;border-radius:8px;padding:10px 20px;margin:10px 0;font-weight:900}
  .score-banner .team{font-size:14px} .score-banner .sets{font-size:26px;min-width:60px;text-align:center} .score-banner .bestof{font-size:10px;opacity:0.8}
  table{width:100%;border-collapse:collapse;font-size:10px;margin:6px 0}
  th{background:#0F8B7D;color:#fff;padding:5px 8px;text-align:left;font-size:10px}
  td{padding:4px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even) td{background:#f8f8f8}
  .good{color:#15803d;font-weight:700} .bad{color:#dc2626;font-weight:700} .neutral{color:#555}
  .set-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:8px 0}
  .set-card{border:1px solid #0F8B7D;border-radius:6px;padding:8px;text-align:center}
  .set-card .label{font-size:9px;text-transform:uppercase;color:#888;font-weight:700}
  .set-card .score{font-size:18px;font-weight:900;color:#0F8B7D}
  .ev-list{max-height:none}
  .ev-item{display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid #f0f0f0;font-size:9.5px}
  .ev-action{font-weight:700;min-width:55px;text-transform:uppercase}
  .ev-plus{color:#15803d} .ev-minus{color:#dc2626} .ev-zero{color:#888}
  .ev-name{flex:1;color:#444} .ev-detail{color:#666;font-size:9px}
  .section-split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .notes-box{border:1px dashed #ccc;border-radius:6px;min-height:40mm;padding:8px;margin-top:4px;font-style:italic;color:#aaa;font-size:10px}
  .footer{margin-top:20px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999}
  @media print{body{padding:10mm}@page{margin:10mm;size:A4}button{display:none!important}}
</style>
</head><body>
<div class="header">
  <div class="logo-area">
    <h1>AFROCAT VOLLEYBALL CLUB</h1>
    <p>Match Activity Report &mdash; Generated ${new Date().toLocaleString()}</p>
  </div>
  <div class="match-meta">
    <div><strong>${esc(team?.name || "Afrocat")} vs ${esc((match as any).opponent)}</strong></div>
    <div>${matchDate}</div>
    <div>${esc((match as any).venue || "")}${(match as any).competition ? " &bull; " + esc((match as any).competition) : ""}</div>
    <div>Format: Best of ${bestOf}</div>
  </div>
</div>

<div class="score-banner">
  <span class="team">${esc(team?.name || "AFROCAT")}</span>
  <span class="sets">${homeSets} &ndash; ${awaySets}</span>
  <span class="team">${esc((match as any).opponent)}</span>
  <span class="bestof">&nbsp;(Best of ${bestOf})</span>
</div>`;

      // Set scores
      if (Object.keys(sets).length > 0) {
        html += `<h2>Set Scores</h2><div class="set-row">`;
        Object.entries(sets).sort(([a], [b]) => Number(a) - Number(b)).forEach(([sn, sv]) => {
          const won = sv.home > sv.away;
          html += `<div class="set-card">
            <div class="label">Set ${sn}</div>
            <div class="score" style="color:${won ? "#0F8B7D" : "#dc2626"}">${sv.home} &ndash; ${sv.away}</div>
            <div class="label">${won ? "✓ Won" : "✗ Lost"}</div>
          </div>`;
        });
        html += `</div>`;
      }

      // Player stats
      const statRows = Object.entries(stats).map(([pid, s]) => ({ pid, player: playerMap[pid], ...s as any }))
        .filter(r => r.player)
        .sort((a: any, b: any) => b.total - a.total);
      if (statRows.length > 0) {
        html += `<h2>Player Statistics</h2>
<table>
  <tr><th>#</th><th>Player</th><th>Pos</th><th class="good">Kills</th><th class="good">Aces</th><th class="good">Blocks</th><th>Digs</th><th>Assists</th><th>Recv+</th><th>Atk Att</th><th>Atk Eff%</th><th class="bad">Errors</th><th>Net Pts</th></tr>`;
        statRows.forEach((r: any) => {
          const p = r.player;
          const atkEff = r.attackAtt > 0 ? Math.round((r.kills - r.attackErr) / r.attackAtt * 100) : null;
          html += `<tr>
            <td>${p.jerseyNo || "—"}</td>
            <td><strong>${esc(p.firstName)} ${esc(p.lastName)}</strong></td>
            <td>${esc(p.position || "—")}</td>
            <td class="good">${r.kills}</td><td class="good">${r.aces}</td><td class="good">${r.blocks}</td>
            <td>${r.digs}</td><td>${r.assists}</td><td>${r.recvPerfect}</td>
            <td class="neutral">${r.attackAtt}</td>
            <td class="${atkEff !== null && atkEff >= 40 ? "good" : atkEff !== null && atkEff < 20 ? "bad" : "neutral"}">${atkEff !== null ? atkEff + "%" : "—"}</td>
            <td class="${r.errors > 2 ? "bad" : "neutral"}">${r.errors}</td>
            <td class="${r.total > 0 ? "good" : r.total < 0 ? "bad" : "neutral"}">${r.total > 0 ? "+" : ""}${r.total}</td>
          </tr>`;
        });
        html += `</table>`;
      }

      // Event timeline per set
      html += `<h2>Match Event Timeline</h2>`;
      const ACTION_ICONS: Record<string, string> = {
        SERVE: "Serve", RECEIVE: "Recv", SET: "Set", ATTACK: "Atk", BLOCK: "Block", DIG: "Dig", FREEBALL: "FB"
      };
      Object.entries(sets).sort(([a], [b]) => Number(a) - Number(b)).forEach(([sn, sv]) => {
        html += `<h3>Set ${sn} — Afrocat ${sv.home} : ${sv.away} ${esc((match as any).opponent)}</h3>`;
        html += `<div class="ev-list">`;
        sv.events.forEach((ev: any) => {
          const p = playerMap[ev.playerId];
          const name = p ? `#${p.jerseyNo || "?"} ${p.firstName || ""} ${p.lastName || ""}` : "Unknown";
          const cls = ev.outcome === "PLUS" ? "ev-plus" : ev.outcome === "MINUS" ? "ev-minus" : "ev-zero";
          const sym = ev.outcome === "PLUS" ? "+" : ev.outcome === "MINUS" ? "−" : "○";
          html += `<div class="ev-item">
            <span class="ev-action ${cls}">${sym} ${ACTION_ICONS[ev.action] || ev.action}</span>
            <span class="ev-name">${esc(name)}</span>
            <span class="ev-detail">${esc(ev.outcomeDetail || ev.outcome)}</span>
          </div>`;
        });
        html += `</div>`;
      });

      if (events.length === 0) html += `<p style="color:#999;font-style:italic;padding:10px 0">No match events recorded yet.</p>`;

      html += `
<div class="section-split" style="margin-top:16px">
  <div>
    <h2>Coaching Notes</h2>
    <div class="notes-box">Coach notes from match board...</div>
  </div>
  <div>
    <h2>Substitution Record</h2>
    <div class="notes-box">Record substitutions here...</div>
  </div>
</div>
<div class="footer">
  <span>Afrocat Volleyball Club &mdash; Confidential Match Report</span>
  <span>Match ID: ${matchId}</span>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err) { next(err); }
  });

  app.patch("/api/matches/:matchId/format", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const body = z.object({ bestOf: z.union([z.literal(3), z.literal(5)]) }).parse(req.body);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if ((match as any).scoringStartedAt) return res.status(400).json({ error: "Cannot change format after scoring has started" });
      await storage.updateMatch(matchId, { bestOf: body.bestOf } as any);
      const updated = await storage.getMatch(matchId);
      res.json(updated);
    } catch (err) { next(err); }
  });

  async function checkSetEndFIVB(matchId: string) {
    const match = await storage.getMatch(matchId);
    if (!match) return null;
    const bestOf = (match as any).bestOf || 5;
    const currentSet = (match as any).currentSetNumber || 1;
    const hp = (match as any).liveHomePoints || 0;
    const ap = (match as any).liveAwayPoints || 0;
    const homeSets = (match as any).homeSetsWon || 0;
    const awaySets = (match as any).awaySetsWon || 0;
    const neededToWin = bestOf === 5 ? 3 : 2;
    const isDecidingSet = (bestOf === 5 && currentSet === 5) || (bestOf === 3 && currentSet === 3);
    const target = isDecidingSet ? 15 : 25;
    const lead = Math.abs(hp - ap);
    if ((hp >= target || ap >= target) && lead >= 2) {
      const homeWon = hp > ap;
      const newHomeSets = homeSets + (homeWon ? 1 : 0);
      const newAwaySets = awaySets + (homeWon ? 0 : 1);
      const matchComplete = newHomeSets >= neededToWin || newAwaySets >= neededToWin;
      await storage.updateMatch(matchId, {
        homeSetsWon: newHomeSets,
        awaySetsWon: newAwaySets,
        currentSetNumber: currentSet + 1,
        liveHomePoints: 0,
        liveAwayPoints: 0,
      } as any);
      if (matchComplete) {
        await finalizeMatchInternal(matchId);
      }
      return { setEnded: true, setNumber: currentSet, winner: homeWon ? "AFROCAT" : "OPP", homePoints: hp, awayPoints: ap, matchComplete, homeSets: newHomeSets, awaySets: newAwaySets };
    }
    return null;
  }

  async function finalizeMatchInternal(matchId: string) {
    const match = await storage.getMatch(matchId);
    if (!match) return;
    const events = await storage.getMatchEvents(matchId);
    const playerAgg: Record<string, { spikesKill: number; spikesError: number; servesAce: number; servesError: number; blocksSolo: number; blocksAssist: number; receivePerfect: number; receivePositive: number; receiveError: number; digs: number; settingAssist: number; settingError: number; }> = {};
    for (const ev of events) {
      if (!playerAgg[ev.playerId]) {
        playerAgg[ev.playerId] = { spikesKill: 0, spikesError: 0, servesAce: 0, servesError: 0, blocksSolo: 0, blocksAssist: 0, receivePerfect: 0, receivePositive: 0, receiveError: 0, digs: 0, settingAssist: 0, settingError: 0 };
      }
      const s = playerAgg[ev.playerId];
      const a = ev.action; const o = ev.outcome; const od = ev.outcomeDetail || "";
      if (a === "ATTACK" && o === "PLUS") s.spikesKill++;
      else if (a === "ATTACK" && o === "MINUS") s.spikesError++;
      else if (a === "SERVE" && o === "PLUS") s.servesAce++;
      else if (a === "SERVE" && o === "MINUS") s.servesError++;
      else if (a === "BLOCK" && o === "PLUS") s.blocksSolo++;
      else if (a === "BLOCK" && o === "ZERO") s.blocksAssist++;
      else if (a === "RECEIVE" && o === "PLUS") s.receivePerfect++;
      else if (a === "RECEIVE" && o === "ZERO" && od === "2_POSITIVE") s.receivePositive++;
      else if (a === "RECEIVE" && o === "MINUS") s.receiveError++;
      else if (a === "DIG" && o === "PLUS") s.digs++;
      else if (a === "SET" && o === "PLUS") s.settingAssist++;
      else if (a === "SET" && o === "MINUS") s.settingError++;
    }

    const focusAreasMap = new Map<string, string[]>();
    for (const [playerId, stat] of Object.entries(playerAgg)) {
      // Standard FIVB net-points formula: direct rally-winning actions minus direct faults
      // Kill / Ace / Solo Block each win a rally point (+1 each)
      // Attack error / Serve error / Receive error / Setting error give opponent a rally point (-1 each)
      // Digs, setting assists, block assists, receive perfects are support stats shown in their own columns
      const pointsTotal = stat.spikesKill + stat.servesAce + stat.blocksSolo
        - stat.spikesError - stat.servesError - stat.receiveError - stat.settingError;
      await storage.upsertStat({ ...stat, matchId, playerId, pointsTotal });
      const player = await storage.getPlayer(playerId);
      const pos = (player?.position || "").toLowerCase();
      const focusAreas: string[] = [];

      if (pos.includes("setter")) {
        if (stat.settingAssist < 5) focusAreas.push("Setting output — create more attack opportunities");
        if (stat.settingError >= 2) focusAreas.push("Setting decision-making");
        if (stat.servesError >= 2) focusAreas.push("Serving consistency");
      } else if (pos.includes("libero")) {
        if (stat.receivePerfect < 3 && stat.receiveError >= 1) focusAreas.push("Reception quality — aim for more perfect passes");
        if (stat.digs < 3) focusAreas.push("Defensive range — cover more court area");
        if (stat.receiveError >= 2) focusAreas.push("Serve reception fundamentals");
      } else if (pos.includes("outside") || pos.includes("opposite")) {
        if (stat.spikesKill < 3 && stat.spikesError >= 2) focusAreas.push("Attack efficiency — improve angle selection");
        if (stat.receiveError >= 2) focusAreas.push("Pass quality to support attack transitions");
        if (stat.servesError >= 3) focusAreas.push("Serving consistency");
      } else if (pos.includes("middle")) {
        if ((stat.blocksSolo + stat.blocksAssist) < 2) focusAreas.push("Blocking timing and read");
        if (stat.spikesKill < 1) focusAreas.push("Quick attack execution");
        if (stat.servesError >= 2) focusAreas.push("Jump serve control");
      } else {
        if (stat.servesError >= 3) focusAreas.push("Serving consistency");
        if (stat.spikesError >= 3) focusAreas.push("Attack control");
        if (stat.receiveError >= 3) focusAreas.push("Serve reception");
        if (stat.settingError >= 3) focusAreas.push("Setting accuracy");
      }

      focusAreasMap.set(playerId, focusAreas);
      if (focusAreas.length > 0) await storage.createSmartFocus({ playerId, matchId, focusAreas });
    }

    let pomScore: Record<string, number> = {};
    for (const [pid, s] of Object.entries(playerAgg)) {
      pomScore[pid] = (s.spikesKill * 3) + (s.servesAce * 3) + (s.blocksSolo * 3) + (s.receivePerfect * 2) + (s.receivePositive * 1) + (s.blocksAssist * 1) + (s.digs * 2) + (s.settingAssist * 1) - (s.spikesError * 2) - (s.servesError * 2) - (s.receiveError * 2) - (s.settingError * 1);
    }

    const pomSorted = Object.entries(pomScore).sort(([pidA, scoreA], [pidB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA;
      const a = playerAgg[pidA]; const b = playerAgg[pidB];
      const errA = a.spikesError + a.servesError + a.receiveError + a.settingError;
      const errB = b.spikesError + b.servesError + b.receiveError + b.settingError;
      if (errA !== errB) return errA - errB;
      if (a.receivePerfect !== b.receivePerfect) return b.receivePerfect - a.receivePerfect;
      const ptsA = a.spikesKill + a.servesAce + a.blocksSolo;
      const ptsB = b.spikesKill + b.servesAce + b.blocksSolo;
      return ptsB - ptsA;
    });

    let pomPlayerId: string | null = null;
    if (pomSorted.length > 0) {
      pomPlayerId = pomSorted[0][0];
    }

    const updatedMatch = await storage.getMatch(matchId);
    const updateData: any = {
      statsEntered: true,
      scoreLocked: true,
      scoreSource: "STATS",
      scoringEndedAt: new Date(),
      playerOfMatchPlayerId: pomPlayerId,
      homeScore: (updatedMatch as any)?.homeSetsWon || 0,
      awayScore: (updatedMatch as any)?.awaySetsWon || 0,
      setsFor: (updatedMatch as any)?.homeSetsWon || 0,
      setsAgainst: (updatedMatch as any)?.awaySetsWon || 0,
    };
    if ((match as any).scoringStartedAt) {
      updateData.matchDurationMinutes = Math.round((Date.now() - new Date((match as any).scoringStartedAt).getTime()) / 60000);
    }
    updateData.result = updateData.homeScore > updateData.awayScore ? "W" : updateData.homeScore < updateData.awayScore ? "L" : "D";
    await storage.updateMatch(matchId, updateData);

    const team = await storage.getTeam(match.teamId);
    const matchLabel = `${team?.name || "Afrocat"} vs ${match.opponent}`;

    if (pomPlayerId) {
      const pomPlayer = await storage.getPlayer(pomPlayerId);
      if (pomPlayer) {
        const awardMonth = new Date().toISOString().slice(0, 7);
        try {
          await storage.createAward({
            playerId: pomPlayerId,
            awardType: "MATCH_MVP",
            awardMonth,
            notes: `Match MVP — ${matchLabel} on ${(match as any).matchDate || new Date().toLocaleDateString()}`,
            matchId,
          } as any);
        } catch (_) {}

        if (pomPlayer.userId) {
          try {
            await storage.createNotification({
              userId: pomPlayer.userId,
              type: "MATCH_SELECTION",
              title: "🏆 You are Match MVP!",
              message: `Congratulations! You have been selected as the Match MVP for ${matchLabel}. Outstanding performance — keep it up!`,
              metadata: { matchId, awardType: "MATCH_MVP" },
            });
          } catch (_) {}
        }

        const allUsers = await storage.getUsers();
        for (const u of allUsers) {
          if (u.accountStatus !== "ACTIVE") continue;
          if (u.id === pomPlayer.userId) continue;
          try {
            await storage.createNotification({
              userId: u.id,
              type: "MATCH_SELECTION",
              title: "Match MVP Announced",
              message: `${pomPlayer.firstName} ${pomPlayer.lastName} (#${pomPlayer.jerseyNo || "?"}) has been named Match MVP — ${matchLabel}`,
              metadata: { matchId, awardType: "MATCH_MVP" },
            });
          } catch (_) {}
        }
      }
    }

    for (const [playerId, stat] of Object.entries(playerAgg)) {
      const player = await storage.getPlayer(playerId);
      if (!player?.userId) continue;
      const totalErrors = stat.spikesError + stat.servesError + stat.receiveError + stat.settingError;
      const playerFocusAreas = focusAreasMap.get(playerId) || [];
      const pts = (stat.spikesKill * 2) + (stat.servesAce * 2) + (stat.blocksSolo * 2) + stat.blocksAssist + stat.digs + stat.settingAssist - (totalErrors * 2);
      const focusPart = playerFocusAreas.length > 0
        ? `Training Focus: ${playerFocusAreas.join(" • ")}`
        : "No major weaknesses — excellent performance!";
      const msg = `vs ${match.opponent} | Kills: ${stat.spikesKill}  Aces: ${stat.servesAce}  Blocks: ${stat.blocksSolo}  Digs: ${stat.digs}  Assists: ${stat.settingAssist}  Errors: ${totalErrors}  Net Pts: ${pts > 0 ? "+" : ""}${pts}. ${focusPart} Open your Player Dashboard for full stats.`;
      try {
        await storage.createNotification({ userId: player.userId, type: "MATCH_SELECTION", title: "Your Match Stats Ready", message: msg, metadata: { matchId } });
      } catch (_) {}
    }

    const allUsers = await storage.getUsers();
    const coaches = allUsers.filter((u: any) => u.role === "ADMIN" || u.role === "COACH" || (u.roles && (u.roles.includes("ADMIN") || u.roles.includes("COACH"))));
    for (const c of coaches) {
      try {
        await storage.createNotification({ userId: c.id, type: "MATCH_SELECTION", title: "Match Report Ready", message: `Stats finalized for ${matchLabel}. Check coach dashboard for player alerts and training focus.`, metadata: { matchId } });
      } catch (_) {}
    }
  }

  app.post("/api/matches/:matchId/scoreboard/point", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const { side } = req.body;
      if (!["AFROCAT", "OPP", "home", "away"].includes(side)) return res.status(400).json({ error: "side must be 'AFROCAT' or 'OPP'" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const isLocked = !!(match.statsEntered || match.scoreLocked);
      if (isLocked) return res.status(403).json({ error: "Match is locked" });

      const isHome = side === "AFROCAT" || side === "home";
      await storage.updateMatch(matchId, {
        liveHomePoints: ((match as any).liveHomePoints || 0) + (isHome ? 1 : 0),
        liveAwayPoints: ((match as any).liveAwayPoints || 0) + (isHome ? 0 : 1),
      } as any);

      const setResult = await checkSetEndFIVB(matchId);
      const updated = await storage.getMatch(matchId);
      res.json({ match: updated, setResult });
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/scoreboard/undo-last", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const isLocked = !!(match.statsEntered || match.scoreLocked);
      if (isLocked) return res.status(403).json({ error: "Match is locked" });

      const hp = (match as any).liveHomePoints || 0;
      const ap = (match as any).liveAwayPoints || 0;
      if (hp + ap <= 0) return res.json({ match });

      const events = await storage.getMatchEvents(matchId);
      const lastWithPoint = events
        .filter((e: any) => e.pointWonByTeamId)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (lastWithPoint) {
        const isHome = lastWithPoint.pointWonByTeamId === (match as any).teamId;
        await storage.updateMatch(matchId, {
          liveHomePoints: Math.max(0, hp - (isHome ? 1 : 0)),
          liveAwayPoints: Math.max(0, ap - (isHome ? 0 : 1)),
        } as any);
      } else if (hp >= ap && hp > 0) {
        await storage.updateMatch(matchId, { liveHomePoints: hp - 1 } as any);
      } else if (ap > 0) {
        await storage.updateMatch(matchId, { liveAwayPoints: ap - 1 } as any);
      }

      const updated = await storage.getMatch(matchId);
      res.json({ match: updated });
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/scoreboard/undo-point", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const hp = (match as any).liveHomePoints || 0;
      const ap = (match as any).liveAwayPoints || 0;
      if (hp + ap <= 0) return res.json(match);
      const events = await storage.getMatchEvents(matchId);
      const lastWithPoint = events.filter((e: any) => e.pointWonByTeamId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (lastWithPoint) {
        const isHome = lastWithPoint.pointWonByTeamId === (match as any).teamId;
        await storage.updateMatch(matchId, { liveHomePoints: Math.max(0, hp - (isHome ? 1 : 0)), liveAwayPoints: Math.max(0, ap - (isHome ? 0 : 1)) } as any);
      } else if (hp >= ap && hp > 0) {
        await storage.updateMatch(matchId, { liveHomePoints: hp - 1 } as any);
      } else if (ap > 0) {
        await storage.updateMatch(matchId, { liveAwayPoints: ap - 1 } as any);
      }
      const updated = await storage.getMatch(matchId);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/scoreboard/decrement", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const { side } = req.body;
      if (!["home", "away"].includes(side)) return res.status(400).json({ error: "side must be 'home' or 'away'" });
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");
      if (isLocked) return res.status(403).json({ error: "Match is locked" });
      const hp = (match as any).liveHomePoints || 0;
      const ap = (match as any).liveAwayPoints || 0;
      if (side === "home" && hp > 0) await storage.updateMatch(matchId, { liveHomePoints: hp - 1 } as any);
      else if (side === "away" && ap > 0) await storage.updateMatch(matchId, { liveAwayPoints: ap - 1 } as any);
      const updated = await storage.getMatch(matchId);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/scoreboard/end-set", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if ((match as any).bestOf) return res.status(400).json({ error: "Manual end-set disabled for FIVB-format matches. Sets end automatically." });
      const { winner } = req.body;
      if (!["home", "away"].includes(winner)) return res.status(400).json({ error: "winner must be 'home' or 'away'" });
      const currentSet = (match as any).currentSetNumber || 1;
      if (currentSet > 5) return res.status(400).json({ error: "Maximum 5 sets" });
      await storage.updateMatch(matchId, {
        homeSetsWon: ((match as any).homeSetsWon || 0) + (winner === "home" ? 1 : 0),
        awaySetsWon: ((match as any).awaySetsWon || 0) + (winner === "away" ? 1 : 0),
        currentSetNumber: currentSet + 1,
        liveHomePoints: 0,
        liveAwayPoints: 0,
      } as any);
      const updated = await storage.getMatch(matchId);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.get("/api/matches/:matchId/stats-report/print", requireAuth, async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const team = await storage.getTeam(match.teamId);
      const allStats = await storage.getStatsByMatch(matchId);
      const players = await storage.getPlayersByTeam(match.teamId);
      const playerMap = new Map(players.map(p => [p.id, p]));

      const esc = (s: any) => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const matchDate = (match as any).matchDate ? new Date((match as any).matchDate).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "—";
      const homeSets = (match as any).homeSetsWon ?? (match as any).setsFor ?? 0;
      const awaySets = (match as any).awaySetsWon ?? (match as any).setsAgainst ?? 0;
      const result = (match as any).result;

      const enriched = allStats.map(s => {
        const p = playerMap.get(s.playerId);
        const totalErrors = (s.spikesError || 0) + (s.servesError || 0) + (s.receiveError || 0) + (s.settingError || 0);
        return {
          jerseyNo: p?.jerseyNo ?? "—",
          name: p ? `${p.firstName} ${p.lastName}` : "Unknown",
          position: p?.position ?? "—",
          kills: s.spikesKill ?? 0,
          aces: s.servesAce ?? 0,
          blocks: (s.blocksSolo ?? 0) + (s.blocksAssist ?? 0),
          digs: s.digs ?? 0,
          assists: s.settingAssist ?? 0,
          receive: s.receivePerfect ?? 0,
          errors: totalErrors,
          pts: s.pointsTotal ?? 0,
          playerId: s.playerId,
        };
      }).sort((a, b) => b.pts - a.pts);

      const focusMap = new Map<string, string[]>();
      for (const s of allStats) {
        const sf = await storage.getSmartFocusByPlayer(s.playerId);
        const matchFocus = sf.filter((f: any) => f.matchId === matchId);
        if (matchFocus.length > 0) {
          const combined = matchFocus.flatMap((f: any) => f.focusAreas || []);
          focusMap.set(s.playerId, combined);
        }
      }

      const teamTotal = {
        kills: enriched.reduce((s, r) => s + r.kills, 0),
        aces: enriched.reduce((s, r) => s + r.aces, 0),
        blocks: enriched.reduce((s, r) => s + r.blocks, 0),
        digs: enriched.reduce((s, r) => s + r.digs, 0),
        assists: enriched.reduce((s, r) => s + r.assists, 0),
        errors: enriched.reduce((s, r) => s + r.errors, 0),
        pts: enriched.reduce((s, r) => s + r.pts, 0),
      };

      const playerRows = enriched.map(r => {
        const focus = focusMap.get(r.playerId) || [];
        const focusHtml = focus.length > 0
          ? `<div class="focus-tags">${focus.map(f => `<span class="focus-tag">${esc(f)}</span>`).join("")}</div>`
          : `<div class="focus-ok">✓ Good performance</div>`;
        return `<tr>
          <td class="num">${esc(r.jerseyNo)}</td>
          <td><strong>${esc(r.name)}</strong>${focusHtml}</td>
          <td class="pos">${esc(r.position)}</td>
          <td class="good">${r.kills}</td>
          <td class="good">${r.aces}</td>
          <td class="good">${r.blocks}</td>
          <td class="good">${r.digs}</td>
          <td>${r.assists}</td>
          <td>${r.receive}</td>
          <td class="${r.errors > 3 ? "bad" : r.errors > 1 ? "warn" : ""}">${r.errors}</td>
          <td class="${r.pts > 0 ? "good" : r.pts < 0 ? "bad" : ""}">${r.pts > 0 ? "+" : ""}${r.pts}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<title>Match Stats Report — ${esc(team?.name || "Afrocat")} vs ${esc((match as any).opponent)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:#1a1a2e;padding:12mm 14mm;font-size:11px;max-width:297mm}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F8B7D;padding-bottom:10px;margin-bottom:12px}
  .club-name{font-size:18px;font-weight:900;color:#0F8B7D;letter-spacing:1px}
  .club-sub{font-size:9px;color:#888;margin-top:2px}
  .match-meta{text-align:right;font-size:10px;color:#444;line-height:1.7}
  .score-banner{display:flex;align-items:center;justify-content:center;gap:16px;background:#0F8B7D;color:#fff;border-radius:8px;padding:10px 20px;margin:10px 0;font-weight:900}
  .score-banner .team{font-size:14px}
  .score-banner .sets{font-size:28px;min-width:70px;text-align:center}
  .result-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:900;letter-spacing:1px}
  .win{background:#d1fae5;color:#065f46} .loss{background:#fee2e2;color:#991b1b} .draw{background:#fef3c7;color:#92400e}
  h2{font-size:12px;font-weight:700;color:#0F8B7D;margin:14px 0 6px;border-bottom:2px solid #0F8B7D;padding-bottom:3px;text-transform:uppercase;letter-spacing:0.5px}
  table{width:100%;border-collapse:collapse;font-size:10px;margin:4px 0}
  th{background:#0F8B7D;color:#fff;padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.3px}
  th.num,th.pos,td.num,td.pos{text-align:center}
  td{padding:5px 6px;border-bottom:1px solid #eef0f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fbfa}
  tfoot td{background:#0F8B7D;color:#fff;font-weight:700;padding:5px 6px}
  .good{color:#15803d;font-weight:700;text-align:center}
  .bad{color:#dc2626;font-weight:700;text-align:center}
  .warn{color:#d97706;font-weight:700;text-align:center}
  td:not(:nth-child(1)):not(:nth-child(2)):not(:nth-child(3)){text-align:center}
  .focus-tags{display:flex;flex-wrap:wrap;gap:2px;margin-top:2px}
  .focus-tag{background:#fef3c7;color:#92400e;font-size:7.5px;padding:1px 5px;border-radius:10px;font-weight:600}
  .focus-ok{color:#15803d;font-size:8px;margin-top:2px}
  .legend{display:flex;gap:14px;font-size:9px;color:#666;margin:8px 0 0}
  .legend span{display:flex;align-items:center;gap:3px}
  .footer{margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
  @media print{body{padding:8mm}@page{margin:8mm;size:A4 landscape}button{display:none!important}.no-print{display:none!important}}
</style>
</head><body>

<div class="header">
  <div>
    <div class="club-name">AFROCAT VOLLEYBALL CLUB</div>
    <div class="club-sub">One Team One Dream — Passion Discipline Victory</div>
    <div style="margin-top:6px;font-size:10px;color:#444">
      <strong>${esc(team?.name || "Afrocat")}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}
    </div>
  </div>
  <div class="match-meta">
    <div><strong>${esc(team?.name || "Afrocat")} vs ${esc((match as any).opponent)}</strong></div>
    <div>${matchDate}</div>
    <div>${esc((match as any).venue || "")}${(match as any).competition ? " &bull; " + esc((match as any).competition) : ""}</div>
    <div>Format: Best of ${(match as any).bestOf || 5}</div>
    <div>
      <span class="result-badge ${result === "W" ? "win" : result === "L" ? "loss" : "draw"}">
        ${result === "W" ? "VICTORY" : result === "L" ? "DEFEAT" : result === "D" ? "DRAW" : "PENDING"}
      </span>
    </div>
  </div>
</div>

<div class="score-banner">
  <span class="team">${esc(team?.name || "AFROCAT")}</span>
  <span class="sets">${homeSets} &ndash; ${awaySets}</span>
  <span class="team">${esc((match as any).opponent)}</span>
</div>

<h2>Player Statistics</h2>
<table>
  <thead>
    <tr>
      <th class="num">#</th>
      <th>Player &amp; Focus Areas</th>
      <th class="pos">Pos</th>
      <th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th>
      <th>Assists</th><th>Recv+</th><th>Errors</th><th>Net Pts</th>
    </tr>
  </thead>
  <tbody>${playerRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="3">TEAM TOTALS (${enriched.length} players)</td>
      <td>${teamTotal.kills}</td><td>${teamTotal.aces}</td><td>${teamTotal.blocks}</td>
      <td>${teamTotal.digs}</td><td>${teamTotal.assists}</td><td>—</td>
      <td>${teamTotal.errors}</td><td>${teamTotal.pts > 0 ? "+" : ""}${teamTotal.pts}</td>
    </tr>
  </tfoot>
</table>

<div class="legend">
  <span><strong style="color:#15803d">Kills</strong> = Attack kills (direct point)</span>
  <span><strong style="color:#15803d">Aces</strong> = Service aces (direct point)</span>
  <span><strong style="color:#15803d">Blocks</strong> = Solo + block touches</span>
  <span><strong style="color:#15803d">Digs</strong> = Successful defensive digs</span>
  <span><strong>Assists</strong> = Setting assists</span>
  <span><strong>Recv+</strong> = Perfect receptions</span>
  <span><strong style="color:#dc2626">Errors</strong> = Attack + Serve + Receive + Setting errors</span>
  <span><strong>Net Pts</strong> = (Kills + Aces + Block kills) − (Attack + Serve + Receive + Setting errors)</span>
</div>

<div class="footer">
  <span>AFROCAT VOLLEYBALL CLUB — Match Stats Report &mdash; Confidential</span>
  <span>Match ID: ${matchId} &mdash; ${new Date().toLocaleDateString()}</span>
</div>

<div class="no-print" style="text-align:center;margin-top:16px">
  <button onclick="window.print()" style="background:#0F8B7D;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
    &#128438; Save as PDF / Print
  </button>
</div>

<script>window.onload=()=>setTimeout(()=>window.print(),500)</script>
</body></html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (e) { next(e); }
  });

  app.post("/api/matches/:matchId/finalize", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if (match.statsEntered || match.scoreLocked) return res.status(400).json({ error: "Match already finalized" });
      await finalizeMatchInternal(matchId);
      const updated = await storage.getMatch(matchId);
      res.json({ ok: true, match: updated });
    } catch (err) { next(err); }
  });

  app.get("/api/matches/:matchId/report", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const team = await storage.getTeam(match.teamId);
      const stats = await storage.getStatsByMatch(matchId);
      const events = await storage.getMatchEvents(matchId);
      const squadRows = await db.select().from(schema.matchSquadEntries).where(eq(schema.matchSquadEntries.matchId, matchId));
      const staffRows = await db.select().from(schema.matchStaffAssignments).where(eq(schema.matchStaffAssignments.matchId, matchId));
      const staff = staffRows[0] || null;

      const playerIds = [...new Set([...stats.map((s: any) => s.playerId), ...squadRows.map((s: any) => s.playerId)])];
      const playersRaw = await Promise.all(playerIds.map(id => storage.getPlayer(id)));
      const players = playersRaw.filter(Boolean);

      const staffUsers: Record<string, any> = {};
      if (staff) {
        for (const key of ["headCoachUserId", "assistantCoachUserId", "medicUserId", "teamManagerUserId"]) {
          const uid = (staff as any)[key];
          if (uid) {
            const u = await storage.getUser(uid);
            if (u) staffUsers[key.replace("UserId", "")] = { firstName: u.firstName, lastName: u.lastName };
          }
        }
      }

      const setBreakdown: Record<number, { homePoints: number; awayPoints: number }> = {};
      for (const ev of events) {
        const sn = (ev as any).setNumber || 1;
        if (!setBreakdown[sn]) setBreakdown[sn] = { homePoints: 0, awayPoints: 0 };
        if ((ev as any).pointWonByTeamId === match.teamId) setBreakdown[sn].homePoints++;
        else if ((ev as any).pointWonByTeamId) setBreakdown[sn].awayPoints++;
      }

      const playerDetails = players.map((p: any) => {
        const pStats = stats.find((s: any) => s.playerId === p.id);
        const squadEntry = squadRows.find((s: any) => s.playerId === p.id);
        return {
          id: p.id, firstName: p.firstName, lastName: p.lastName,
          jerseyNo: p.jerseyNo, position: p.position,
          photoUrl: p.photoUrl || null, isLibero: squadEntry?.isLibero || false,
          stats: pStats ? {
            spikesKill: pStats.spikesKill, spikesError: pStats.spikesError,
            servesAce: pStats.servesAce, servesError: pStats.servesError,
            blocksSolo: pStats.blocksSolo, blocksAssist: pStats.blocksAssist,
            receivePerfect: pStats.receivePerfect, receiveError: pStats.receiveError,
            digs: pStats.digs, settingAssist: pStats.settingAssist, settingError: pStats.settingError,
            pointsTotal: pStats.pointsTotal,
          } : null,
        };
      });

      res.json({
        match: {
          id: match.id, matchDate: match.matchDate, opponent: match.opponent,
          venue: match.venue, competition: match.competition, round: (match as any).round,
          result: match.result, homeScore: match.homeScore, awayScore: match.awayScore,
          homeSetsWon: (match as any).homeSetsWon, awaySetsWon: (match as any).awaySetsWon,
          matchDurationMinutes: (match as any).matchDurationMinutes,
          scoringStartedAt: (match as any).scoringStartedAt,
          scoringEndedAt: (match as any).scoringEndedAt,
        },
        team: team ? { id: team.id, name: team.name } : null,
        staff: staffUsers,
        setBreakdown,
        players: playerDetails,
        totalEvents: events.length,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/matches/:matchId/stats-touch/sync", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const events = await storage.getMatchEvents(matchId);
      if (events.length === 0) return res.status(400).json({ message: "No touch events to sync" });

      const playerAgg: Record<string, {
        spikesKill: number; spikesError: number;
        servesAce: number; servesError: number;
        blocksSolo: number; blocksAssist: number;
        receivePerfect: number; receiveError: number;
        digs: number; settingAssist: number; settingError: number;
      }> = {};

      for (const ev of events) {
        if (!playerAgg[ev.playerId]) {
          playerAgg[ev.playerId] = {
            spikesKill: 0, spikesError: 0,
            servesAce: 0, servesError: 0,
            blocksSolo: 0, blocksAssist: 0,
            receivePerfect: 0, receiveError: 0,
            digs: 0, settingAssist: 0, settingError: 0,
          };
        }
        const s = playerAgg[ev.playerId];
        const a = ev.action;
        const o = ev.outcome;

        if (a === "ATTACK" && o === "PLUS") s.spikesKill++;
        else if (a === "ATTACK" && o === "MINUS") s.spikesError++;
        else if (a === "SERVE" && o === "PLUS") s.servesAce++;
        else if (a === "SERVE" && o === "MINUS") s.servesError++;
        else if (a === "BLOCK" && o === "PLUS") s.blocksSolo++;
        else if (a === "BLOCK" && o === "ZERO") s.blocksAssist++;
        else if (a === "RECEIVE" && o === "PLUS") s.receivePerfect++;
        else if (a === "RECEIVE" && o === "MINUS") s.receiveError++;
        else if (a === "DIG" && o === "PLUS") s.digs++;
        else if (a === "SET" && o === "PLUS") s.settingAssist++;
        else if (a === "SET" && o === "MINUS") s.settingError++;
      }

      const results = [];
      for (const [playerId, stat] of Object.entries(playerAgg)) {
        const pointsTotal =
          (stat.spikesKill * 2) + (stat.servesAce * 2) + (stat.blocksSolo * 2) +
          stat.blocksAssist + stat.digs + stat.settingAssist -
          (stat.spikesError * 2) - (stat.servesError * 2) - (stat.receiveError * 2) - (stat.settingError * 2);

        const saved = await storage.upsertStat({ ...stat, matchId, playerId, pointsTotal });
        results.push(saved);

        const player = await storage.getPlayer(playerId);
        const focusAreas: string[] = [];
        if (stat.servesError >= 3) focusAreas.push("Serving consistency");
        if (stat.spikesError >= 3) focusAreas.push("Attack control");
        if (stat.receiveError >= 3) focusAreas.push("Serve reception");
        if (stat.settingError >= 3) focusAreas.push("Setting accuracy");
        if (player && player.position && player.position.toLowerCase().includes("middle") && (stat.blocksSolo + stat.blocksAssist) < 2) {
          focusAreas.push("Blocking timing");
        }
        if (focusAreas.length > 0) {
          await storage.createSmartFocus({ playerId, matchId, focusAreas });
        }
      }

      const updateData: any = { statsEntered: true, scoreSource: "STATS", scoringEndedAt: new Date() };
      if ((match as any).scoringStartedAt) {
        const start = new Date((match as any).scoringStartedAt).getTime();
        const end = Date.now();
        updateData.matchDurationMinutes = Math.round((end - start) / 60000);
      }
      updateData.homeScore = (match as any).homeSetsWon || 0;
      updateData.awayScore = (match as any).awaySetsWon || 0;
      updateData.setsFor = (match as any).homeSetsWon || 0;
      updateData.setsAgainst = (match as any).awaySetsWon || 0;
      if (updateData.homeScore > updateData.awayScore) updateData.result = "W";
      else if (updateData.homeScore < updateData.awayScore) updateData.result = "L";
      
      await storage.updateMatch(matchId, updateData);

      res.json({ ok: true, synced: results.length, stats: results });
    } catch (err) { next(err); }
  });

  app.delete("/api/matches/:matchId/events/:eventId", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const { matchId, eventId } = req.params;

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");
      if (isLocked) return res.status(403).json({ error: "Stats locked: match already submitted" });

      const event = await storage.getMatchEvent(eventId);
      if (!event || event.matchId !== matchId) {
        return res.status(404).json({ error: "Event not found for this match" });
      }

      await storage.deleteMatchEvent(eventId);
      res.json({ ok: true, match });
    } catch (err) { next(err); }
  });

  // ─── NOTICE BOARD ────────────────────
  app.get("/api/notices", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const player = user.playerId ? await storage.getPlayer(user.playerId) : null;
      const teamId = player?.teamId || undefined;
      const posts = await storage.getNoticeBoardPosts(teamId);
      res.json(posts);
    } catch (e) { next(e); }
  });

  app.post("/api/notices", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const body = z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(10000),
        audience: z.enum(["ALL", "TEAM"]).default("ALL"),
        teamId: z.string().optional(),
      }).parse(req.body);

      const post = await storage.createNoticeBoardPost({
        title: body.title,
        body: body.body,
        audience: body.audience,
        teamId: body.audience === "TEAM" ? (body.teamId || null) : null,
        createdBy: req.user!.userId,
      });

      const allUsers = await storage.getAllUsers();
      let targetUsers = allUsers;
      if (body.audience === "TEAM" && body.teamId) {
        const teamPlayers = await storage.getPlayersByTeam(body.teamId);
        const teamPlayerUserIds = new Set<string>();
        for (const p of teamPlayers) {
          if (p.userId) teamPlayerUserIds.add(p.userId);
        }
        targetUsers = allUsers.filter(u => teamPlayerUserIds.has(u.id) || (u.roles as string[] || []).some(r => ["ADMIN","MANAGER","COACH"].includes(r)));
      }

      for (const u of targetUsers) {
        if (u.id === req.user!.userId) continue;
        await storage.createNotification({
          userId: u.id,
          type: "NOTICE_NEW",
          title: "Notice Board",
          message: body.title,
          read: false,
        });
      }

      res.status(201).json(post);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── EMAIL SEND (Gmail) ────────────────────
  app.post("/api/email/send", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD;
      if (!gmailUser || !gmailPass) {
        return res.status(500).json({ message: "Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD secrets." });
      }

      const body = z.object({
        to: z.string().min(1),
        subject: z.string().min(1).max(200),
        text: z.string().optional(),
        html: z.string().optional(),
      }).refine(d => d.text || d.html, { message: "text or html body required" })
        .parse(req.body);

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const autoCc = process.env.EMAIL_AUTO_CC || "afrocatladiesvc@gmail.com";

      const info = await transporter.sendMail({
        from: `"Afrocat Volleyball Club" <${gmailUser}>`,
        to: body.to,
        cc: autoCc,
        subject: body.subject,
        text: body.text || undefined,
        html: body.html || undefined,
      });

      res.json({ ok: true, messageId: info.messageId });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", details: e.errors });
      next(e);
    }
  });

  // ─── PUSH NOTIFICATIONS ────────────────────
  app.post("/api/push/subscribe", requireAuth, async (req, res, next) => {
    try {
      const body = z.object({
        endpoint: z.string(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }).parse(req.body);

      await storage.createPushSubscription({
        userId: req.user!.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      });

      res.json({ ok: true });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Invalid subscription data" });
      next(e);
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || "" });
  });

  // ─── CHAT DMs ────────────────────
  app.post("/api/chat/dm", requireAuth, async (req, res, next) => {
    try {
      const body = z.object({
        targetUserId: z.string().min(1),
      }).parse(req.body);

      const myId = req.user!.userId;
      const targetId = body.targetUserId;
      if (myId === targetId) return res.status(400).json({ message: "Cannot DM yourself" });

      const targetUser = await storage.getUser(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const dmRoomId = [myId, targetId].sort().join(":");
      const roomId = `dm:${dmRoomId}`;

      const existing = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.roomId, roomId))
        .limit(1);

      if (existing.length === 0) {
        const me = await storage.getUser(myId);
        await db.insert(schema.chatMessages).values({
          id: crypto.randomUUID(),
          roomId,
          senderId: myId,
          senderName: me?.fullName || "Unknown",
          senderRole: me?.role || "PLAYER",
          message: `Started a conversation`,
          sentAt: new Date(),
        });
      }

      res.json({
        roomId,
        targetUser: {
          id: targetUser.id,
          fullName: targetUser.fullName,
          role: targetUser.role,
        },
      });
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.get("/api/chat/dm-threads", requireAuth, async (req, res, next) => {
    try {
      const myId = req.user!.userId;
      const allMessages = await db.select().from(schema.chatMessages)
        .where(sql`${schema.chatMessages.roomId} LIKE 'dm:%'`);

      const myDmMessages = allMessages.filter(m =>
        m.roomId.includes(myId)
      );

      const threadMap = new Map<string, any>();
      for (const msg of myDmMessages) {
        const existing = threadMap.get(msg.roomId);
        if (!existing || new Date(msg.sentAt!).getTime() > new Date(existing.sentAt!).getTime()) {
          threadMap.set(msg.roomId, msg);
        }
      }

      const threads: any[] = [];
      for (const [roomId, lastMsg] of threadMap) {
        const parts = roomId.replace("dm:", "").split(":");
        const otherUserId = parts.find(id => id !== myId) || parts[0];
        const otherUser = await storage.getUser(otherUserId);
        threads.push({
          roomId,
          otherUser: otherUser ? { id: otherUser.id, fullName: otherUser.fullName, role: otherUser.role, photoUrl: otherUser.photoUrl } : null,
          lastMessage: lastMsg.message,
          lastMessageAt: lastMsg.sentAt,
        });
      }

      threads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      res.json(threads);
    } catch (e) { next(e); }
  });

  app.get("/api/chat/users", requireAuth, async (_req, res, next) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers.map(u => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        photoUrl: u.photoUrl,
      })));
    } catch (e) { next(e); }
  });

  // ─── COACH'S CORNER BLOG ────────────────────
  app.get("/api/coach-blog", requireAuth, async (_req, res, next) => {
    try {
      const posts = await db.select().from(schema.coachBlogPosts)
        .orderBy(desc(schema.coachBlogPosts.pinned), desc(schema.coachBlogPosts.publishedAt));
      res.json(posts);
    } catch (e) { next(e); }
  });

  app.get("/api/coach-blog/:id", requireAuth, async (req, res, next) => {
    try {
      const [post] = await db.select().from(schema.coachBlogPosts)
        .where(eq(schema.coachBlogPosts.id, req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      const comments = await db.select().from(schema.coachBlogComments)
        .where(eq(schema.coachBlogComments.postId, req.params.id))
        .orderBy(schema.coachBlogComments.createdAt);
      res.json({ ...post, comments });
    } catch (e) { next(e); }
  });

  app.post("/api/coach-blog", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        category: z.string().default("GENERAL"),
        tags: z.array(z.string()).optional(),
        pinned: z.boolean().optional(),
      }).parse(req.body);

      const author = await storage.getUser(req.user!.userId);
      const [post] = await db.insert(schema.coachBlogPosts).values({
        title: body.title,
        body: body.body,
        category: body.category,
        tags: body.tags || [],
        pinned: body.pinned || false,
        authorId: req.user!.userId,
        authorName: author?.fullName || "Coach",
      }).returning();
      res.status(201).json(post);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: e.errors });
      next(e);
    }
  });

  app.patch("/api/coach-blog/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = z.object({
        title: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        pinned: z.boolean().optional(),
      }).parse(req.body);

      const [existing] = await db.select().from(schema.coachBlogPosts)
        .where(eq(schema.coachBlogPosts.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Post not found" });

      if (existing.authorId !== req.user!.userId && !req.user!.isSuperAdmin) {
        const userRoles = req.user!.roles || [req.user!.role];
        if (!userRoles.includes("ADMIN") && !userRoles.includes("MANAGER")) {
          return res.status(403).json({ message: "Can only edit your own posts" });
        }
      }

      const [updated] = await db.update(schema.coachBlogPosts)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(schema.coachBlogPosts.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.delete("/api/coach-blog/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const [existing] = await db.select().from(schema.coachBlogPosts)
        .where(eq(schema.coachBlogPosts.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Post not found" });

      if (existing.authorId !== req.user!.userId && !req.user!.isSuperAdmin) {
        const userRoles = req.user!.roles || [req.user!.role];
        if (!userRoles.includes("ADMIN") && !userRoles.includes("MANAGER")) {
          return res.status(403).json({ message: "Can only delete your own posts" });
        }
      }

      await db.delete(schema.coachBlogComments).where(eq(schema.coachBlogComments.postId, req.params.id));
      await db.delete(schema.coachBlogPosts).where(eq(schema.coachBlogPosts.id, req.params.id));
      res.status(204).send();
    } catch (e) { next(e); }
  });

  app.post("/api/coach-blog/:id/comments", requireAuth, async (req, res, next) => {
    try {
      const body = z.object({ body: z.string().min(1) }).parse(req.body);
      const [post] = await db.select().from(schema.coachBlogPosts)
        .where(eq(schema.coachBlogPosts.id, req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });

      const author = await storage.getUser(req.user!.userId);
      const [comment] = await db.insert(schema.coachBlogComments).values({
        postId: req.params.id,
        authorId: req.user!.userId,
        authorName: author?.fullName || "Unknown",
        authorRole: req.user!.role,
        body: body.body,
      }).returning();
      res.status(201).json(comment);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ message: "Validation error" });
      next(e);
    }
  });

  app.delete("/api/coach-blog/:postId/comments/:commentId", requireAuth, async (req, res, next) => {
    try {
      const [comment] = await db.select().from(schema.coachBlogComments)
        .where(eq(schema.coachBlogComments.id, req.params.commentId));
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      if (comment.authorId !== req.user!.userId && !req.user!.isSuperAdmin) {
        const userRoles = req.user!.roles || [req.user!.role];
        if (!userRoles.includes("ADMIN") && !userRoles.includes("MANAGER")) {
          return res.status(403).json({ message: "Can only delete your own comments" });
        }
      }

      await db.delete(schema.coachBlogComments).where(eq(schema.coachBlogComments.id, req.params.commentId));
      res.status(204).send();
    } catch (e) { next(e); }
  });

  // ─── TRAINING SESSIONS CRUD ──────────
  app.get("/api/training/sessions", requireAuth, async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string | undefined;
      const sessions = await storage.getTrainingSessions(teamId);
      res.json(sessions);
    } catch (e) { next(e); }
  });

  app.post("/api/training/sessions", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { teamId, dateTimeStart, dateTimeEnd, venue, notes, targetGender } = req.body;
      if (!teamId || !dateTimeStart) return res.status(400).json({ error: "teamId and dateTimeStart required" });
      let gender = targetGender;
      if (!gender) {
        const dayOfWeek = new Date(dateTimeStart).getDay();
        if (dayOfWeek === 1 || dayOfWeek === 3) gender = "FEMALE";
        else if (dayOfWeek === 2 || dayOfWeek === 4) gender = "MALE";
        else gender = "ALL";
      }
      const session = await storage.createTrainingSession({
        teamId, dateTimeStart, dateTimeEnd: dateTimeEnd || null, venue: venue || null,
        notes: notes || null, targetGender: gender, createdBy: req.user!.userId,
      });
      res.status(201).json(session);
    } catch (e) { next(e); }
  });

  app.patch("/api/training/sessions/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const updated = await storage.updateTrainingSession(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Session not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/training/sessions/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      await storage.deleteTrainingSession(req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  // ─── PLAYER EXCUSE / LATE REQUESTS ──────────
  app.post("/api/attendance/excuse-request", requireAuth, async (req, res, next) => {
    try {
      const { sessionId, sessionDate, excuseType, reason } = req.body;
      if (!reason) return res.status(400).json({ error: "reason required" });
      if (!sessionId && !sessionDate) return res.status(400).json({ error: "sessionId or sessionDate required" });
      const playerId = req.user!.playerId;
      if (!playerId) return res.status(400).json({ error: "No player profile linked" });
      const request = await storage.createPlayerExcuseRequest({
        playerId, sessionId: sessionId || null, sessionDate: sessionDate || null,
        excuseType: excuseType || "EXCUSE", reason, status: "PENDING",
        reviewedBy: null, reviewNote: null,
      });
      res.status(201).json(request);
    } catch (e) { next(e); }
  });

  app.get("/api/attendance/excuse-requests", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (_req, res, next) => {
    try {
      const requests = await storage.getPlayerExcuseRequests();
      const enriched = await Promise.all(requests.map(async (r: any) => {
        const player = await storage.getPlayer(r.playerId);
        return { ...r, playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown", playerTeamId: player?.teamId };
      }));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/attendance/excuse-requests/mine", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.user!.playerId;
      if (!playerId) return res.json([]);
      const requests = await storage.getPlayerExcuseRequests(playerId);
      res.json(requests);
    } catch (e) { next(e); }
  });

  app.post("/api/attendance/excuse-requests/:id/approve", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerExcuseRequest(req.params.id, {
        status: "APPROVED", reviewedBy: req.user!.userId, reviewNote: req.body.reviewNote || null,
      });
      if (!updated) return res.status(404).json({ error: "Request not found" });
      if (updated.sessionId) {
        const records = await storage.getAttendanceRecords(updated.sessionId);
        const record = records.find((r: any) => r.playerId === updated.playerId);
        if (record) {
          const newStatus = updated.excuseType === "EXCUSE" ? "EXCUSED" : "LATE";
          await storage.updateAttendanceRecord(record.id, { status: newStatus as any, reason: updated.reason || undefined });
        }
      }
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/attendance/excuse-requests/:id/reject", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerExcuseRequest(req.params.id, {
        status: "REJECTED", reviewedBy: req.user!.userId, reviewNote: req.body.reviewNote || null,
      });
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── FINANCE: FEE CONFIG ──────────
  app.get("/api/finance/fee-config", requireAuth, async (_req, res, next) => {
    try {
      const configs = await storage.getFeeConfigs();
      const result: Record<string, string> = {};
      configs.forEach((c: any) => { result[c.key] = c.value; });
      res.json(result);
    } catch (e) { next(e); }
  });

  app.put("/api/finance/fee-config", requireAuth, requireRole(["ADMIN","FINANCE"]), async (req, res, next) => {
    try {
      const entries = req.body;
      for (const [key, value] of Object.entries(entries)) {
        await storage.upsertFeeConfig(key, String(value), req.user!.userId);
      }
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // ─── FINANCE: PLAYER PAYMENTS ──────────
  app.get("/api/finance/payments", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.query.playerId as string | undefined;
      const payments = await storage.getPlayerPayments(playerId);
      const enriched = await Promise.all(payments.map(async (p: any) => {
        const player = await storage.getPlayer(p.playerId);
        return { ...p, playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown" };
      }));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/payment", requireAuth, async (req, res, next) => {
    try {
      const { playerId, feeType, amount, paidBy, paidByName, reference, paymentDate } = req.body;
      if (!playerId || !feeType || !amount || !paymentDate) {
        return res.status(400).json({ error: "playerId, feeType, amount, paymentDate required" });
      }
      const payment = await storage.createPlayerPayment({
        playerId, feeType, amount: parseInt(amount), paidBy: paidBy || "PLAYER",
        paidByName: paidByName || null, reference: reference || null, paymentDate,
        status: "PENDING_APPROVAL", approvedBy: null, createdBy: req.user!.userId,
      });
      res.status(201).json(payment);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/payment/:id/approve", requireAuth, requireRole(["ADMIN","FINANCE"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerPayment(req.params.id, {
        status: "APPROVED", approvedBy: req.user!.userId, approvedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Payment not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/payment/:id/reject", requireAuth, requireRole(["ADMIN","FINANCE"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerPayment(req.params.id, {
        status: "REJECTED", approvedBy: req.user!.userId, approvedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Payment not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── FINANCE: PLAYER EXPENSES ──────────
  app.get("/api/finance/expenses", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.query.playerId as string | undefined;
      const expenses = await storage.getPlayerExpenses(playerId);
      const enriched = await Promise.all(expenses.map(async (e: any) => {
        const player = await storage.getPlayer(e.playerId);
        return { ...e, playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown" };
      }));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/expense", requireAuth, requireRole(["ADMIN","FINANCE","MANAGER"]), async (req, res, next) => {
    try {
      const { playerId, amount, paidBy, paidByName, reason, notes, expenseDate } = req.body;
      if (!playerId || !amount || !reason || !expenseDate) {
        return res.status(400).json({ error: "playerId, amount, reason, expenseDate required" });
      }
      const expense = await storage.createPlayerExpense({
        playerId, amount: parseInt(amount), paidBy: paidBy || "CLUB",
        paidByName: paidByName || null, reason, notes: notes || null, expenseDate,
        status: "PENDING_APPROVAL", approvedBy: null, createdBy: req.user!.userId,
      });
      res.status(201).json(expense);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/expense/:id/approve", requireAuth, requireRole(["ADMIN","FINANCE"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerExpense(req.params.id, {
        status: "APPROVED", approvedBy: req.user!.userId, approvedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Expense not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.post("/api/finance/expense/:id/reject", requireAuth, requireRole(["ADMIN","FINANCE"]), async (req, res, next) => {
    try {
      const updated = await storage.updatePlayerExpense(req.params.id, {
        status: "REJECTED", approvedBy: req.user!.userId, approvedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Expense not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ─── FINANCE: PLAYER SUMMARY + VALUE + EXIT ──────────
  app.get("/api/finance/player/:playerId", requireAuth, async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const payments = await storage.getPlayerPayments(req.params.playerId);
      const expenses = await storage.getPlayerExpenses(req.params.playerId);
      const configs = await storage.getFeeConfigs();
      const feeMap: Record<string, number> = {};
      configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

      const membershipFee = player.employmentClass === "WORKING"
        ? (feeMap.membershipFeeWorking || 800)
        : (feeMap.membershipFeeNonWorking || 400);
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

      const playerValue = totalPaidByOthers + clubExpenses;

      res.json({
        playerId: req.params.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        employmentClass: player.employmentClass || "NON_WORKING",
        fees: { membership: membershipFee, development: developmentFee, resource: resourceFee, league: leagueFee, total: totalFeesDue },
        totalPaid, totalPaidByPlayer, totalPaidByOthers, outstanding,
        clubExpenses, playerValue,
        payments, expenses,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/finance/player/:playerId/exit-statement", requireAuth, requireRole(["ADMIN","FINANCE","MANAGER"]), async (req, res, next) => {
    try {
      const player = await storage.getPlayer(req.params.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const payments = await storage.getPlayerPayments(req.params.playerId);
      const expenses = await storage.getPlayerExpenses(req.params.playerId);
      const configs = await storage.getFeeConfigs();
      const feeMap: Record<string, number> = {};
      configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

      const membershipFee = player.employmentClass === "WORKING" ? (feeMap.membershipFeeWorking || 800) : (feeMap.membershipFeeNonWorking || 400);
      const developmentFee = feeMap.developmentFee || 2500;
      const resourceFee = feeMap.resourceFee || 1500;
      const leagueFee = feeMap.leagueAffiliationFeePerPlayer || 0;
      const totalFeesDue = membershipFee + developmentFee + resourceFee + leagueFee;

      const approvedPayments = payments.filter((p: any) => p.status === "APPROVED");
      const totalPaidByPlayer = approvedPayments.filter((p: any) => p.paidBy === "PLAYER").reduce((s: number, p: any) => s + p.amount, 0);
      const approvedExpenses = expenses.filter((e: any) => e.status === "APPROVED");
      const clubContribution = approvedPayments.filter((p: any) => p.paidBy !== "PLAYER").reduce((s: number, p: any) => s + p.amount, 0) +
        approvedExpenses.filter((e: any) => e.paidBy !== "PLAYER").reduce((s: number, e: any) => s + e.amount, 0);

      res.json({
        playerName: `${player.firstName} ${player.lastName}`,
        totalFeesDue, totalPaidByPlayer, clubContribution,
        outstandingBalance: Math.max(0, totalFeesDue - totalPaidByPlayer - clubContribution),
        statement: `Exit statement for ${player.firstName} ${player.lastName}: Total fees due N$${totalFeesDue}, Paid by player N$${totalPaidByPlayer}, Club contribution N$${clubContribution}.`,
      });
    } catch (e) { next(e); }
  });

  // ─── FINANCE: SUMMARY REPORT ──────────
  app.get("/api/finance/summary", requireAuth, requireRole(["ADMIN","FINANCE","MANAGER"]), async (req, res, next) => {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      let payments = await storage.getPlayerPayments();
      let expenses = await storage.getPlayerExpenses();
      if (from) {
        payments = payments.filter((p: any) => p.paymentDate >= from);
        expenses = expenses.filter((e: any) => e.expenseDate >= from);
      }
      if (to) {
        payments = payments.filter((p: any) => p.paymentDate <= to);
        expenses = expenses.filter((e: any) => e.expenseDate <= to);
      }
      const approvedPayments = payments.filter((p: any) => p.status === "APPROVED");
      const approvedExpenses = expenses.filter((e: any) => e.status === "APPROVED");
      const totalReceived = approvedPayments.reduce((s: number, p: any) => s + p.amount, 0);
      const totalExpenses = approvedExpenses.reduce((s: number, e: any) => s + e.amount, 0);
      const pendingPayments = payments.filter((p: any) => p.status === "PENDING_APPROVAL").reduce((s: number, p: any) => s + p.amount, 0);
      res.json({ totalReceived, totalExpenses, netPosition: totalReceived - totalExpenses, pendingPayments, paymentCount: approvedPayments.length, expenseCount: approvedExpenses.length });
    } catch (e) { next(e); }
  });

  app.get("/api/finance/income-statement", requireAuth, requireRole(["ADMIN","FINANCE","MANAGER"]), async (req, res, next) => {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      let payments = await storage.getPlayerPayments();
      let expenses = await storage.getPlayerExpenses();
      let txns = await storage.getFinanceTxns();

      if (from) {
        payments = payments.filter((p: any) => p.paymentDate >= from);
        expenses = expenses.filter((e: any) => e.expenseDate >= from);
        txns = txns.filter((t: any) => t.txnDate >= from);
      }
      if (to) {
        payments = payments.filter((p: any) => p.paymentDate <= to);
        expenses = expenses.filter((e: any) => e.expenseDate <= to);
        txns = txns.filter((t: any) => t.txnDate <= to);
      }

      const approvedPayments = payments.filter((p: any) => p.status === "APPROVED");
      const approvedExpenses = expenses.filter((e: any) => e.status === "APPROVED");
      const incomeTxns = txns.filter((t: any) => t.type === "INCOME");
      const expenseTxns = txns.filter((t: any) => t.type === "EXPENSE");

      // Income by fee type from player payments
      const playerIncomeByType: Record<string, number> = {};
      for (const p of approvedPayments) {
        playerIncomeByType[p.feeType] = (playerIncomeByType[p.feeType] || 0) + Number(p.amount);
      }

      // Other income by category from txns
      const otherIncomeByCategory: Record<string, number> = {};
      for (const t of incomeTxns) {
        const cat = t.category || "Other";
        otherIncomeByCategory[cat] = (otherIncomeByCategory[cat] || 0) + Number(t.amount);
      }

      // Player expenses by reason
      const playerExpenseByReason: Record<string, number> = {};
      for (const e of approvedExpenses) {
        playerExpenseByReason[e.reason] = (playerExpenseByReason[e.reason] || 0) + Number(e.amount);
      }

      // Other expenses by category from txns
      const otherExpenseByCategory: Record<string, number> = {};
      for (const t of expenseTxns) {
        const cat = t.category || "Other";
        otherExpenseByCategory[cat] = (otherExpenseByCategory[cat] || 0) + Number(t.amount);
      }

      const totalPlayerIncome = Object.values(playerIncomeByType).reduce((a, b) => a + b, 0);
      const totalOtherIncome = Object.values(otherIncomeByCategory).reduce((a, b) => a + b, 0);
      const totalIncome = totalPlayerIncome + totalOtherIncome;

      const totalPlayerExpenses = Object.values(playerExpenseByReason).reduce((a, b) => a + b, 0);
      const totalOtherExpenses = Object.values(otherExpenseByCategory).reduce((a, b) => a + b, 0);
      const totalExpenses = totalPlayerExpenses + totalOtherExpenses;

      res.json({
        period: { from: from || null, to: to || null },
        income: {
          playerFees: Object.entries(playerIncomeByType).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount),
          otherIncome: Object.entries(otherIncomeByCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          totalPlayerIncome,
          totalOtherIncome,
          totalIncome,
        },
        expenses: {
          playerExpenses: Object.entries(playerExpenseByReason).map(([reason, amount]) => ({ reason, amount })).sort((a, b) => b.amount - a.amount),
          otherExpenses: Object.entries(otherExpenseByCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          totalPlayerExpenses,
          totalOtherExpenses,
          totalExpenses,
        },
        netSurplus: totalIncome - totalExpenses,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/finance/balance-sheet", requireAuth, requireRole(["ADMIN","FINANCE","MANAGER"]), async (req, res, next) => {
    try {
      const payments = await storage.getPlayerPayments();
      const expenses = await storage.getPlayerExpenses();
      const txns = await storage.getFinanceTxns();

      const approvedPayments = payments.filter((p: any) => p.status === "APPROVED");
      const approvedExpenses = expenses.filter((e: any) => e.status === "APPROVED");
      const pendingPayments = payments.filter((p: any) => p.status === "PENDING_APPROVAL");
      const incomeTxns = txns.filter((t: any) => t.type === "INCOME");
      const expenseTxns = txns.filter((t: any) => t.type === "EXPENSE");

      const totalCashFromFees = approvedPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const totalOtherIncome = incomeTxns.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalCash = totalCashFromFees + totalOtherIncome;

      const totalOutstandingReceivables = pendingPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

      const totalPlayerExpenses = approvedExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const totalOtherExpenses = expenseTxns.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalLiabilities = totalPlayerExpenses + totalOtherExpenses;

      const netEquity = totalCash - totalLiabilities;

      res.json({
        assets: {
          cashAndBank: totalCash,
          cashFromFees: totalCashFromFees,
          otherIncome: totalOtherIncome,
          outstandingReceivables: totalOutstandingReceivables,
          totalAssets: totalCash + totalOutstandingReceivables,
        },
        liabilities: {
          playerExpenses: totalPlayerExpenses,
          otherExpenses: totalOtherExpenses,
          totalLiabilities,
        },
        equity: {
          retainedSurplus: netEquity,
          totalEquity: netEquity,
        },
        balanceCheck: (totalCash + totalOutstandingReceivables) - (totalLiabilities + netEquity),
      });
    } catch (e) { next(e); }
  });

  // ─── COACH: MY TEAMS + TRENDS ──────────
  app.get("/api/coach/my-teams", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const allAssignments = await db.select().from(schema.coachAssignments).where(and(eq(schema.coachAssignments.coachUserId, userId), eq(schema.coachAssignments.active, true)));
      const teams = await storage.getTeams();
      const myTeams = teams.filter((t: any) => allAssignments.some((a: any) => a.teamId === t.id));
      res.json(myTeams);
    } catch (e) { next(e); }
  });

  app.get("/api/coach/attendance-trends", requireAuth, async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ error: "teamId required" });
      const sessions = await storage.getAttendanceSessions();
      const teamSessions = sessions.filter((s: any) => s.teamId === teamId);
      const weeks: Record<string, { total: number; present: number }> = {};
      const playerAttendance: Record<string, { name: string; total: number; present: number }> = {};

      for (const sess of teamSessions) {
        const records = await storage.getAttendanceRecords(sess.id);
        const weekKey = sess.sessionDate?.substring(0, 7) || "unknown";
        if (!weeks[weekKey]) weeks[weekKey] = { total: 0, present: 0 };
        weeks[weekKey].total += records.length;
        weeks[weekKey].present += records.filter((r: any) => r.status === "PRESENT" || r.status === "LATE").length;

        for (const r of records) {
          if (!playerAttendance[r.playerId]) {
            const player = await storage.getPlayer(r.playerId);
            playerAttendance[r.playerId] = { name: player ? `${player.firstName} ${player.lastName}` : "Unknown", total: 0, present: 0 };
          }
          playerAttendance[r.playerId].total++;
          if (r.status === "PRESENT" || r.status === "LATE") playerAttendance[r.playerId].present++;
        }
      }

      const monthlyTrends = Object.entries(weeks).map(([month, data]) => ({
        month, percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      })).sort((a, b) => a.month.localeCompare(b.month));

      const playerList = Object.entries(playerAttendance).map(([id, data]) => ({
        playerId: id, playerName: data.name, percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0, sessions: data.total,
      })).sort((a, b) => b.percentage - a.percentage);

      res.json({ monthlyTrends, topAttendees: playerList.slice(0, 5), lowAttendees: playerList.slice(-5).reverse() });
    } catch (e) { next(e); }
  });

  app.get("/api/coach/performance-trends", requireAuth, async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ error: "teamId required" });
      const matches = await storage.getMatches();
      const teamMatches = matches
        .filter((m: any) => m.teamId === teamId && m.statsEntered)
        .sort((a: any, b: any) => (b.matchDate || "").localeCompare(a.matchDate || ""))
        .slice(0, 5);

      const trends = [];
      for (const match of teamMatches) {
        const stats = await storage.getStatsByMatch(match.id);
        // Use actual schema fields: servesAce, servesError, receivePerfect, receiveError, spikesKill, spikesError
        const serveAces    = stats.reduce((s: number, st: any) => s + (st.servesAce   || 0), 0);
        const serveErrors  = stats.reduce((s: number, st: any) => s + (st.servesError || 0), 0);
        const totalServes  = serveAces + serveErrors;
        const recvPerfect  = stats.reduce((s: number, st: any) => s + (st.receivePerfect || 0), 0);
        const recvErrors   = stats.reduce((s: number, st: any) => s + (st.receiveError   || 0), 0);
        const totalRecvs   = recvPerfect + recvErrors;
        const kills        = stats.reduce((s: number, st: any) => s + (st.spikesKill  || 0), 0);
        const atkErrors    = stats.reduce((s: number, st: any) => s + (st.spikesError || 0), 0);
        const totalAttacks = kills + atkErrors;

        trends.push({
          matchId: match.id,
          opponent: match.opponent || "Unknown",
          date: match.matchDate,
          serveErrorPct:     totalServes  > 0 ? Math.round((serveErrors / totalServes)  * 100) : 0,
          receivePerfectPct: totalRecvs   > 0 ? Math.round((recvPerfect / totalRecvs)   * 100) : 0,
          attackEfficiency:  totalAttacks > 0 ? Math.round(((kills - atkErrors) / totalAttacks) * 100) : 0,
        });
      }

      res.json(trends.reverse());
    } catch (e) { next(e); }
  });

  // ─── FINANCE: PLAYER OUTSTANDING FEES (for player dashboard) ──────────
  app.get("/api/finance/my-outstanding", requireAuth, async (req, res, next) => {
    try {
      const playerId = req.user!.playerId;
      if (!playerId) return res.json({ outstanding: [], totalDue: 0 });
      const player = await storage.getPlayer(playerId);
      if (!player) return res.json({ outstanding: [], totalDue: 0 });
      const payments = await storage.getPlayerPayments(playerId);
      const configs = await storage.getFeeConfigs();
      const feeMap: Record<string, number> = {};
      configs.forEach((c: any) => { feeMap[c.key] = parseInt(c.value) || 0; });

      const membershipFee = player.employmentClass === "WORKING" ? (feeMap.membershipFeeWorking || 800) : (feeMap.membershipFeeNonWorking || 400);
      const developmentFee = feeMap.developmentFee || 2500;
      const resourceFee = feeMap.resourceFee || 1500;
      const leagueFee = feeMap.leagueAffiliationFeePerPlayer || 0;

      const approved = payments.filter((p: any) => p.status === "APPROVED");
      const paidByType: Record<string, number> = {};
      approved.forEach((p: any) => { paidByType[p.feeType] = (paidByType[p.feeType] || 0) + p.amount; });

      const outstanding: { feeType: string; due: number; paid: number; remaining: number }[] = [];
      const feeTypes = [
        { type: "MEMBERSHIP", due: membershipFee },
        { type: "DEVELOPMENT", due: developmentFee },
        { type: "RESOURCE", due: resourceFee },
        { type: "LEAGUE_AFFILIATION", due: leagueFee },
      ];
      for (const ft of feeTypes) {
        const paid = paidByType[ft.type] || 0;
        if (paid < ft.due) outstanding.push({ feeType: ft.type, due: ft.due, paid, remaining: ft.due - paid });
      }

      res.json({ outstanding, totalDue: outstanding.reduce((s, o) => s + o.remaining, 0) });
    } catch (e) { next(e); }
  });

  app.get("/api/interviews", requireAuth, async (_req, res, next) => {
    try {
      const interviews = await storage.getPlayerInterviews();
      const enriched = await Promise.all(interviews.map(async (i: any) => {
        const player = await storage.getPlayer(i.playerId);
        const publisher = await storage.getUser(i.publishedBy);
        return {
          ...i,
          playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
          playerJerseyNo: player?.jerseyNo,
          playerPosition: player?.position,
          playerPhotoUrl: player?.photoUrl,
          playerTeamId: player?.teamId,
          publisherName: publisher?.fullName || "Unknown",
        };
      }));
      res.json(enriched);
    } catch (e) { next(e); }
  });

  app.get("/api/interviews/:id", requireAuth, async (req, res, next) => {
    try {
      const interview = await storage.getPlayerInterview(req.params.id);
      if (!interview) return res.status(404).json({ error: "Interview not found" });
      const player = await storage.getPlayer(interview.playerId);
      const publisher = await storage.getUser(interview.publishedBy);
      res.json({
        ...interview,
        playerName: player ? `${player.firstName} ${player.lastName}` : "Unknown",
        playerJerseyNo: player?.jerseyNo,
        playerPosition: player?.position,
        playerPhotoUrl: player?.photoUrl,
        playerTeamId: player?.teamId,
        publisherName: publisher?.fullName || "Unknown",
      });
    } catch (e) { next(e); }
  });

  app.post("/api/interviews", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const body = req.body;
      if (!body.playerId || !body.title || !body.questions?.length || !body.answers?.length) {
        return res.status(400).json({ error: "playerId, title, questions[], answers[] required" });
      }
      if (body.questions.length !== body.answers.length) {
        return res.status(400).json({ error: "questions and answers must have same length" });
      }
      const format = body.format || "TEXT";
      if (format === "VIDEO" && !body.videoUrl?.trim()) {
        return res.status(400).json({ error: "videoUrl required for VIDEO format" });
      }
      const interview = await storage.createPlayerInterview({
        playerId: body.playerId,
        title: body.title,
        format,
        videoUrl: body.videoUrl || null,
        thumbnailUrl: body.thumbnailUrl || null,
        questions: body.questions,
        answers: body.answers,
        tags: body.tags || [],
        featured: body.featured || false,
        publishedBy: req.user!.userId,
      });
      res.status(201).json(interview);
    } catch (e) { next(e); }
  });

  app.patch("/api/interviews/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const interview = await storage.getPlayerInterview(req.params.id);
      if (!interview) return res.status(404).json({ error: "Interview not found" });
      const { publishedBy, publishedAt, id, ...body } = req.body;
      const allowedFields: Record<string, any> = {};
      if (body.title !== undefined) allowedFields.title = body.title;
      if (body.playerId !== undefined) allowedFields.playerId = body.playerId;
      if (body.format !== undefined) allowedFields.format = body.format;
      if (body.videoUrl !== undefined) allowedFields.videoUrl = body.videoUrl;
      if (body.thumbnailUrl !== undefined) allowedFields.thumbnailUrl = body.thumbnailUrl;
      if (body.tags !== undefined) allowedFields.tags = body.tags;
      if (body.featured !== undefined) allowedFields.featured = body.featured;
      if (body.questions !== undefined && body.answers !== undefined) {
        if (!Array.isArray(body.questions) || !Array.isArray(body.answers) || body.questions.length !== body.answers.length) {
          return res.status(400).json({ error: "questions and answers must be arrays of same length" });
        }
        allowedFields.questions = body.questions;
        allowedFields.answers = body.answers;
      }
      if (allowedFields.format === "VIDEO" && !allowedFields.videoUrl && !interview.videoUrl) {
        return res.status(400).json({ error: "videoUrl required for VIDEO format" });
      }
      const updated = await storage.updatePlayerInterview(req.params.id, allowedFields);
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/interviews/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const interview = await storage.getPlayerInterview(req.params.id);
      if (!interview) return res.status(404).json({ error: "Interview not found" });
      await storage.deletePlayerInterview(req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  app.get("/api/members/search", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase();
      const roleFilter = req.query.role as string;
      const teamFilter = req.query.teamId as string;
      const allUsers = await db.select().from(schema.users);
      const allPlayers = await db.select().from(schema.players);
      const allTeams = await db.select().from(schema.teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));
      const playerByUser = Object.fromEntries(allPlayers.map(p => [p.userId, p]));
      let results = allUsers.map(u => {
        const p = playerByUser[u.id];
        return {
          id: u.id, userId: u.id, fullName: u.fullName, email: u.email, role: u.role,
          teamName: p ? teamMap[p.teamId || ""] || "" : "",
          teamId: p?.teamId || "",
        };
      });
      if (q) results = results.filter(r => r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q));
      if (roleFilter) results = results.filter(r => r.role === roleFilter);
      if (teamFilter) results = results.filter(r => r.teamId === teamFilter);
      res.json(results);
    } catch (e) { next(e); }
  });

  app.get("/api/admin/member-extract", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase();
      const roleFilter = req.query.role as string;
      const teamFilter = req.query.teamId as string;
      const genderFilter = req.query.gender as string;
      const statusFilter = req.query.status as string;

      const allUsers = await db.select().from(schema.users);
      const allPlayers = await db.select().from(schema.players);
      const allTeams = await db.select().from(schema.teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));
      // Link: users.playerId → players.id  (players table has NO userId field)
      const playerById = Object.fromEntries(allPlayers.map(p => [p.id, p]));

      let results = allUsers
        .map(u => {
          const p = u.playerId ? playerById[u.playerId] : null;
          return {
            id: u.id,
            fullName: u.fullName || "",
            email: u.email || "",
            role: u.role || "",
            accountStatus: u.accountStatus || "",
            createdAt: u.createdAt,
            // Player profile fields
            teamId: p?.teamId || "",
            teamName: p ? teamMap[p.teamId || ""] || "" : "",
            gender: p?.gender || "",
            dob: p?.dob || "",
            phone: p?.phone || "",
            position: p?.position || "",
            jerseyNo: p?.jerseyNo ?? null,
            heightCm: p?.heightCm ?? null,
            weightKg: p?.weightKg ?? null,
            homeAddress: p?.homeAddress || "",
            town: p?.town || "",
            region: p?.region || "",
            nationality: p?.nationality || "",
            idNumber: p?.idNumber || "",
            bloodGroup: p?.bloodGroup || "",
            allergies: p?.allergies || "",
            medicalNotes: p?.medicalNotes || "",
            // Next of kin
            nextOfKinName: p?.nextOfKinName || "",
            nextOfKinRelation: p?.nextOfKinRelation || "",
            nextOfKinPhone: p?.nextOfKinPhone || "",
            nextOfKinAddress: p?.nextOfKinAddress || "",
            // Emergency contact
            emergencyContactName: p?.emergencyContactName || "",
            emergencyContactPhone: p?.emergencyContactPhone || "",
            // Player status fields
            playerStatus: p?.status || "",
            eligibilityStatus: p?.eligibilityStatus || "",
            photoUrl: p?.photoUrl || "",
            // Registration form extra fields
            membershipNo: p?.membershipNo || "",
            maritalStatus: p?.maritalStatus || "",
            facebookName: p?.facebookName || "",
            joinedAt: p?.joinedAt || "",
            employmentClass: p?.employmentClass || "",
            registrationStatus: p?.registrationStatus || "",
            registrationNotes: p?.registrationNotes || "",
            memberCategory: (p as any)?.memberCategory || "",
          };
        });

      if (q) results = results.filter(r =>
        r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q) || (r.idNumber || "").toLowerCase().includes(q));
      if (roleFilter) results = results.filter(r => r.role === roleFilter);
      if (teamFilter) results = results.filter(r => r.teamId === teamFilter);
      if (genderFilter) results = results.filter(r => r.gender?.toLowerCase() === genderFilter.toLowerCase());
      if (statusFilter) results = results.filter(r => r.accountStatus === statusFilter);

      results.sort((a, b) => a.fullName.localeCompare(b.fullName));
      res.json(results);
    } catch (e) { next(e); }
  });

  app.get("/api/officials", requireAuth, requireRole(["ADMIN","MANAGER"]), async (_req, res, next) => {
    try {
      const users = await db.select().from(schema.users);
      const assignments = await storage.getOfficialTeamAssignments();
      const teams = await db.select().from(schema.teams);
      const teamOfficialRows = await db.select().from(schema.teamOfficials);
      const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

      const officialUserIds = [...new Set(assignments.map(a => a.officialUserId))];
      const staffRoles = ["ADMIN","MANAGER","COACH","MEDICAL","FINANCE","STATISTICIAN","CAPTAIN"];
      const officials = users.filter(u => {
        const userRoles = (u.roles && u.roles.length > 0) ? u.roles : [u.role];
        return userRoles.some((r: string) => staffRoles.includes(r)) || officialUserIds.includes(u.id);
      });

      const teamOfficialsByTeam: Record<string, any[]> = {};
      teamOfficialRows.forEach(to => {
        if (!teamOfficialsByTeam[to.teamId]) teamOfficialsByTeam[to.teamId] = [];
        teamOfficialsByTeam[to.teamId].push(to);
      });

      const result = officials.map(o => {
        const adminAssignments = assignments.filter(a => a.officialUserId === o.id).map(a => ({
          ...a, teamName: teamMap[a.teamId] || "", source: "ADMIN_ASSIGNMENT" as const,
        }));

        const userRoles = (o.roles && o.roles.length > 0) ? o.roles : [o.role];
        const registrationRoles = userRoles.filter((r: string) => staffRoles.includes(r)).map((r: string) => ({
          id: `reg-${o.id}-${r}`, officialRole: r, teamName: "All Teams",
          teamId: null, source: "REGISTRATION" as const, active: true,
        }));

        const o2bisRoles: any[] = [];
        const nameLC = (o.fullName || "").toLowerCase();
        teamOfficialRows.forEach(to => {
          if ((to.name || "").toLowerCase() === nameLC) {
            const roleMap: Record<string, string> = {
              HEAD_COACH: "HEAD COACH", ASSISTANT_COACH: "ASSISTANT COACH",
              TRAINER: "TRAINER", TEAM_MANAGER: "TEAM MANAGER",
              PHYSIOTHERAPIST: "PHYSIOTHERAPIST", MEDIC: "MEDIC",
            };
            o2bisRoles.push({
              id: `o2bis-${to.id}`, officialRole: roleMap[to.role] || to.role,
              teamName: teamMap[to.teamId] || "", teamId: to.teamId,
              source: "O2BIS_TEAM_OFFICIAL" as const, active: true,
            });
          }
        });

        return {
          id: o.id, fullName: o.fullName, email: o.email, phone: o.phone || null,
          role: o.role, roles: o.roles, gender: o.gender || null,
          registrationRoles,
          adminAssignments,
          o2bisRoles,
          allRoles: [...registrationRoles, ...adminAssignments, ...o2bisRoles],
        };
      });
      res.json(result);
    } catch (e) { next(e); }
  });

  app.post("/api/officials/assign", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      const { officialUserId, teamId, officialRole } = req.body;
      if (!officialUserId || !teamId || !officialRole) return res.status(400).json({ error: "officialUserId, teamId, officialRole required" });
      const created = await storage.createOfficialTeamAssignment({ officialUserId, teamId, officialRole, active: true });
      res.status(201).json(created);
    } catch (e) { next(e); }
  });

  app.delete("/api/officials/assign/:id", requireAuth, requireRole(["ADMIN","MANAGER"]), async (req, res, next) => {
    try {
      await storage.deleteOfficialTeamAssignment(req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  app.get("/api/tactic-boards", requireAuth, async (req, res, next) => {
    try {
      const teamId = req.query.teamId as string;
      const boards = await storage.getCoachTacticBoards(req.user!.userId, teamId || undefined);
      res.json(boards);
    } catch (e) { next(e); }
  });

  app.post("/api/tactic-boards", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { title, boardJson, teamId } = req.body;
      if (!title || !boardJson) return res.status(400).json({ error: "title and boardJson required" });
      const created = await storage.createCoachTacticBoard({ coachUserId: req.user!.userId, title, boardJson: typeof boardJson === "string" ? boardJson : JSON.stringify(boardJson), teamId: teamId || null });
      res.json(created);
    } catch (e) { next(e); }
  });

  app.patch("/api/tactic-boards/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      const { title, boardJson } = req.body;
      const updated = await storage.updateCoachTacticBoard(req.params.id, { title, boardJson: typeof boardJson === "string" ? boardJson : JSON.stringify(boardJson) });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/tactic-boards/:id", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (req, res, next) => {
    try {
      await storage.deleteCoachTacticBoard(req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return httpServer;
}
