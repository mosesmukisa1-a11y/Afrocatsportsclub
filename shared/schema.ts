import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, decimal, date, timestamp, jsonb, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "COACH", "STATISTICIAN", "FINANCE", "MEDICAL", "PLAYER"]);
export const teamCategoryEnum = pgEnum("team_category", ["MEN", "WOMEN", "VETERANS", "JUNIORS"]);
export const playerStatusEnum = pgEnum("player_status", ["ACTIVE", "SUSPENDED", "INJURED", "SUSPENDED_CONTRACT"]);
export const matchResultEnum = pgEnum("match_result", ["W", "L"]);
export const sessionTypeEnum = pgEnum("session_type", ["TRAINING", "MATCH", "GYM"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"]);
export const txnTypeEnum = pgEnum("txn_type", ["INCOME", "EXPENSE"]);
export const injurySeverityEnum = pgEnum("injury_severity", ["LOW", "MEDIUM", "HIGH"]);
export const injuryStatusEnum = pgEnum("injury_status", ["OPEN", "CLEARED"]);
export const awardTypeEnum = pgEnum("award_type", ["MVP", "MOST_IMPROVED", "BEST_SERVER", "BEST_BLOCKER", "COACH_AWARD"]);
export const contractTypeEnum = pgEnum("contract_type", ["PERMANENT", "SEASONAL", "TRIAL", "YOUTH"]);
export const contractStatusEnum = pgEnum("contract_status", ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"]);
export const coachAssignmentRoleEnum = pgEnum("coach_assignment_role", ["HEAD_COACH", "ASSISTANT_COACH"]);
export const teamOfficialRoleEnum = pgEnum("team_official_role", ["HEAD_COACH", "ASSISTANT_COACH", "TRAINER", "TEAM_MANAGER", "PHYSIOTHERAPIST", "MEDIC"]);
export const matchDocumentTypeEnum = pgEnum("match_document_type", ["O2BIS", "MATCH_REPORT", "REFEREE_FORM", "SCOUTING_FORM"]);
export const eligibilityStatusEnum = pgEnum("eligibility_status", ["ELIGIBLE", "NOT_ELIGIBLE", "PENDING"]);

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
  eligibilityStatus: eligibilityStatusEnum("eligibility_status").notNull().default("ELIGIBLE"),
  eligibilityNotes: text("eligibility_notes"),
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

export const coachAssignments = pgTable("coach_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  coachUserId: varchar("coach_user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  assignmentRole: coachAssignmentRoleEnum("assignment_role").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  active: boolean("active").notNull().default(true),
});

export const coachPerformanceSnapshots = pgTable("coach_performance_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  coachUserId: varchar("coach_user_id", { length: 36 }).notNull(),
  matches: integer("matches").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  stars: integer("stars").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const playerContracts = pgTable("player_contracts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  contractType: contractTypeEnum("contract_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  signOnFee: real("sign_on_fee"),
  weeklyTransport: real("weekly_transport"),
  salaryAmount: real("salary_amount"),
  obligations: text("obligations"),
  contractFileUrl: text("contract_file_url"),
  status: contractStatusEnum("status").notNull().default("DRAFT"),
  approvedByUserId: varchar("approved_by_user_id", { length: 36 }),
  createdByUserId: varchar("created_by_user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamOfficials = pgTable("team_officials", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  role: teamOfficialRoleEnum("role").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchDocuments = pgTable("match_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }),
  teamId: varchar("team_id", { length: 36 }),
  documentType: matchDocumentTypeEnum("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchSquads = pgTable("match_squads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchSquadEntries = pgTable("match_squad_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  squadId: varchar("squad_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  jerseyNo: integer("jersey_no"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerReports = pgTable("player_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  reportType: text("report_type").notNull(),
  pdfUrl: text("pdf_url"),
  generatedDate: text("generated_date").notNull(),
});

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
export const insertCoachAssignmentSchema = createInsertSchema(coachAssignments).omit({ id: true });
export const insertCoachPerformanceSnapshotSchema = createInsertSchema(coachPerformanceSnapshots).omit({ id: true, updatedAt: true });
export const insertPlayerContractSchema = createInsertSchema(playerContracts).omit({ id: true, createdAt: true });
export const insertTeamOfficialSchema = createInsertSchema(teamOfficials).omit({ id: true, createdAt: true });
export const insertMatchDocumentSchema = createInsertSchema(matchDocuments).omit({ id: true, createdAt: true });
export const insertMatchSquadSchema = createInsertSchema(matchSquads).omit({ id: true, createdAt: true });
export const insertMatchSquadEntrySchema = createInsertSchema(matchSquadEntries).omit({ id: true, createdAt: true });
export const insertPlayerReportSchema = createInsertSchema(playerReports).omit({ id: true });

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
export type InsertCoachAssignment = z.infer<typeof insertCoachAssignmentSchema>;
export type CoachAssignment = typeof coachAssignments.$inferSelect;
export type InsertCoachPerformanceSnapshot = z.infer<typeof insertCoachPerformanceSnapshotSchema>;
export type CoachPerformanceSnapshot = typeof coachPerformanceSnapshots.$inferSelect;
export type InsertPlayerContract = z.infer<typeof insertPlayerContractSchema>;
export type PlayerContract = typeof playerContracts.$inferSelect;
export type InsertTeamOfficial = z.infer<typeof insertTeamOfficialSchema>;
export type TeamOfficial = typeof teamOfficials.$inferSelect;
export type InsertMatchDocument = z.infer<typeof insertMatchDocumentSchema>;
export type MatchDocument = typeof matchDocuments.$inferSelect;
export type InsertMatchSquad = z.infer<typeof insertMatchSquadSchema>;
export type MatchSquad = typeof matchSquads.$inferSelect;
export type InsertMatchSquadEntry = z.infer<typeof insertMatchSquadEntrySchema>;
export type MatchSquadEntry = typeof matchSquadEntries.$inferSelect;
export type InsertPlayerReport = z.infer<typeof insertPlayerReportSchema>;
export type PlayerReport = typeof playerReports.$inferSelect;
