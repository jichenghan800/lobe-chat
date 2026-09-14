CREATE TABLE "cotti_sandbox_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotti_sandbox_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"max_sessions" integer DEFAULT 2 NOT NULL,
	"updated_by" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cotti_sandbox_reservations_expires_at_idx" ON "cotti_sandbox_reservations" USING btree ("expires_at");