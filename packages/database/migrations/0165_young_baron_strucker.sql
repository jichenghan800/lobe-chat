CREATE TABLE IF NOT EXISTS "cotti_topic_policies" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"limit_fen" integer,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotti_topic_policies" DROP CONSTRAINT IF EXISTS "cotti_topic_policies_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "cotti_topic_policies" ADD CONSTRAINT "cotti_topic_policies_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;