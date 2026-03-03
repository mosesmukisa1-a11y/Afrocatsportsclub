import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { hashPassword, comparePassword, signToken, requireAuth, requireRole } from "./auth";
import { z } from "zod";
import crypto from "crypto";
import cron from "node-cron";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
        phone: z.string().optional(),
        dob: z.string().optional(),
        nationality: z.string().optional(),
        idNumber: z.string().optional(),
        photo: z.string().optional(),
        gender: z.enum(["MALE", "FEMALE"]).optional(),
        heightCm: z.number().int().min(50).max(250).optional(),
        weightKg: z.number().int().min(20).max(200).optional(),
        role: z.enum(["PLAYER", "COACH", "STATISTICIAN", "MEDICAL", "FINANCE"]).optional().default("PLAYER"),
        requestedTeamId: z.string().optional(),
        requestedPosition: z.enum(["SETTER", "LIBERO", "MIDDLE", "OUTSIDE", "OPPOSITE"]).optional(),
        requestedJerseyNo: z.number().int().min(1).max(99).optional(),
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

      const existing = await storage.getAttendanceRecordBySessionAndPlayer(req.params.id, req.user!.playerId);
      if (existing) return res.status(400).json({ message: "Already checked in" });

      const now = new Date();
      const sessionDate = new Date(session.sessionDate);
      const isLate = now.getTime() - sessionDate.getTime() > 15 * 60 * 1000;

      const record = await storage.createAttendanceRecord({
        sessionId: req.params.id,
        playerId: req.user!.playerId,
        status: isLate ? "LATE" : "PRESENT",
        selfMarked: true,
      });
      res.status(201).json(record);
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
      const pending: any[] = [];
      for (const session of sessions) {
        const records = await storage.getAttendanceRecords(session.id);
        const unconfirmed = records.filter(r => r.selfMarked && !r.confirmedByUserId);
        if (unconfirmed.length > 0) {
          pending.push({ session, records: unconfirmed });
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
  app.get("/api/players", requireAuth, requireRole(["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL"]), async (_req, res, next) => {
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
    try { res.json(await storage.getMatches()); } catch (e) { next(e); }
  });

  app.get("/api/matches/upcoming", requireAuth, async (_req, res, next) => {
    try {
      const all = await storage.getMatches();
      const now = new Date();
      const upcoming = all
        .filter(m => m.status === "UPCOMING" && m.startTime && new Date(m.startTime) > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
      res.json(upcoming);
    } catch (e) { next(e); }
  });

  app.get("/api/matches/played", requireAuth, async (_req, res, next) => {
    try {
      const all = await storage.getMatches();
      const played = all
        .filter(m => m.status === "PLAYED")
        .sort((a, b) => new Date(b.startTime || b.matchDate).getTime() - new Date(a.startTime || a.matchDate).getTime());
      res.json(played);
    } catch (e) { next(e); }
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
        startTime: z.string().optional(),
        venue: z.string(), competition: z.string(),
        result: z.enum(["W","L"]).optional().nullable(),
        setsFor: z.number().optional(), setsAgainst: z.number().optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);

      const startTimeParsed = body.startTime ? new Date(body.startTime) : null;
      const isFuture = startTimeParsed ? startTimeParsed > new Date() : false;

      const matchData: any = {
        ...body,
        startTime: startTimeParsed,
        status: isFuture ? "UPCOMING" : "UPCOMING",
        homeScore: isFuture ? null : (body.setsFor ?? null),
        awayScore: isFuture ? null : (body.setsAgainst ?? null),
        scoreSource: "NONE",
        scoreLocked: false,
        statsEntered: false,
      };

      const match = await storage.createMatch(matchData);
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
  app.get("/api/staff-eligible-users", requireAuth, requireRole(["ADMIN","MANAGER","COACH"]), async (_req, res, next) => {
    try {
      const users = await storage.getUsers();
      const eligible = users.map((u: any) => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        roles: u.roles,
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

  app.post("/api/matches/:id/set-stats", requireAuth, requireRole(["ADMIN","MANAGER","COACH","STATISTICIAN"]), async (req, res, next) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const body = z.object({
        sets: z.array(z.object({
          homePoints: z.number(),
          awayPoints: z.number(),
        })),
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
      await storage.updateMatch(req.params.id, {
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
      } as any);

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

  app.post("/api/stats/match/:matchId", requireAuth, requireRole(["ADMIN","MANAGER","STATISTICIAN","COACH","PLAYER"]), async (req, res, next) => {
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

      await storage.updateMatch(matchId, {
        statsEntered: true,
        lastScoreUpdatedBy: req.user!.userId,
        lastScoreUpdatedAt: new Date(),
      } as any);

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

      let playerList;
      if (body.selectedPlayerIds && body.selectedPlayerIds.length > 0) {
        const allPlayers = await storage.getPlayersByTeam(body.teamId);
        playerList = allPlayers.filter(p => body.selectedPlayerIds!.includes(p.id));
      } else {
        const allPlayers = await storage.getPlayersByTeam(body.teamId);
        playerList = allPlayers.filter(p => p.status === "ACTIVE");
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
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const match = await storage.getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const skipMissing = req.query.skipMissing === "true";
      const team = await storage.getTeam(match.teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const staffRows = await db.select().from(schema.matchStaffAssignments)
        .where(eq(schema.matchStaffAssignments.matchId, req.params.matchId));
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
      const squad = await storage.getMatchSquad(req.params.matchId, match.teamId);
      if (squad) {
        const entries = await storage.getMatchSquadEntries(squad.id);
        const allPlayers = await storage.getPlayersByTeam(match.teamId);
        const captainIds = await getCaptainPlayerIds();
        players = entries.map((e: any) => {
          const p = allPlayers.find(pl => pl.id === e.playerId);
          return p ? {
            jerseyNo: e.jerseyNo ?? p.jerseyNo ?? "",
            name: `${(p.lastName || "").toUpperCase()} ${p.firstName}`,
            position: p.position || "",
            dob: p.dob || "",
            age: calculateAge(p.dob || ""),
            isCaptain: captainIds.has(p.id),
          } : null;
        }).filter(Boolean).sort((a: any, b: any) => (a.jerseyNo || 99) - (b.jerseyNo || 99));
      }

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
      if (match.round) drawText(`Round: ${match.round}`, 350, y, 10);
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
        drawText(p.name, colX[1], y, 9);
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

      const officials = await storage.getTeamOfficials(match.teamId);
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
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="O2BIS_${req.params.matchId}.pdf"`);
      res.send(Buffer.from(pdfBytes));
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
        teamName: team.name,
        gender: team.gender || "",
        generatedDate: new Date().toISOString().split("T")[0],
        headCoach: headCoachName,
        assistantCoaches,
        players: sortedPlayers.map(p => ({
          jerseyNo: p.jerseyNo,
          name: `${(p.lastName || "").toUpperCase()} ${p.firstName}`,
          position: p.position,
          dob: p.dob || "",
          age: calculateAge(p.dob || ""),
          isCaptain: captainIds.has(p.id),
          nationality: p.nationality || "Namibia",
          phone: p.phone || "",
        })),
        officials: officials.map(o => ({ role: o.role, name: o.name })),
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
        const entry = await storage.createMatchSquadEntry({
          squadId: squad.id,
          playerId: pid,
          jerseyNo: player?.jerseyNo || null,
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

        const allUsers = await storage.getUsers();
        const admins = allUsers.filter((u: any) => u.role === "ADMIN" || (u.roles && u.roles.includes("ADMIN")));
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

      const today = new Date().toISOString().split("T")[0];
      const teamMatches = player.teamId ? await storage.getMatchesByTeam(player.teamId) : [];
      const upcomingFixture = teamMatches
        .filter(m => m.matchDate >= today && !m.result)
        .sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0] || null;

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
          venue: upcomingFixture.venue,
          competition: upcomingFixture.competition,
          opponent: upcomingFixture.opponent,
          teamName: playerTeam?.name || null,
          isHome: upcomingFixture.venue === "Home",
          coachName: upcomingCoachName,
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
  const TRAINING_SCHEDULE: Record<string, number[]> = {
    MEN: [2, 4],
    WOMEN: [1, 4],
    ALL: [5],
  };

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
          playerName = player.fullName || "";
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
          fullName: player.fullName,
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
          fullName: p.fullName,
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

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Season Summary</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#0F8B7D}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0F8B7D;color:white}.record{font-size:24px;font-weight:bold;margin:10px 0}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>AFROCAT VOLLEYBALL CLUB — Season Summary</h1>`;
      html += `<p><strong>Team:</strong> ${esc(team?.name || "All Teams")} | <strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>`;
      html += `<div class="record">${wins}W - ${losses}L (${played.length > 0 ? ((wins / played.length) * 100).toFixed(0) : 0}% Win Rate)</div>`;
      html += `<p>Total Matches Played: ${played.length}</p>`;

      html += `<h2>Match Results</h2><table><tr><th>Date</th><th>Opponent</th><th>Competition</th><th>Result</th><th>Score</th></tr>`;
      for (const m of played.sort((a: any, b: any) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())) {
        html += `<tr><td>${esc(m.matchDate)}</td><td>${esc(m.opponent)}</td><td>${esc(m.competition)}</td><td style="color:${m.result === 'W' ? 'green' : 'red'};font-weight:bold">${esc(m.result)}</td><td>${m.setsFor || 0}-${m.setsAgainst || 0}</td></tr>`;
      }
      html += `</table>`;

      html += `<h2>Top Performers (by Points)</h2><table><tr><th>#</th><th>Player</th><th>Matches</th><th>Points</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th></tr>`;
      topPerformers.forEach((t: any, i: number) => {
        const p = pMap[t.playerId];
        html += `<tr><td>${i + 1}</td><td>${esc(p?.fullName || "Unknown")}</td><td>${t.matches}</td><td><strong>${t.points}</strong></td><td>${t.kills}</td><td>${t.aces}</td><td>${t.blocks}</td><td>${t.digs}</td><td>${t.assists}</td></tr>`;
      });
      html += `</table></body></html>`;

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

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Player Report — ${esc(player.fullName)}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#0F8B7D}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0F8B7D;color:white}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:15px 0}.stat-box{background:#f0f9f8;border:1px solid #0F8B7D;border-radius:8px;padding:12px;text-align:center}.stat-val{font-size:24px;font-weight:bold;color:#0F8B7D}.stat-label{font-size:11px;color:#666;text-transform:uppercase}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>AFROCAT VOLLEYBALL CLUB — Player Report</h1>`;
      html += `<h2>${esc(player.fullName)}</h2>`;
      html += `<table><tr><td><strong>Position:</strong> ${esc(player.position)}</td><td><strong>Jersey:</strong> #${player.jerseyNo || "N/A"}</td><td><strong>Team:</strong> ${esc(team?.name)}</td></tr>`;
      html += `<tr><td><strong>Age:</strong> ${age ?? "N/A"}</td><td><strong>Height:</strong> ${player.heightCm || "N/A"}cm</td><td><strong>Weight:</strong> ${player.weightKg || "N/A"}kg</td></tr>`;
      html += `<tr><td><strong>DOB:</strong> ${esc(player.dob)}</td><td><strong>Gender:</strong> ${esc(player.gender)}</td><td><strong>Nationality:</strong> ${esc(player.nationality)}</td></tr></table>`;

      html += `<h3>Career Statistics (${stats.length} Matches)</h3>`;
      html += `<div class="stat-grid">`;
      for (const [label, val] of Object.entries(totals)) {
        html += `<div class="stat-box"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
      }
      html += `</div>`;

      if (awards.length > 0) {
        html += `<h3>Awards (${awards.length})</h3><table><tr><th>Award</th><th>Month</th><th>Notes</th></tr>`;
        for (const a of awards) html += `<tr><td>${esc(a.awardType)}</td><td>${esc(a.awardMonth)}</td><td>${esc(a.notes)}</td></tr>`;
        html += `</table>`;
      }
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

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Roster — ${esc(team.name)}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#0F8B7D}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0F8B7D;color:white}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>AFROCAT VOLLEYBALL CLUB — Team Roster</h1>`;
      html += `<h2>${esc(team.name)}</h2><p>Generated: ${new Date().toLocaleDateString()} | Total Players: ${teamPlayers.length}</p>`;
      html += `<table><tr><th>#</th><th>Name</th><th>Position</th><th>Jersey</th><th>DOB</th><th>Height</th><th>Weight</th><th>Matches</th><th>Points</th></tr>`;
      playersWithStats.sort((a: any, b: any) => (a.jerseyNo || 99) - (b.jerseyNo || 99)).forEach((p: any, i: number) => {
        html += `<tr><td>${i + 1}</td><td>${esc(p.fullName)}</td><td>${esc(p.position)}</td><td>${p.jerseyNo || "—"}</td><td>${esc(p.dob)}</td><td>${p.heightCm || "—"}cm</td><td>${p.weightKg || "—"}kg</td><td>${p.matchesPlayed}</td><td>${p.totalPoints}</td></tr>`;
      });
      html += `</table></body></html>`;

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

      const playerAttendance: Record<string, { present: number; absent: number; name: string }> = {};
      for (const r of relevantRecords) {
        if (!playerAttendance[r.playerId]) playerAttendance[r.playerId] = { present: 0, absent: 0, name: pMap[r.playerId]?.fullName || "Unknown" };
        if (r.status === "PRESENT" || r.status === "LATE") playerAttendance[r.playerId].present++;
        else playerAttendance[r.playerId].absent++;
      }

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance Summary</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{color:#0F8B7D}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0F8B7D;color:white}.good{color:green}.bad{color:red}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>AFROCAT VOLLEYBALL CLUB — Attendance Summary</h1>`;
      html += `<p><strong>Team:</strong> ${esc(team?.name || "All Teams")} | <strong>Period:</strong> ${esc(startDate || "Start")} to ${esc(endDate || "Now")} | <strong>Sessions:</strong> ${filtered.length}</p>`;
      html += `<table><tr><th>#</th><th>Player</th><th>Present</th><th>Absent</th><th>Rate</th></tr>`;
      const sorted = Object.entries(playerAttendance).sort((a, b) => {
        const rateA = a[1].present / (a[1].present + a[1].absent);
        const rateB = b[1].present / (b[1].present + b[1].absent);
        return rateB - rateA;
      });
      sorted.forEach(([_id, data], i) => {
        const total = data.present + data.absent;
        const rate = total > 0 ? ((data.present / total) * 100).toFixed(0) : "0";
        html += `<tr><td>${i + 1}</td><td>${esc(data.name)}</td><td>${data.present}</td><td>${data.absent}</td><td class="${+rate >= 75 ? 'good' : 'bad'}">${rate}%</td></tr>`;
      });
      html += `</table></body></html>`;

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
        fullName: player.fullName,
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

  app.get("/api/matches/:matchId/stats-touch/init", requireAuth, async (req, res, next) => {
    try {
      const { matchId } = req.params;
      const teamId = req.query.teamId as string;
      if (!teamId) return res.status(400).json({ error: "teamId query parameter required" });

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const players = await storage.getPlayersByTeam(teamId);
      const events = await storage.getMatchEvents(matchId);

      const isLocked = !!(match.statsEntered || match.scoreLocked || match.scoreSource === "STATS");

      res.json({
        match: { ...match, isLocked },
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
      const { playerId, action, outcome, teamId } = req.body;

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

      const players = await storage.getPlayersByTeam(teamId);
      const playerBelongs = players.some((p: any) => p.id === playerId);
      if (!playerBelongs) {
        return res.status(400).json({ error: "Player does not belong to this team" });
      }

      const event = await storage.createMatchEvent({
        matchId,
        teamId,
        playerId,
        action,
        outcome,
        createdBy: (req as any).user?.id || null,
      });

      res.json({ event, match });
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

  return httpServer;
}
