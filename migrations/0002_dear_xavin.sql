CREATE TABLE "player_update_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"patch_json" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"submitted_by" varchar(36),
	"reviewed_at" timestamp,
	"reviewed_by" varchar(36),
	"review_note" text
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "weight_kg" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_weight_updated_at" timestamp;