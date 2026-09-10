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
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_risk_analyses_message_id_messages_id_fk' AND conrelid = 'public.cotti_audit_risk_analyses'::regclass) THEN
  ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_risk_analyses_session_id_sessions_id_fk' AND conrelid = 'public.cotti_audit_risk_analyses'::regclass) THEN
  ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_risk_analyses_target_user_id_users_id_fk' AND conrelid = 'public.cotti_audit_risk_analyses'::regclass) THEN
  ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_risk_analyses_requested_by_user_id_users_id_fk' AND conrelid = 'public.cotti_audit_risk_analyses'::regclass) THEN
  ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_view_logs_admin_user_id_users_id_fk' AND conrelid = 'public.cotti_audit_view_logs'::regclass) THEN
  ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_view_logs_message_id_messages_id_fk' AND conrelid = 'public.cotti_audit_view_logs'::regclass) THEN
  ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_view_logs_session_id_sessions_id_fk' AND conrelid = 'public.cotti_audit_view_logs'::regclass) THEN
  ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotti_audit_view_logs_target_user_id_users_id_fk' AND conrelid = 'public.cotti_audit_view_logs'::regclass) THEN
  ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_message_id_unique" ON "cotti_audit_risk_analyses" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_status_idx" ON "cotti_audit_risk_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_created_at_idx" ON "cotti_audit_risk_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_admin_user_id_idx" ON "cotti_audit_view_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_target_idx" ON "cotti_audit_view_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_created_at_idx" ON "cotti_audit_view_logs" USING btree ("created_at");