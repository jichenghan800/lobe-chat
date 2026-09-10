CREATE TABLE IF NOT EXISTS "cotti_home_notification_settings" (
	"content" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
