CREATE TABLE IF NOT EXISTS "cotti_topic_budget_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"limit_fen" integer DEFAULT 1000 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" ADD COLUMN IF NOT EXISTS "reason" text DEFAULT 'context' NOT NULL;--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" ADD COLUMN IF NOT EXISTS "spent_cny" numeric;--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" ADD COLUMN IF NOT EXISTS "limit_fen" integer;