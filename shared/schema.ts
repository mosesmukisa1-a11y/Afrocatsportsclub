import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "COACH", "STATISTICIAN", "FINANCE", "MEDICAL", "PLAYER"]);
export const teamCategoryEnum = pgEnum("team_category", ["MEN", "WOMEN", "VETERANS", "JUNIORS"]);
export const playerStatusEnum = pgEnum("player_status", ["ACTIVE", "SUSPENDED", "INJURED"]);
export const matchResultEnum = pgEnum("match_result", ["W", "L"]);
export const sessionTypeEnum = pgEnum("session_type", ["TRAINING", "MATCH", "GYM"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"]);
export const txnTypeEnum = pgEnum("txn_type", ["INCOME", "EXPENSE"]);
export const injurySeverityEnum = pgEnum("injury_severity", ["LOW", "MEDIUM", "HIGH"]);
export const injuryStatusEnum = pgEnum("injury_status", ["OPEN", "CLEARED"]);
export const awardTypeEnum = pgEnum("award_type", ["MVP", "MOST_IMPROVED", "BEST_SERVER", "BEST_BLOCKER", "COACH_AWARD"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PLAYER"),
  teamId: varchar("team_id", { length: 36 }),
  playerId: varchar("player_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: teamCategoryEnum("category").notNull(),
  season: text("season").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  gender: text("gender").notNull(),
  dob: text("dob"),
  jerseyNo: integer("jersey_no").notNull(),
  phone: text("phone"),
  position: text("position").notNull(),
  status: playerStatusEnum("status").notNull().default("ACTIVE"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  opponent: text("opponent").notNull(),
  matchDate: text("match_date").notNull(),
  venue: text("venue").notNull(),
  competition: text("competition").notNull(),
  result: matchResultEnum("result"),
  setsFor: integer("sets_for").default(0),
  setsAgainst: integer("sets_against").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerMatchStats = pgTable("player_match_stats", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  spikesKill: integer("spikes_kill").default(0),
  spikesError: integer("spikes_error").default(0),
  servesAce: integer("serves_ace").default(0),
  servesError: integer("serves_error").default(0),
  blocksSolo: integer("blocks_solo").default(0),
  blocksAssist: integer("blocks_assist").default(0),
  receivePerfect: integer("receive_perfect").default(0),
  receiveError: integer("receive_error").default(0),
  digs: integer("digs").default(0),
  settingAssist: integer("setting_assist").default(0),
  settingError: integer("setting_error").default(0),
  pointsTotal: integer("points_total").default(0),
  minutesPlayed: integer("minutes_played").default(0),
});

export const smartFocus = pgTable("smart_focus", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  focusAreas: jsonb("focus_areas").notNull().$type<string[]>(),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const attendanceSessions = pgTable("attendance_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  sessionDate: text("session_date").notNull(),
  sessionType: sessionTypeEnum("session_type").notNull(),
  notes: text("notes"),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  status: attendanceStatusEnum("status").notNull(),
  reason: text("reason"),
});

export const disciplineCases = pgTable("discipline_cases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  caseType: text("case_type").notNull(),
  description: text("description").notNull(),
  points: integer("points").default(0),
  actionTaken: text("action_taken"),
  caseDate: text("case_date").notNull(),
});

export const financeTxns = pgTable("finance_txns", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  txnDate: text("txn_date").notNull(),
  type: txnTypeEnum("type").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  createdByUserId: varchar("created_by_user_id", { length: 36 }),
});

export const injuries = pgTable("injuries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  injuryType: text("injury_type").notNull(),
  severity: injurySeverityEnum("severity").notNull(),
  startDate: text("start_date").notNull(),
  status: injuryStatusEnum("status").notNull().default("OPEN"),
  clearanceNote: text("clearance_note"),
  clearedByUserId: varchar("cleared_by_user_id", { length: 36 }),
});

export const scoutingReports = pgTable("scouting_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }),
  prospectName: text("prospect_name"),
  notes: text("notes").notNull(),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const awards = pgTable("awards", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  awardType: awardTypeEnum("award_type").notNull(),
  awardMonth: text("award_month").notNull(),
  notes: text("notes"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertPlayerMatchStatSchema = createInsertSchema(playerMatchStats).omit({ id: true });
export const insertSmartFocusSchema = createInsertSchema(smartFocus).omit({ id: true, generatedAt: true });
export const insertAttendanceSessionSchema = createInsertSchema(attendanceSessions).omit({ id: true });
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true });
export const insertDisciplineCaseSchema = createInsertSchema(disciplineCases).omit({ id: true });
export const insertFinanceTxnSchema = createInsertSchema(financeTxns).omit({ id: true });
export const insertInjurySchema = createInsertSchema(injuries).omit({ id: true });
export const insertScoutingReportSchema = createInsertSchema(scoutingReports).omit({ id: true, createdAt: true });
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertPlayerMatchStat = z.infer<typeof insertPlayerMatchStatSchema>;
export type PlayerMatchStat = typeof playerMatchStats.$inferSelect;
export type InsertSmartFocus = z.infer<typeof insertSmartFocusSchema>;
export type SmartFocus = typeof smartFocus.$inferSelect;
export type InsertAttendanceSession = z.infer<typeof insertAttendanceSessionSchema>;
export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertDisciplineCase = z.infer<typeof insertDisciplineCaseSchema>;
export type DisciplineCase = typeof disciplineCases.$inferSelect;
export type InsertFinanceTxn = z.infer<typeof insertFinanceTxnSchema>;
export type FinanceTxn = typeof financeTxns.$inferSelect;
export type InsertInjury = z.infer<typeof insertInjurySchema>;
export type Injury = typeof injuries.$inferSelect;
export type InsertScoutingReport = z.infer<typeof insertScoutingReportSchema>;
export type ScoutingReport = typeof scoutingReports.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type Award = typeof awards.$inferSelect;
