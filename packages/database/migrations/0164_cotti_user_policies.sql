CREATE TABLE IF NOT EXISTS "cotti_user_policies" (
	"user_id" text PRIMARY KEY NOT NULL,
	"vip" boolean DEFAULT false NOT NULL,
	"agent_enabled" boolean DEFAULT false NOT NULL,
	"topic_limit_fen" integer,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotti_user_policies" DROP CONSTRAINT IF EXISTS "cotti_user_policies_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_user_policies" ADD CONSTRAINT "cotti_user_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
