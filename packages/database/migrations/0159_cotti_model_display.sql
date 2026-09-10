CREATE TABLE IF NOT EXISTS "cotti_model_display_settings" (
	"config" jsonb NOT NULL,
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
