CREATE TYPE "public"."account_status" AS ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."attendance_session_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');--> statement-breakpoint
CREATE TYPE "public"."award_type" AS ENUM('MVP', 'MOST_IMPROVED', 'BEST_SERVER', 'BEST_BLOCKER', 'COACH_AWARD');--> statement-breakpoint
CREATE TYPE "public"."coach_assignment_role" AS ENUM('HEAD_COACH', 'ASSISTANT_COACH');--> statement-breakpoint
CREATE TYPE "public"."contract_accepted_by" AS ENUM('SELF', 'GUARDIAN');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('PERMANENT', 'SEASONAL', 'TRIAL', 'YOUTH');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('PAID', 'DUE', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."eligibility_status" AS ENUM('ELIGIBLE', 'NOT_ELIGIBLE', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."injury_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."injury_status" AS ENUM('OPEN', 'CLEARED');--> statement-breakpoint
CREATE TYPE "public"."match_document_type" AS ENUM('O2BIS', 'MATCH_REPORT', 'REFEREE_FORM', 'SCOUTING_FORM');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('W', 'L');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'UPCOMING', 'LIVE', 'PLAYED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."media_tag_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."media_visibility" AS ENUM('PUBLIC', 'TEAM_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."nvf_fee_type" AS ENUM('INTER_ASSOCIATION_TRANSFER_FEE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."player_document_type" AS ENUM('PLAYER_PROFILE', 'CONTRACT', 'MEDICAL_CLEARANCE');--> statement-breakpoint
CREATE TYPE "public"."player_status" AS ENUM('ACTIVE', 'SUSPENDED', 'INJURED', 'SUSPENDED_CONTRACT');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."reset_method" AS ENUM('TEMP_PASSWORD', 'ONE_TIME_LINK');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'MANAGER', 'COACH', 'STATISTICIAN', 'FINANCE', 'MEDICAL', 'PLAYER');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('NONE', 'MANUAL', 'STATS');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('TRAINING', 'MATCH', 'GYM');--> statement-breakpoint
CREATE TYPE "public"."tag_type" AS ENUM('PLAYER', 'COACH', 'ADMIN', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."team_category" AS ENUM('MEN', 'WOMEN', 'VETERANS', 'JUNIORS');--> statement-breakpoint
CREATE TYPE "public"."team_official_role" AS ENUM('HEAD_COACH', 'ASSISTANT_COACH', 'TRAINER', 'TEAM_MANAGER', 'PHYSIOTHERAPIST', 'MEDIC');--> statement-breakpoint
CREATE TYPE "public"."transfer_case_status" AS ENUM('DRAFT', 'CONFIRMED', 'PAID', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."transport_benefit_type" AS ENUM('TRAINING_TRANSPORT', 'MATCH_TRANSPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."transport_frequency" AS ENUM('ONE_TIME', 'WEEKLY', 'MONTHLY', 'PER_TRIP');--> statement-breakpoint
CREATE TYPE "public"."txn_type" AS ENUM('INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"status" "attendance_status" NOT NULL,
	"reason" text,
	"self_marked" boolean DEFAULT false NOT NULL,
	"confirmed_by_user_id" varchar(36),
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"session_date" text NOT NULL,
	"session_type" "session_type" NOT NULL,
	"notes" text,
	"session_status" "attendance_session_status" DEFAULT 'OPEN' NOT NULL,
	"locked_at" timestamp,
	"locked_by" varchar(36),
	"created_by" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"award_type" "award_type" NOT NULL,
	"award_month" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "coach_assignments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_user_id" varchar(36) NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"assignment_role" "coach_assignment_role" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_temporary" boolean DEFAULT false NOT NULL,
	"temp_reason" text
);
--> statement-breakpoint
CREATE TABLE "coach_performance_snapshots" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_user_id" varchar(36) NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"win_rate" real DEFAULT 0 NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_acceptances" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"player_id" varchar(36),
	"contract_key" text NOT NULL,
	"contract_version_hash" text NOT NULL,
	"sport" text DEFAULT 'VOLLEYBALL' NOT NULL,
	"is_minor" boolean DEFAULT false NOT NULL,
	"accepted_by" "contract_accepted_by" NOT NULL,
	"accepter_full_name" text NOT NULL,
	"guardian_id_number" text,
	"guardian_phone_number" text,
	"accepted_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "contract_contributions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"item_name" text NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"status" "contribution_status" DEFAULT 'DUE' NOT NULL,
	"due_date" text,
	"paid_date" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_issued_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(36) NOT NULL,
	"item_name" text NOT NULL,
	"size" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_value" real DEFAULT 0 NOT NULL,
	"total_value" real DEFAULT 0 NOT NULL,
	"date_issued" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_transport_benefits" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(36) NOT NULL,
	"benefit_type" "transport_benefit_type" NOT NULL,
	"date_from" text NOT NULL,
	"date_to" text,
	"amount" real NOT NULL,
	"frequency" "transport_frequency" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discipline_cases" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"case_type" text NOT NULL,
	"description" text NOT NULL,
	"points" integer DEFAULT 0,
	"action_taken" text,
	"case_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_txns" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"txn_date" text NOT NULL,
	"type" "txn_type" NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"created_by_user_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "fund_raising_activities" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"target_amount" real DEFAULT 0 NOT NULL,
	"season" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"injury_type" text NOT NULL,
	"severity" "injury_severity" NOT NULL,
	"start_date" text NOT NULL,
	"status" "injury_status" DEFAULT 'OPEN' NOT NULL,
	"clearance_note" text,
	"cleared_by_user_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "match_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar(36),
	"team_id" varchar(36),
	"document_type" "match_document_type" NOT NULL,
	"file_url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_set_stats" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar(36) NOT NULL,
	"sets" jsonb NOT NULL,
	"entered_by" varchar(36) NOT NULL,
	"entered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_squad_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"jersey_no" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_squads" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar(36) NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"opponent" text NOT NULL,
	"match_date" text NOT NULL,
	"start_time" timestamp,
	"venue" text NOT NULL,
	"competition" text NOT NULL,
	"result" "match_result",
	"sets_for" integer DEFAULT 0,
	"sets_against" integer DEFAULT 0,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"score_source" "score_source" DEFAULT 'NONE' NOT NULL,
	"score_locked" boolean DEFAULT false NOT NULL,
	"stats_entered" boolean DEFAULT false NOT NULL,
	"last_score_updated_by" varchar(36),
	"last_score_updated_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_posts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"caption" text,
	"image_url" text NOT NULL,
	"visibility" "media_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"status" "media_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"uploaded_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_tag_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"status" "media_tag_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" varchar(36) NOT NULL,
	"tagged_user_id" varchar(36),
	"tagged_player_id" varchar(36),
	"tag_type" "tag_type" DEFAULT 'PLAYER' NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"player_id" varchar(36),
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nvf_transfer_fee_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"fee_type" "nvf_fee_type" NOT NULL,
	"amount" real NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_audits" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar(36) NOT NULL,
	"target_user_id" varchar(36) NOT NULL,
	"reset_method" "reset_method" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_contracts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"sign_on_fee" real,
	"weekly_transport" real,
	"salary_amount" real,
	"release_fee" real,
	"membership_fee_required" real,
	"membership_fee_paid" real,
	"development_fee_required" real,
	"development_fee_paid" real,
	"currency" text DEFAULT 'NAD',
	"obligations" text,
	"contract_file_url" text,
	"status" "contract_status" DEFAULT 'DRAFT' NOT NULL,
	"signed_by_player" boolean DEFAULT false,
	"player_signed_at" timestamp,
	"approved_by_user_id" varchar(36),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"document_type" "player_document_type" NOT NULL,
	"file_url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_fund_raising_contributions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"contribution_date" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_match_stats" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"spikes_kill" integer DEFAULT 0,
	"spikes_error" integer DEFAULT 0,
	"serves_ace" integer DEFAULT 0,
	"serves_error" integer DEFAULT 0,
	"blocks_solo" integer DEFAULT 0,
	"blocks_assist" integer DEFAULT 0,
	"receive_perfect" integer DEFAULT 0,
	"receive_error" integer DEFAULT 0,
	"digs" integer DEFAULT 0,
	"setting_assist" integer DEFAULT 0,
	"setting_error" integer DEFAULT 0,
	"points_total" integer DEFAULT 0,
	"minutes_played" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "player_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"report_type" text NOT NULL,
	"pdf_url" text,
	"generated_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_transfer_cases" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"from_club" text NOT NULL,
	"to_club" text NOT NULL,
	"transfer_date" text NOT NULL,
	"nvf_year" integer NOT NULL,
	"contract_id" varchar(36),
	"nvf_fee" real DEFAULT 0 NOT NULL,
	"release_fee" real DEFAULT 0 NOT NULL,
	"items_value" real DEFAULT 0 NOT NULL,
	"transport_value" real DEFAULT 0 NOT NULL,
	"membership_outstanding" real DEFAULT 0 NOT NULL,
	"development_outstanding" real DEFAULT 0 NOT NULL,
	"total_due" real DEFAULT 0 NOT NULL,
	"breakdown_json" text NOT NULL,
	"status" "transfer_case_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar(36),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" text,
	"dob" text,
	"jersey_no" integer,
	"phone" text,
	"player_email" text,
	"home_address" text,
	"town" text,
	"region" text,
	"nationality" text,
	"id_number" text,
	"next_of_kin_name" text,
	"next_of_kin_relation" text,
	"next_of_kin_phone" text,
	"next_of_kin_address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"medical_notes" text,
	"allergies" text,
	"blood_group" text,
	"position" text,
	"status" "player_status" DEFAULT 'ACTIVE' NOT NULL,
	"eligibility_status" "eligibility_status" DEFAULT 'ELIGIBLE' NOT NULL,
	"eligibility_notes" text,
	"photo_url" text,
	"requested_team_id" varchar(36),
	"team_approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"requested_position" text,
	"position_approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"requested_jersey_no" integer,
	"jersey_approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"position_approved_by_user_id" varchar(36),
	"jersey_approved_by_user_id" varchar(36),
	"team_approved_by_user_id" varchar(36),
	"approved_at" timestamp,
	"registration_status" "registration_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"registration_notes" text,
	"membership_no" text,
	"marital_status" text,
	"facebook_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scouting_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36),
	"prospect_name" text,
	"notes" text NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" real,
	"currency" text DEFAULT 'NAD',
	"image_url" text,
	"category" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smart_focus" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"match_id" varchar(36) NOT NULL,
	"focus_areas" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_security_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT 'security' NOT NULL,
	"require_email_verification" boolean DEFAULT true NOT NULL,
	"require_admin_approval" boolean DEFAULT true NOT NULL,
	"auto_approve_team_requests" boolean DEFAULT false NOT NULL,
	"auto_approve_position" boolean DEFAULT false NOT NULL,
	"auto_approve_jersey" boolean DEFAULT false NOT NULL,
	"allowed_email_domains" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_officials" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"role" "team_official_role" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "team_category" NOT NULL,
	"season" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'PLAYER' NOT NULL,
	"team_id" varchar(36),
	"player_id" varchar(36),
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"verification_token" text,
	"verification_token_exp" timestamp,
	"account_status" "account_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"password_reset_token_hash" text,
	"password_reset_token_exp" timestamp,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"roles" text[] DEFAULT ARRAY[]::text[],
	"last_password_reset_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
