CREATE TABLE "card_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"conclusion" text NOT NULL,
	"transcript" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "card_reports_card_idx" ON "card_reports" USING btree ("card_id");