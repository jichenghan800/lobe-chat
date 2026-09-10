CREATE TABLE "topic_cost_freezes" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"estimated_input_tokens" integer NOT NULL,
	"input_token_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_cost_freezes" ADD CONSTRAINT "topic_cost_freezes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;