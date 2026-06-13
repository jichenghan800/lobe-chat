CREATE TABLE IF NOT EXISTS "cotti_audit_risk_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"session_id" text,
	"target_user_id" text,
	"target_user_email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"reason" text,
	"confidence" text,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"risk_level" text,
	"risk_labels" jsonb DEFAULT '[]'::jsonb,
	"model" text,
	"provider" text,
	"error" text,
	"requested_by_user_id" text,
	"requested_by_email" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_message_id_messages_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_target_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_requested_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_message_id_unique" ON "cotti_audit_risk_analyses" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_status_idx" ON "cotti_audit_risk_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_created_at_idx" ON "cotti_audit_risk_analyses" USING btree ("created_at");
