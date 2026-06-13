CREATE TABLE IF NOT EXISTS "cotti_audit_view_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" text,
	"admin_email" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"message_id" text,
	"session_id" text,
	"target_user_id" text,
	"target_user_email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_admin_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_message_id_messages_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_target_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_admin_user_id_idx" ON "cotti_audit_view_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_target_idx" ON "cotti_audit_view_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_created_at_idx" ON "cotti_audit_view_logs" USING btree ("created_at");
