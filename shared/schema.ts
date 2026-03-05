import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, decimal, date, timestamp, jsonb, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "COACH", "STATISTICIAN", "FINANCE", "MEDICAL", "PLAYER"]);
export const teamCategoryEnum = pgEnum("team_category", ["MEN", "WOMEN", "VETERANS", "JUNIORS"]);
export const playerStatusEnum = pgEnum("player_status", ["ACTIVE", "SUSPENDED", "INJURED", "SUSPENDED_CONTRACT"]);
export const matchResultEnum = pgEnum("match_result", ["W", "L"]);
export const matchStatusEnum = pgEnum("match_status", ["SCHEDULED", "UPCOMING", "LIVE", "PAST_NO_SCORE", "PLAYED", "CANCELLED"]);
export const scoreSourceEnum = pgEnum("score_source", ["NONE", "MANUAL", "STATS"]);
export const sessionTypeEnum = pgEnum("session_type", ["TRAINING", "MATCH", "GYM"]);
export const attendanceSessionStatusEnum = pgEnum("attendance_session_status", ["OPEN", "CLOSED"]);
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
export const transportBenefitTypeEnum = pgEnum("transport_benefit_type", ["TRAINING_TRANSPORT", "MATCH_TRANSPORT", "OTHER"]);
export const transportFrequencyEnum = pgEnum("transport_frequency", ["ONE_TIME", "WEEKLY", "MONTHLY", "PER_TRIP"]);
export const nvfFeeTypeEnum = pgEnum("nvf_fee_type", ["INTER_ASSOCIATION_TRANSFER_FEE", "OTHER"]);
export const transferCaseStatusEnum = pgEnum("transfer_case_status", ["DRAFT", "CONFIRMED", "PAID", "CLOSED"]);
export const accountStatusEnum = pgEnum("account_status", ["PENDING_APPROVAL", "ACTIVE", "REJECTED", "SUSPENDED"]);
export const resetMethodEnum = pgEnum("reset_method", ["TEMP_PASSWORD", "ONE_TIME_LINK"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDING", "APPROVED", "REJECTED"]);
export const registrationStatusEnum = pgEnum("registration_status", ["PENDING_APPROVAL", "APPROVED", "REJECTED"]);
export const mediaVisibilityEnum = pgEnum("media_visibility", ["PUBLIC", "TEAM_ONLY", "PRIVATE"]);
export const mediaStatusEnum = pgEnum("media_status", ["PENDING_REVIEW", "APPROVED", "REJECTED"]);
export const tagTypeEnum = pgEnum("tag_type", ["PLAYER", "COACH", "ADMIN", "STAFF"]);
export const mediaTagRequestStatusEnum = pgEnum("media_tag_request_status", ["PENDING", "APPROVED", "REJECTED"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PLAYER"),
  teamId: varchar("team_id", { length: 36 }),
  playerId: varchar("player_id", { length: 36 }),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  verificationToken: text("verification_token"),
  verificationTokenExp: timestamp("verification_token_exp"),
  accountStatus: accountStatusEnum("account_status").notNull().default("PENDING_APPROVAL"),
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetTokenExp: timestamp("password_reset_token_exp"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  roles: text("roles").array().default(sql`ARRAY[]::text[]`),
  lastPasswordResetAt: timestamp("last_password_reset_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: teamCategoryEnum("category").notNull(),
  season: text("season").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerDocumentTypeEnum = pgEnum("player_document_type", ["PLAYER_PROFILE", "CONTRACT", "MEDICAL_CLEARANCE"]);

export const players = pgTable("players", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  gender: text("gender"),
  dob: text("dob"),
  jerseyNo: integer("jersey_no"),
  phone: text("phone"),
  email: text("player_email"),
  homeAddress: text("home_address"),
  town: text("town"),
  region: text("region"),
  nationality: text("nationality"),
  idNumber: text("id_number"),
  nextOfKinName: text("next_of_kin_name"),
  nextOfKinRelation: text("next_of_kin_relation"),
  nextOfKinPhone: text("next_of_kin_phone"),
  nextOfKinAddress: text("next_of_kin_address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  medicalNotes: text("medical_notes"),
  allergies: text("allergies"),
  bloodGroup: text("blood_group"),
  position: text("position"),
  status: playerStatusEnum("status").notNull().default("ACTIVE"),
  eligibilityStatus: eligibilityStatusEnum("eligibility_status").notNull().default("ELIGIBLE"),
  eligibilityNotes: text("eligibility_notes"),
  photoUrl: text("photo_url"),
  requestedTeamId: varchar("requested_team_id", { length: 36 }),
  teamApprovalStatus: approvalStatusEnum("team_approval_status").notNull().default("PENDING"),
  requestedPosition: text("requested_position"),
  positionApprovalStatus: approvalStatusEnum("position_approval_status").notNull().default("PENDING"),
  requestedJerseyNo: integer("requested_jersey_no"),
  jerseyApprovalStatus: approvalStatusEnum("jersey_approval_status").notNull().default("PENDING"),
  positionApprovedByUserId: varchar("position_approved_by_user_id", { length: 36 }),
  jerseyApprovedByUserId: varchar("jersey_approved_by_user_id", { length: 36 }),
  teamApprovedByUserId: varchar("team_approved_by_user_id", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  registrationStatus: registrationStatusEnum("registration_status").notNull().default("PENDING_APPROVAL"),
  registrationNotes: text("registration_notes"),
  membershipNo: text("membership_no"),
  maritalStatus: text("marital_status"),
  facebookName: text("facebook_name"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  lastWeightUpdatedAt: timestamp("last_weight_updated_at"),
  employmentClass: text("employment_class").default("NON_WORKING"),
  joinedAt: text("joined_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerDocuments = pgTable("player_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  documentType: playerDocumentTypeEnum("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  opponent: text("opponent").notNull(),
  matchDate: text("match_date").notNull(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  venue: text("venue").notNull(),
  competition: text("competition").notNull(),
  result: matchResultEnum("result"),
  setsFor: integer("sets_for").default(0),
  setsAgainst: integer("sets_against").default(0),
  status: matchStatusEnum("status").notNull().default("SCHEDULED"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  scoreSource: scoreSourceEnum("score_source").notNull().default("NONE"),
  scoreLocked: boolean("score_locked").notNull().default(false),
  statsEntered: boolean("stats_entered").notNull().default(false),
  lastScoreUpdatedBy: varchar("last_score_updated_by", { length: 36 }),
  lastScoreUpdatedAt: timestamp("last_score_updated_at"),
  notes: text("notes"),
  round: text("round"),
  liveHomePoints: integer("live_home_points").default(0),
  liveAwayPoints: integer("live_away_points").default(0),
  homeSetsWon: integer("home_sets_won").default(0),
  awaySetsWon: integer("away_sets_won").default(0),
  currentSetNumber: integer("current_set_number").default(1),
  scorerUserId: varchar("scorer_user_id", { length: 36 }),
  scoringStartedAt: timestamp("scoring_started_at"),
  scoringEndedAt: timestamp("scoring_ended_at"),
  matchDurationMinutes: integer("match_duration_minutes"),
  bestOf: integer("best_of"),
  playerOfMatchPlayerId: varchar("player_of_match_player_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchStaffAssignments = pgTable("match_staff_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  headCoachUserId: varchar("head_coach_user_id", { length: 36 }).notNull(),
  assistantCoachUserId: varchar("assistant_coach_user_id", { length: 36 }),
  medicUserId: varchar("medic_user_id", { length: 36 }),
  teamManagerUserId: varchar("team_manager_user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMatchStaffAssignmentSchema = createInsertSchema(matchStaffAssignments).omit({ id: true, createdAt: true });
export type InsertMatchStaffAssignment = z.infer<typeof insertMatchStaffAssignmentSchema>;
export type MatchStaffAssignment = typeof matchStaffAssignments.$inferSelect;

export const matchSetStats = pgTable("match_set_stats", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  sets: jsonb("sets").notNull().$type<Array<{ homePoints: number; awayPoints: number }>>(),
  enteredBy: varchar("entered_by", { length: 36 }).notNull(),
  enteredAt: timestamp("entered_at").defaultNow(),
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
  status: attendanceSessionStatusEnum("session_status").notNull().default("OPEN"),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  status: attendanceStatusEnum("status").notNull(),
  reason: text("reason"),
  selfMarked: boolean("self_marked").notNull().default(false),
  confirmedByUserId: varchar("confirmed_by_user_id", { length: 36 }),
  confirmedAt: timestamp("confirmed_at"),
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
  isPrimary: boolean("is_primary").notNull().default(false),
  isTemporary: boolean("is_temporary").notNull().default(false),
  tempReason: text("temp_reason"),
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
  releaseFee: real("release_fee"),
  membershipFeeRequired: real("membership_fee_required"),
  membershipFeePaid: real("membership_fee_paid"),
  developmentFeeRequired: real("development_fee_required"),
  developmentFeePaid: real("development_fee_paid"),
  currency: text("currency").default("NAD"),
  obligations: text("obligations"),
  contractFileUrl: text("contract_file_url"),
  status: contractStatusEnum("status").notNull().default("DRAFT"),
  signedByPlayer: boolean("signed_by_player").default(false),
  playerSignedAt: timestamp("player_signed_at"),
  approvedByUserId: varchar("approved_by_user_id", { length: 36 }),
  createdByUserId: varchar("created_by_user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractIssuedItems = pgTable("contract_issued_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id", { length: 36 }).notNull(),
  itemName: text("item_name").notNull(),
  size: text("size"),
  quantity: integer("quantity").notNull().default(1),
  unitValue: real("unit_value").notNull().default(0),
  totalValue: real("total_value").notNull().default(0),
  dateIssued: text("date_issued").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractTransportBenefits = pgTable("contract_transport_benefits", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id", { length: 36 }).notNull(),
  benefitType: transportBenefitTypeEnum("benefit_type").notNull(),
  dateFrom: text("date_from").notNull(),
  dateTo: text("date_to"),
  amount: real("amount").notNull(),
  frequency: transportFrequencyEnum("frequency").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nvfTransferFeeSchedules = pgTable("nvf_transfer_fee_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  feeType: nvfFeeTypeEnum("fee_type").notNull(),
  amount: real("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerTransferCases = pgTable("player_transfer_cases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  fromClub: text("from_club").notNull(),
  toClub: text("to_club").notNull(),
  transferDate: text("transfer_date").notNull(),
  nvfYear: integer("nvf_year").notNull(),
  contractId: varchar("contract_id", { length: 36 }),
  nvfFee: real("nvf_fee").notNull().default(0),
  releaseFee: real("release_fee").notNull().default(0),
  itemsValue: real("items_value").notNull().default(0),
  transportValue: real("transport_value").notNull().default(0),
  membershipOutstanding: real("membership_outstanding").notNull().default(0),
  developmentOutstanding: real("development_outstanding").notNull().default(0),
  totalDue: real("total_due").notNull().default(0),
  breakdownJson: text("breakdown_json").notNull(),
  status: transferCaseStatusEnum("status").notNull().default("DRAFT"),
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
  isLibero: boolean("is_libero").default(false),
  isCaptain: boolean("is_captain").default(false),
  matchPosition: text("match_position"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerReports = pgTable("player_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  reportType: text("report_type").notNull(),
  pdfUrl: text("pdf_url"),
  generatedDate: text("generated_date").notNull(),
});

export const systemSecuritySettings = pgTable("system_security_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default("security"),
  requireEmailVerification: boolean("require_email_verification").notNull().default(true),
  requireAdminApproval: boolean("require_admin_approval").notNull().default(true),
  autoApproveTeamRequests: boolean("auto_approve_team_requests").notNull().default(false),
  autoApprovePosition: boolean("auto_approve_position").notNull().default(false),
  autoApproveJersey: boolean("auto_approve_jersey").notNull().default(false),
  allowedEmailDomains: text("allowed_email_domains"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetAudits = pgTable("password_reset_audits", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id", { length: 36 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
  resetMethod: resetMethodEnum("reset_method").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shopItems = pgTable("shop_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  price: real("price"),
  currency: text("currency").default("NAD"),
  imageUrl: text("image_url"),
  category: text("category"),
  isPublic: boolean("is_public").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaPosts = pgTable("media_posts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title"),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  visibility: mediaVisibilityEnum("visibility").notNull().default("PUBLIC"),
  status: mediaStatusEnum("status").notNull().default("PENDING_REVIEW"),
  uploadedByUserId: varchar("uploaded_by_user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaTags = pgTable("media_tags", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  mediaId: varchar("media_id", { length: 36 }).notNull(),
  taggedUserId: varchar("tagged_user_id", { length: 36 }),
  taggedPlayerId: varchar("tagged_player_id", { length: 36 }),
  tagType: tagTypeEnum("tag_type").notNull().default("PLAYER"),
  createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaTagRequests = pgTable("media_tag_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  mediaId: varchar("media_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  status: mediaTagRequestStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShopItemSchema = createInsertSchema(shopItems).omit({ id: true, createdAt: true });
export const insertMediaPostSchema = createInsertSchema(mediaPosts).omit({ id: true, createdAt: true });
export const insertMediaTagSchema = createInsertSchema(mediaTags).omit({ id: true, createdAt: true });
export const insertMediaTagRequestSchema = createInsertSchema(mediaTagRequests).omit({ id: true, createdAt: true });

export const insertPasswordResetAuditSchema = createInsertSchema(passwordResetAudits).omit({ id: true, createdAt: true });
export const insertSystemSecuritySettingsSchema = createInsertSchema(systemSecuritySettings).omit({ createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertPlayerMatchStatSchema = createInsertSchema(playerMatchStats).omit({ id: true });
export const insertMatchSetStatSchema = createInsertSchema(matchSetStats).omit({ id: true, enteredAt: true });
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
export const insertContractIssuedItemSchema = createInsertSchema(contractIssuedItems).omit({ id: true, createdAt: true });
export const insertContractTransportBenefitSchema = createInsertSchema(contractTransportBenefits).omit({ id: true, createdAt: true });
export const insertNvfTransferFeeScheduleSchema = createInsertSchema(nvfTransferFeeSchedules).omit({ id: true, createdAt: true });
export const insertPlayerTransferCaseSchema = createInsertSchema(playerTransferCases).omit({ id: true, createdAt: true });
export const insertTeamOfficialSchema = createInsertSchema(teamOfficials).omit({ id: true, createdAt: true });
export const insertMatchDocumentSchema = createInsertSchema(matchDocuments).omit({ id: true, createdAt: true });
export const insertMatchSquadSchema = createInsertSchema(matchSquads).omit({ id: true, createdAt: true });
export const insertMatchSquadEntrySchema = createInsertSchema(matchSquadEntries).omit({ id: true, createdAt: true });
export const insertPlayerReportSchema = createInsertSchema(playerReports).omit({ id: true });
export const insertPlayerDocumentSchema = createInsertSchema(playerDocuments).omit({ id: true, createdAt: true });

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
export type InsertMatchSetStat = z.infer<typeof insertMatchSetStatSchema>;
export type MatchSetStat = typeof matchSetStats.$inferSelect;
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
export type InsertContractIssuedItem = z.infer<typeof insertContractIssuedItemSchema>;
export type ContractIssuedItem = typeof contractIssuedItems.$inferSelect;
export type InsertContractTransportBenefit = z.infer<typeof insertContractTransportBenefitSchema>;
export type ContractTransportBenefit = typeof contractTransportBenefits.$inferSelect;
export type InsertNvfTransferFeeSchedule = z.infer<typeof insertNvfTransferFeeScheduleSchema>;
export type NvfTransferFeeSchedule = typeof nvfTransferFeeSchedules.$inferSelect;
export type InsertPlayerTransferCase = z.infer<typeof insertPlayerTransferCaseSchema>;
export type PlayerTransferCase = typeof playerTransferCases.$inferSelect;
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
export type InsertPlayerDocument = z.infer<typeof insertPlayerDocumentSchema>;
export type PlayerDocument = typeof playerDocuments.$inferSelect;
export type InsertSystemSecuritySettings = z.infer<typeof insertSystemSecuritySettingsSchema>;
export type SystemSecuritySettings = typeof systemSecuritySettings.$inferSelect;
export type InsertPasswordResetAudit = z.infer<typeof insertPasswordResetAuditSchema>;
export type PasswordResetAudit = typeof passwordResetAudits.$inferSelect;
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItems.$inferSelect;
export type InsertMediaPost = z.infer<typeof insertMediaPostSchema>;
export type MediaPost = typeof mediaPosts.$inferSelect;
export type InsertMediaTag = z.infer<typeof insertMediaTagSchema>;
export type MediaTag = typeof mediaTags.$inferSelect;
export type InsertMediaTagRequest = z.infer<typeof insertMediaTagRequestSchema>;
export type MediaTagRequest = typeof mediaTagRequests.$inferSelect;

export const contributionStatusEnum = pgEnum("contribution_status", ["PAID", "DUE", "PARTIAL"]);

export const contractContributions = pgTable("contract_contributions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  itemName: text("item_name").notNull(),
  amount: real("amount").notNull().default(0),
  status: contributionStatusEnum("status").notNull().default("DUE"),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fundRaisingActivities = pgTable("fund_raising_activities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull().default(0),
  season: text("season"),
  active: boolean("active").notNull().default(true),
  createdByUserId: varchar("created_by_user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerFundRaisingContributions = pgTable("player_fund_raising_contributions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  amount: real("amount").notNull().default(0),
  contributionDate: text("contribution_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractContributionSchema = createInsertSchema(contractContributions).omit({ id: true, createdAt: true });
export const insertFundRaisingActivitySchema = createInsertSchema(fundRaisingActivities).omit({ id: true, createdAt: true });
export const insertPlayerFundRaisingContributionSchema = createInsertSchema(playerFundRaisingContributions).omit({ id: true, createdAt: true });

export type InsertContractContribution = z.infer<typeof insertContractContributionSchema>;
export type ContractContribution = typeof contractContributions.$inferSelect;
export type InsertFundRaisingActivity = z.infer<typeof insertFundRaisingActivitySchema>;
export type FundRaisingActivity = typeof fundRaisingActivities.$inferSelect;
export type InsertPlayerFundRaisingContribution = z.infer<typeof insertPlayerFundRaisingContributionSchema>;
export type PlayerFundRaisingContribution = typeof playerFundRaisingContributions.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }),
  playerId: varchar("player_id", { length: 36 }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const contractAcceptedByEnum = pgEnum("contract_accepted_by", ["SELF", "GUARDIAN"]);

export const contractAcceptances = pgTable("contract_acceptances", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }),
  contractKey: text("contract_key").notNull(),
  contractVersionHash: text("contract_version_hash").notNull(),
  sport: text("sport").notNull().default("VOLLEYBALL"),
  isMinor: boolean("is_minor").notNull().default(false),
  acceptedBy: contractAcceptedByEnum("accepted_by").notNull(),
  accepterFullName: text("accepter_full_name").notNull(),
  guardianIdNumber: text("guardian_id_number"),
  guardianPhoneNumber: text("guardian_phone_number"),
  acceptedAt: timestamp("accepted_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signedPdfUrl: text("signed_pdf_url"),
});

export const insertContractAcceptanceSchema = createInsertSchema(contractAcceptances).omit({ id: true, acceptedAt: true });
export type InsertContractAcceptance = z.infer<typeof insertContractAcceptanceSchema>;
export type ContractAcceptance = typeof contractAcceptances.$inferSelect;

export const matchEvents = pgTable("match_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  action: text("action").notNull(),
  outcome: text("outcome").notNull(),
  rotation: integer("rotation"),
  subType: text("sub_type"),
  zone: text("zone"),
  tempo: text("tempo"),
  outcomeDetail: text("outcome_detail"),
  errorCategory: text("error_category").default("NONE"),
  errorType: text("error_type"),
  pressureFlag: boolean("pressure_flag").default(false),
  fatigueFlag: boolean("fatigue_flag").default(false),
  tacticalIntention: text("tactical_intention"),
  notes: text("notes"),
  setNumber: integer("set_number"),
  combinationType: text("combination_type"),
  pointWonByTeamId: varchar("point_won_by_team_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by", { length: 36 }),
});

export const insertMatchEventSchema = createInsertSchema(matchEvents).omit({ id: true, createdAt: true });
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEvents.$inferSelect;

export const playerUpdateRequests = pgTable("player_update_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  patchJson: jsonb("patch_json").notNull(),
  status: text("status").notNull().default("PENDING"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submittedBy: varchar("submitted_by", { length: 36 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 36 }),
  reviewNote: text("review_note"),
});

export const insertPlayerUpdateRequestSchema = createInsertSchema(playerUpdateRequests).omit({ id: true, submittedAt: true });
export type InsertPlayerUpdateRequest = z.infer<typeof insertPlayerUpdateRequestSchema>;
export type PlayerUpdateRequest = typeof playerUpdateRequests.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  roomId: text("room_id").notNull(),
  senderId: varchar("sender_id", { length: 36 }).notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, sentAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const noticeBoardPosts = pgTable("notice_board_posts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("ALL"),
  teamId: varchar("team_id", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNoticeBoardPostSchema = createInsertSchema(noticeBoardPosts).omit({ id: true, createdAt: true });
export type InsertNoticeBoardPost = z.infer<typeof insertNoticeBoardPostSchema>;
export type NoticeBoardPost = typeof noticeBoardPosts.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const coachBlogPosts = pgTable("coach_blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("GENERAL"),
  tags: text("tags").array(),
  authorId: varchar("author_id").notNull(),
  authorName: text("author_name").notNull(),
  pinned: boolean("pinned").default(false),
  publishedAt: timestamp("published_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const coachBlogComments = pgTable("coach_blog_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  authorId: varchar("author_id").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCoachBlogPostSchema = createInsertSchema(coachBlogPosts).omit({ id: true, publishedAt: true, updatedAt: true });
export type InsertCoachBlogPost = z.infer<typeof insertCoachBlogPostSchema>;
export type CoachBlogPost = typeof coachBlogPosts.$inferSelect;

export const insertCoachBlogCommentSchema = createInsertSchema(coachBlogComments).omit({ id: true, createdAt: true });
export type InsertCoachBlogComment = z.infer<typeof insertCoachBlogCommentSchema>;
export type CoachBlogComment = typeof coachBlogComments.$inferSelect;

export const playerInterviews = pgTable("player_interviews", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  format: text("format").notNull().default("TEXT"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  questions: text("questions").array().notNull(),
  answers: text("answers").array().notNull(),
  tags: text("tags").array(),
  featured: boolean("featured").default(false),
  publishedBy: varchar("published_by", { length: 36 }).notNull(),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const insertPlayerInterviewSchema = createInsertSchema(playerInterviews).omit({ id: true, publishedAt: true });
export type InsertPlayerInterview = z.infer<typeof insertPlayerInterviewSchema>;
export type PlayerInterview = typeof playerInterviews.$inferSelect;

export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  dateTimeStart: text("date_time_start").notNull(),
  dateTimeEnd: text("date_time_end"),
  venue: text("venue"),
  notes: text("notes"),
  targetGender: text("target_gender").notNull().default("ALL"),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).omit({ id: true, createdAt: true });
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type TrainingSession = typeof trainingSessions.$inferSelect;

export const playerExcuseRequests = pgTable("player_excuse_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  sessionDate: text("session_date"),
  excuseType: text("excuse_type").notNull().default("EXCUSE"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"),
  reviewedBy: varchar("reviewed_by", { length: 36 }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPlayerExcuseRequestSchema = createInsertSchema(playerExcuseRequests).omit({ id: true, createdAt: true });
export type InsertPlayerExcuseRequest = z.infer<typeof insertPlayerExcuseRequestSchema>;
export type PlayerExcuseRequest = typeof playerExcuseRequests.$inferSelect;

export const playerPayments = pgTable("player_payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  feeType: text("fee_type").notNull(),
  amount: integer("amount").notNull(),
  paidBy: text("paid_by").notNull().default("PLAYER"),
  paidByName: text("paid_by_name"),
  reference: text("reference"),
  paymentDate: text("payment_date").notNull(),
  status: text("status").notNull().default("PENDING_APPROVAL"),
  approvedBy: varchar("approved_by", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPlayerPaymentSchema = createInsertSchema(playerPayments).omit({ id: true, approvedAt: true, createdAt: true });
export type InsertPlayerPayment = z.infer<typeof insertPlayerPaymentSchema>;
export type PlayerPayment = typeof playerPayments.$inferSelect;

export const playerExpenses = pgTable("player_expenses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id", { length: 36 }).notNull(),
  amount: integer("amount").notNull(),
  paidBy: text("paid_by").notNull().default("CLUB"),
  paidByName: text("paid_by_name"),
  reason: text("reason").notNull(),
  notes: text("notes"),
  expenseDate: text("expense_date").notNull(),
  status: text("status").notNull().default("PENDING_APPROVAL"),
  approvedBy: varchar("approved_by", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPlayerExpenseSchema = createInsertSchema(playerExpenses).omit({ id: true, approvedAt: true, createdAt: true });
export type InsertPlayerExpense = z.infer<typeof insertPlayerExpenseSchema>;
export type PlayerExpense = typeof playerExpenses.$inferSelect;

export const feeConfig = pgTable("fee_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedBy: varchar("updated_by", { length: 36 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertFeeConfigSchema = createInsertSchema(feeConfig).omit({ id: true, updatedAt: true });
export type InsertFeeConfig = z.infer<typeof insertFeeConfigSchema>;
export type FeeConfig = typeof feeConfig.$inferSelect;

export const officialTeamAssignments = pgTable("official_team_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  officialUserId: varchar("official_user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  officialRole: text("official_role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertOfficialTeamAssignmentSchema = createInsertSchema(officialTeamAssignments).omit({ id: true, createdAt: true });
export type InsertOfficialTeamAssignment = z.infer<typeof insertOfficialTeamAssignmentSchema>;
export type OfficialTeamAssignment = typeof officialTeamAssignments.$inferSelect;

export const coachTacticBoards = pgTable("coach_tactic_boards", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  coachUserId: varchar("coach_user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }),
  title: text("title").notNull(),
  boardJson: text("board_json").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCoachTacticBoardSchema = createInsertSchema(coachTacticBoards).omit({ id: true, createdAt: true });
export type InsertCoachTacticBoard = z.infer<typeof insertCoachTacticBoardSchema>;
export type CoachTacticBoard = typeof coachTacticBoards.$inferSelect;
