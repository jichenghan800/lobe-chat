-- Reconciles the production COTTI migration lineage (custom 0112-0118) with
-- the v2.2.13 schema. Before applying this migration, run:
--   scripts/database/v2213CottiPreMigration.ts --apply
-- The pre-migration step preserves the historical visibility of enrolled
-- workspace devices and builds hot activity indexes online.
CREATE TABLE "agent_account_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"role" text DEFAULT 'pool' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"provider" text NOT NULL,
	"external_account_id" text,
	"email" text,
	"display_name" text,
	"organization_id" text,
	"plan_tier" text,
	"rate_limit_tier" text,
	"label" varchar(255),
	"credential_mode" text DEFAULT 'referenced' NOT NULL,
	"credentials" text,
	"credential_ref" jsonb,
	"token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_validated_at" timestamp with time zone,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_quota_calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"limit_type" text NOT NULL,
	"scope_key" text DEFAULT '' NOT NULL,
	"capacity_usd" numeric(20, 6) NOT NULL,
	"capacity_tokens_equivalent" bigint,
	"model_mix" jsonb,
	"sample_count" integer NOT NULL,
	"confidence" numeric(20, 6),
	"method" text,
	"window_seconds" integer,
	"calibrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_quota_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"device_id" uuid,
	"limit_type" text NOT NULL,
	"scope_key" text DEFAULT '' NOT NULL,
	"resets_at" timestamp with time zone,
	"utilization" integer NOT NULL,
	"severity" text,
	"is_active" boolean,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_quota_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"provider" text NOT NULL,
	"model" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"reasoning_tokens" integer,
	"cost_usd" numeric(20, 6),
	"cost_source" text,
	"message_id" text,
	"operation_id" text,
	"topic_id" text,
	"agent_id" text,
	"external_event_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_quota_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"limit_type" text NOT NULL,
	"scope_key" text DEFAULT '' NOT NULL,
	"resets_at" timestamp with time zone NOT NULL,
	"window_start_at" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"peak_utilization" integer DEFAULT 0 NOT NULL,
	"last_utilization" integer,
	"rate_limited_at" timestamp with time zone,
	"observed_cost_usd" numeric(20, 6),
	"observed_tokens" bigint,
	"estimated_capacity_usd" numeric(20, 6),
	"contaminated" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"access_level" text NOT NULL,
	"created_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_comment_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" text NOT NULL,
	"mentioned_user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"message_id" text,
	"parent_comment_id" text,
	"author_user_id" text,
	"workspace_id" text NOT NULL,
	"content" text NOT NULL,
	"editor_data" jsonb,
	"client_id" text NOT NULL,
	"anchor_preview" jsonb,
	"deleted_at" timestamp with time zone,
	"moderated_at" timestamp with time zone,
	"moderated_by_user_id" text,
	"moderation_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_comments_anchored_requires_preview" CHECK ("topic_comments"."message_id" IS NULL OR "topic_comments"."anchor_preview" IS NOT NULL),
	CONSTRAINT "topic_comments_reply_has_no_anchor" CHECK ("topic_comments"."parent_comment_id" IS NULL OR ("topic_comments"."message_id" IS NULL AND "topic_comments"."anchor_preview" IS NULL)),
	CONSTRAINT "topic_comments_moderation_window_consistent" CHECK (("topic_comments"."moderated_at" IS NULL) = ("topic_comments"."moderation_expires_at" IS NULL)),
	CONSTRAINT "topic_comments_deleted_not_recoverable" CHECK ("topic_comments"."deleted_at" IS NULL OR "topic_comments"."moderated_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"requirement" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"visual_render" jsonb,
	"metadata" jsonb,
	"completed_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verify_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text,
	"check_result_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"file_id" text,
	"metadata" jsonb,
	"captured_by" text,
	"captured_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verify_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verify_run_id" uuid,
	"operation_id" text,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"verdict" text,
	"overall_confidence" numeric(3, 2),
	"total_checks" integer,
	"passed_checks" integer,
	"failed_checks" integer,
	"uncertain_checks" integer,
	"summary" text,
	"content" text,
	"reviewed_by_user" boolean DEFAULT false,
	"generated_by" text DEFAULT 'system',
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verify_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"acceptance_id" uuid,
	"round_index" integer,
	"operation_id" text,
	"source" text DEFAULT 'agent' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"scenario" text,
	"title" text,
	"goal" text,
	"context" jsonb,
	"metadata" jsonb,
	"plan" jsonb,
	"plan_confirmed_at" timestamp with time zone,
	"status" text,
	"user_decision" text,
	"decision_detail" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verify_runs_acceptance_requires_round" CHECK ("verify_runs"."acceptance_id" IS NULL OR "verify_runs"."round_index" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "work_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"identifier" text,
	"status" text,
	"url" text,
	"change_type" text NOT NULL,
	"tool_name" text NOT NULL,
	"tool_identifier" text NOT NULL,
	"topic_id" text,
	"thread_id" text,
	"message_id" text,
	"root_operation_id" text,
	"tool_call_id" text,
	"agent_id" text,
	"metadata" jsonb,
	"cumulative_cost" numeric(20, 6),
	"cumulative_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"current_version_id" uuid,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"title" text,
	"description" text,
	"identifier" text,
	"status" text,
	"url" text,
	"tool_name" text NOT NULL,
	"tool_identifier" text NOT NULL,
	"origin_topic_id" text,
	"origin_thread_id" text,
	"origin_agent_id" text,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"visibility" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"preference" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verify_check_results" DROP CONSTRAINT "verify_check_results_operation_id_agent_operations_id_fk";
--> statement-breakpoint
DROP INDEX "user_connectors_user_identifier_unique";--> statement-breakpoint
DROP INDEX "verify_check_results_operation_id_check_item_id_unique";--> statement-breakpoint
ALTER TABLE "verify_check_results" ALTER COLUMN "operation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connectors" ADD COLUMN "agent_id" text;--> statement-breakpoint
-- The pre-migration script adds this column as nullable and backfills every
-- existing row. Keeping the constraint change here makes an omitted preflight
-- fail safely instead of silently changing historical workspace visibility.
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "visibility" text;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "visibility" SET DEFAULT 'private';--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "visibility" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "shared_from_device_id" varchar(64);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_topics" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "messenger_account_links" ADD COLUMN "application_id" varchar(255);--> statement-breakpoint
ALTER TABLE "messenger_account_links" ADD COLUMN "credentials" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "context" text;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD COLUMN "enabled" boolean;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_groups" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_documents" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_topics" ADD COLUMN "trigger" text;--> statement-breakpoint
ALTER TABLE "task_topics" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "verify_check_results" ADD COLUMN "verify_run_id" uuid;--> statement-breakpoint
ALTER TABLE "verify_check_results" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "verify_check_results" ADD COLUMN "user_decision_detail" jsonb;--> statement-breakpoint
ALTER TABLE "agent_account_bindings" ADD CONSTRAINT "agent_account_bindings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_bindings" ADD CONSTRAINT "agent_account_bindings_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_bindings" ADD CONSTRAINT "agent_account_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_bindings" ADD CONSTRAINT "agent_account_bindings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_provider_accounts" ADD CONSTRAINT "agent_provider_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_provider_accounts" ADD CONSTRAINT "agent_provider_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_calibrations" ADD CONSTRAINT "agent_quota_calibrations_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_calibrations" ADD CONSTRAINT "agent_quota_calibrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_calibrations" ADD CONSTRAINT "agent_quota_calibrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_snapshots" ADD CONSTRAINT "agent_quota_snapshots_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_snapshots" ADD CONSTRAINT "agent_quota_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_snapshots" ADD CONSTRAINT "agent_quota_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_snapshots" ADD CONSTRAINT "agent_quota_snapshots_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_operation_id_agent_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."agent_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_usage_ledger" ADD CONSTRAINT "agent_quota_usage_ledger_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_windows" ADD CONSTRAINT "agent_quota_windows_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_windows" ADD CONSTRAINT "agent_quota_windows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quota_windows" ADD CONSTRAINT "agent_quota_windows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comment_mentions" ADD CONSTRAINT "topic_comment_mentions_comment_id_topic_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."topic_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comment_mentions" ADD CONSTRAINT "topic_comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comment_mentions" ADD CONSTRAINT "topic_comment_mentions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_parent_comment_id_topic_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."topic_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_evidence" ADD CONSTRAINT "verify_evidence_check_result_id_verify_check_results_id_fk" FOREIGN KEY ("check_result_id") REFERENCES "public"."verify_check_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_evidence" ADD CONSTRAINT "verify_evidence_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_evidence" ADD CONSTRAINT "verify_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_evidence" ADD CONSTRAINT "verify_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_reports" ADD CONSTRAINT "verify_reports_verify_run_id_verify_runs_id_fk" FOREIGN KEY ("verify_run_id") REFERENCES "public"."verify_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_reports" ADD CONSTRAINT "verify_reports_operation_id_agent_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."agent_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_reports" ADD CONSTRAINT "verify_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_reports" ADD CONSTRAINT "verify_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_acceptance_id_acceptances_id_fk" FOREIGN KEY ("acceptance_id") REFERENCES "public"."acceptances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_operation_id_agent_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."agent_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_origin_topic_id_topics_id_fk" FOREIGN KEY ("origin_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_origin_thread_id_threads_id_fk" FOREIGN KEY ("origin_thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_origin_agent_id_agents_id_fk" FOREIGN KEY ("origin_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_settings" ADD CONSTRAINT "workspace_user_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_settings" ADD CONSTRAINT "workspace_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_account_bindings_agent_account_unique" ON "agent_account_bindings" USING btree ("agent_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_account_bindings_agent_pinned_unique" ON "agent_account_bindings" USING btree ("agent_id") WHERE "agent_account_bindings"."role" = 'pinned';--> statement-breakpoint
CREATE INDEX "agent_account_bindings_agent_id_idx" ON "agent_account_bindings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_account_bindings_account_id_idx" ON "agent_account_bindings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "agent_account_bindings_user_id_idx" ON "agent_account_bindings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_account_bindings_workspace_id_idx" ON "agent_account_bindings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_provider_accounts_user_id_idx" ON "agent_provider_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_provider_accounts_workspace_id_idx" ON "agent_provider_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_provider_accounts_token_expires_at_idx" ON "agent_provider_accounts" USING btree ("token_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_provider_accounts_identity_unique" ON "agent_provider_accounts" USING btree ("user_id","provider","external_account_id") WHERE "agent_provider_accounts"."external_account_id" IS NOT NULL and "agent_provider_accounts"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_provider_accounts_identity_workspace_unique" ON "agent_provider_accounts" USING btree ("provider","external_account_id","workspace_id") WHERE "agent_provider_accounts"."external_account_id" IS NOT NULL and "agent_provider_accounts"."workspace_id" is not null;--> statement-breakpoint
CREATE INDEX "agent_quota_calibrations_account_type_scope_idx" ON "agent_quota_calibrations" USING btree ("account_id","limit_type","scope_key","calibrated_at");--> statement-breakpoint
CREATE INDEX "agent_quota_calibrations_workspace_id_idx" ON "agent_quota_calibrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_quota_snapshots_account_type_scope_idx" ON "agent_quota_snapshots" USING btree ("account_id","limit_type","scope_key","captured_at");--> statement-breakpoint
CREATE INDEX "agent_quota_snapshots_account_captured_idx" ON "agent_quota_snapshots" USING btree ("account_id","captured_at");--> statement-breakpoint
CREATE INDEX "agent_quota_snapshots_resets_at_idx" ON "agent_quota_snapshots" USING btree ("resets_at");--> statement-breakpoint
CREATE INDEX "agent_quota_snapshots_workspace_id_idx" ON "agent_quota_snapshots" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_quota_usage_ledger_account_occurred_idx" ON "agent_quota_usage_ledger" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "agent_quota_usage_ledger_account_model_occurred_idx" ON "agent_quota_usage_ledger" USING btree ("account_id","model","occurred_at");--> statement-breakpoint
CREATE INDEX "agent_quota_usage_ledger_message_id_idx" ON "agent_quota_usage_ledger" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "agent_quota_usage_ledger_operation_id_idx" ON "agent_quota_usage_ledger" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "agent_quota_usage_ledger_workspace_id_idx" ON "agent_quota_usage_ledger" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_quota_usage_ledger_external_event_unique" ON "agent_quota_usage_ledger" USING btree ("external_event_id") WHERE "agent_quota_usage_ledger"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_quota_windows_natural_key_unique" ON "agent_quota_windows" USING btree ("account_id","limit_type","scope_key","resets_at");--> statement-breakpoint
CREATE INDEX "agent_quota_windows_account_resets_idx" ON "agent_quota_windows" USING btree ("account_id","resets_at");--> statement-breakpoint
CREATE INDEX "agent_quota_windows_user_id_idx" ON "agent_quota_windows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_quota_windows_workspace_id_idx" ON "agent_quota_windows" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_permissions_workspace_resource_unique" ON "resource_permissions" USING btree ("workspace_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_resource_idx" ON "resource_permissions" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_workspace_idx" ON "resource_permissions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_comment_mentions_comment_id_mentioned_user_id_unique" ON "topic_comment_mentions" USING btree ("comment_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "topic_comment_mentions_mentioned_user_id_created_at_idx" ON "topic_comment_mentions" USING btree ("mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "topic_comment_mentions_workspace_id_idx" ON "topic_comment_mentions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_comments_topic_id_author_user_id_client_id_unique" ON "topic_comments" USING btree ("topic_id","author_user_id","client_id");--> statement-breakpoint
CREATE INDEX "topic_comments_parent_comment_id_created_at_id_idx" ON "topic_comments" USING btree ("parent_comment_id","created_at","id");--> statement-breakpoint
CREATE INDEX "topic_comments_topic_id_created_at_id_idx" ON "topic_comments" USING btree ("topic_id","created_at","id");--> statement-breakpoint
CREATE INDEX "topic_comments_topic_id_message_id_idx" ON "topic_comments" USING btree ("topic_id","message_id");--> statement-breakpoint
CREATE INDEX "topic_comments_message_id_idx" ON "topic_comments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "topic_comments_author_user_id_idx" ON "topic_comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "topic_comments_moderation_expires_at_idx" ON "topic_comments" USING btree ("moderation_expires_at");--> statement-breakpoint
CREATE INDEX "topic_comments_moderated_by_user_id_idx" ON "topic_comments" USING btree ("moderated_by_user_id");--> statement-breakpoint
CREATE INDEX "topic_comments_workspace_id_idx" ON "topic_comments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "acceptances_user_id_idx" ON "acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "acceptances_workspace_id_idx" ON "acceptances" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "acceptances_subject_idx" ON "acceptances" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "acceptances_status_idx" ON "acceptances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "acceptances_workspace_visibility_idx" ON "acceptances" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acceptances_personal_subject_unique" ON "acceptances" USING btree ("user_id","subject_type","subject_id") WHERE "acceptances"."workspace_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "acceptances_workspace_subject_unique" ON "acceptances" USING btree ("workspace_id","subject_type","subject_id") WHERE "acceptances"."workspace_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "verify_evidence_check_result_id_idx" ON "verify_evidence" USING btree ("check_result_id");--> statement-breakpoint
CREATE INDEX "verify_evidence_file_id_idx" ON "verify_evidence" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "verify_evidence_user_id_idx" ON "verify_evidence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verify_evidence_workspace_id_idx" ON "verify_evidence" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verify_reports_verify_run_id_unique" ON "verify_reports" USING btree ("verify_run_id");--> statement-breakpoint
CREATE INDEX "verify_reports_operation_id_idx" ON "verify_reports" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "verify_reports_user_id_idx" ON "verify_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verify_reports_workspace_id_idx" ON "verify_reports" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "verify_runs_user_id_idx" ON "verify_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verify_runs_workspace_id_idx" ON "verify_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "verify_runs_acceptance_id_idx" ON "verify_runs" USING btree ("acceptance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verify_runs_acceptance_round_unique" ON "verify_runs" USING btree ("acceptance_id","round_index");--> statement-breakpoint
CREATE UNIQUE INDEX "verify_runs_operation_id_unique" ON "verify_runs" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "verify_runs_source_idx" ON "verify_runs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "verify_runs_user_decision_idx" ON "verify_runs" USING btree ("user_decision");--> statement-breakpoint
CREATE UNIQUE INDEX "work_versions_work_id_version_unique" ON "work_versions" USING btree ("work_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "work_versions_work_id_tool_call_id_unique" ON "work_versions" USING btree ("work_id","tool_call_id") WHERE "work_versions"."tool_call_id" is not null;--> statement-breakpoint
CREATE INDEX "work_versions_thread_id_idx" ON "work_versions" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "work_versions_message_id_idx" ON "work_versions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "work_versions_agent_id_idx" ON "work_versions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "work_versions_root_operation_created_at_idx" ON "work_versions" USING btree ("root_operation_id","created_at");--> statement-breakpoint
CREATE INDEX "work_versions_topic_created_at_idx" ON "work_versions" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "work_versions_topic_thread_created_at_idx" ON "work_versions" USING btree ("topic_id","thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "works_resource_user_unique" ON "works" USING btree ("resource_type","resource_id","user_id") WHERE "works"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "works_resource_workspace_unique" ON "works" USING btree ("workspace_id","resource_type","resource_id") WHERE "works"."workspace_id" is not null;--> statement-breakpoint
CREATE INDEX "works_user_id_idx" ON "works" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "works_workspace_id_idx" ON "works" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "works_workspace_visibility_idx" ON "works" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "works_user_updated_at_id_idx" ON "works" USING btree ("user_id","updated_at","id") WHERE "works"."workspace_id" is null;--> statement-breakpoint
CREATE INDEX "works_workspace_updated_at_id_idx" ON "works" USING btree ("workspace_id","updated_at","id") WHERE "works"."workspace_id" is not null;--> statement-breakpoint
CREATE INDEX "works_origin_topic_id_idx" ON "works" USING btree ("origin_topic_id");--> statement-breakpoint
CREATE INDEX "works_origin_thread_id_idx" ON "works" USING btree ("origin_thread_id");--> statement-breakpoint
CREATE INDEX "works_origin_agent_id_idx" ON "works" USING btree ("origin_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_user_settings_workspace_id_user_id_unique" ON "workspace_user_settings" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_user_settings_user_id_idx" ON "workspace_user_settings" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD CONSTRAINT "oidc_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD CONSTRAINT "oidc_clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_check_results" ADD CONSTRAINT "verify_check_results_verify_run_id_verify_runs_id_fk" FOREIGN KEY ("verify_run_id") REFERENCES "public"."verify_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_check_results" ADD CONSTRAINT "verify_check_results_operation_id_agent_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."agent_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_created_at_idx" ON "agents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agents_workspace_visibility_idx" ON "agents" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "chat_groups_workspace_visibility_idx" ON "chat_groups" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "user_connectors_personal_identifier_idx" ON "user_connectors" USING btree ("user_id","identifier") WHERE "user_connectors"."workspace_id" IS NULL AND "user_connectors"."agent_id" IS NULL;--> statement-breakpoint
CREATE INDEX "user_connectors_workspace_identifier_idx" ON "user_connectors" USING btree ("user_id","workspace_id","identifier") WHERE "user_connectors"."workspace_id" IS NOT NULL AND "user_connectors"."agent_id" IS NULL;--> statement-breakpoint
CREATE INDEX "user_connectors_agent_identifier_idx" ON "user_connectors" USING btree ("agent_id","identifier") WHERE "user_connectors"."agent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_connectors_agent_id_idx" ON "user_connectors" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "devices_workspace_visibility_idx" ON "devices" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "documents_workspace_visibility_idx" ON "documents" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "files_workspace_visibility_idx" ON "files" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "knowledge_bases_workspace_visibility_idx" ON "knowledge_bases" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "generation_topics_workspace_visibility_idx" ON "generation_topics" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "messages_topic_id_updated_at_idx" ON "messages" USING btree ("topic_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_account_links_platform_tenant_application_unique" ON "messenger_account_links" USING btree ("platform","tenant_id","application_id") WHERE "messenger_account_links"."application_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_workspace" ON "notifications" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_workspace_id" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "oidc_clients_user_id_idx" ON "oidc_clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_clients_workspace_id_idx" ON "oidc_clients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "session_groups_workspace_visibility_idx" ON "session_groups" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "task_comments_workspace_visibility_idx" ON "task_comments" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "task_deps_workspace_visibility_idx" ON "task_dependencies" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "task_docs_workspace_visibility_idx" ON "task_documents" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "task_topics_workspace_visibility_idx" ON "task_topics" USING btree ("workspace_id","visibility","user_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_visibility_idx" ON "tasks" USING btree ("workspace_id","visibility","created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_created_at_idx" ON "topics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verify_check_results_verify_run_id_idx" ON "verify_check_results" USING btree ("verify_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verify_check_results_verify_run_id_check_item_id_unique" ON "verify_check_results" USING btree ("verify_run_id","check_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_unique_active_owner_idx" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner' AND "workspace_members"."deleted_at" IS NULL;
