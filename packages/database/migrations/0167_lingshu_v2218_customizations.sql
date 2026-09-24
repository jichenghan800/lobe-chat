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
CREATE TABLE IF NOT EXISTS "cotti_home_notification_settings" (
	"content" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_model_display_settings" (
	"config" jsonb NOT NULL,
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_login_access_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"value" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_login_access_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"mode" varchar(32) DEFAULT 'allowlist' NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_platform_admin_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"note" text,
	"created_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_sandbox_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_sandbox_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"max_sessions" integer DEFAULT 2 NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_topic_budget_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"limit_fen" integer DEFAULT 1000 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_topic_policies" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"limit_fen" integer,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"model_display" jsonb NOT NULL,
	"image_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fast_model" text NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotti_user_policies" (
	"user_id" text PRIMARY KEY NOT NULL,
	"group_id" text,
	"vip" boolean DEFAULT false NOT NULL,
	"agent_enabled" boolean DEFAULT false NOT NULL,
	"topic_limit_fen" integer,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_cost_freezes" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"reason" text DEFAULT 'context' NOT NULL,
	"spent_cny" numeric,
	"limit_fen" integer,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"estimated_input_tokens" integer NOT NULL,
	"input_token_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_target_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" DROP CONSTRAINT IF EXISTS "cotti_audit_risk_analyses_requested_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_risk_analyses" ADD CONSTRAINT "cotti_audit_risk_analyses_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_admin_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" DROP CONSTRAINT IF EXISTS "cotti_audit_view_logs_target_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_audit_view_logs" ADD CONSTRAINT "cotti_audit_view_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_login_access_rules" DROP CONSTRAINT IF EXISTS "cotti_login_access_rules_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_login_access_rules" ADD CONSTRAINT "cotti_login_access_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_login_access_settings" DROP CONSTRAINT IF EXISTS "cotti_login_access_settings_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_login_access_settings" ADD CONSTRAINT "cotti_login_access_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_platform_admin_assignments" DROP CONSTRAINT IF EXISTS "cotti_platform_admin_assignments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_platform_admin_assignments" ADD CONSTRAINT "cotti_platform_admin_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_platform_admin_assignments" DROP CONSTRAINT IF EXISTS "cotti_platform_admin_assignments_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_platform_admin_assignments" ADD CONSTRAINT "cotti_platform_admin_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_topic_policies" DROP CONSTRAINT IF EXISTS "cotti_topic_policies_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_topic_policies" ADD CONSTRAINT "cotti_topic_policies_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_user_policies" DROP CONSTRAINT IF EXISTS "cotti_user_policies_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_user_policies" ADD CONSTRAINT "cotti_user_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotti_user_policies" DROP CONSTRAINT IF EXISTS "cotti_user_policies_group_id_cotti_user_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_user_policies" ADD CONSTRAINT "cotti_user_policies_group_id_cotti_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."cotti_user_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" DROP CONSTRAINT IF EXISTS "topic_cost_freezes_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" ADD CONSTRAINT "topic_cost_freezes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_message_id_unique" ON "cotti_audit_risk_analyses" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_status_idx" ON "cotti_audit_risk_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_risk_analyses_created_at_idx" ON "cotti_audit_risk_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_admin_user_id_idx" ON "cotti_audit_view_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_target_idx" ON "cotti_audit_view_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_audit_view_logs_created_at_idx" ON "cotti_audit_view_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotti_login_access_rules_type_value_unique" ON "cotti_login_access_rules" USING btree ("type","value");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotti_platform_admin_assignments_user_id_unique" ON "cotti_platform_admin_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotti_sandbox_reservations_expires_at_idx" ON "cotti_sandbox_reservations" USING btree ("expires_at");