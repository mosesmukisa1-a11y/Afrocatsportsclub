CREATE TABLE "match_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar(36) NOT NULL,
	"team_id" varchar(36) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar(36)
);
