CREATE TABLE "cotti_user_groups" (
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
ALTER TABLE "cotti_user_policies" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "cotti_user_policies" ADD CONSTRAINT "cotti_user_policies_group_id_cotti_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."cotti_user_groups"("id") ON DELETE restrict ON UPDATE no action;