CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_state" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"phase" text DEFAULT 'new' NOT NULL,
	"s_num" integer DEFAULT 0 NOT NULL,
	"s_den" integer DEFAULT 1 NOT NULL,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase_index" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"plan_generated_at" timestamp with time zone,
	"algo_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_state_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"question" text NOT NULL,
	"card_type" text NOT NULL,
	"detail" text NOT NULL,
	"follow_ups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applies_to" text NOT NULL,
	"frequency" text NOT NULL,
	"conclusion" text,
	"retired_at" date
);
--> statement-breakpoint
CREATE TABLE "daily_session" (
	"user_id" text NOT NULL,
	"local_date" date NOT NULL,
	"queue_size" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_session_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "key_points" (
	"id" text NOT NULL,
	"card_id" text NOT NULL,
	"text" text NOT NULL,
	"source" jsonb NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"order" integer,
	"exclude_as_distractor_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retired_at" date,
	CONSTRAINT "key_points_card_id_id_pk" PRIMARY KEY("card_id","id")
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"correct_checked" integer NOT NULL,
	"wrong_checked" integer NOT NULL,
	"key_points_total" integer NOT NULL,
	"ready_by_date_at_review" date,
	"daily_capacity_at_review" integer NOT NULL,
	"distractor_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clock_clamped" text,
	"algo_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ready_by_date" date,
	"daily_capacity" integer DEFAULT 45 NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"free_block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_points" ADD CONSTRAINT "key_points_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_state_user_idx" ON "card_state" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_log_submission_uidx" ON "review_log" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "review_log_user_card_idx" ON "review_log" USING btree ("user_id","card_id");