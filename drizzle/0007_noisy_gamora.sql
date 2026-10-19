CREATE TABLE "misconceptions" (
	"id" text NOT NULL,
	"card_id" text NOT NULL,
	"text" text NOT NULL,
	"why" text NOT NULL,
	"retired_at" date,
	CONSTRAINT "misconceptions_card_id_id_pk" PRIMARY KEY("card_id","id")
);
--> statement-breakpoint
ALTER TABLE "misconceptions" ADD CONSTRAINT "misconceptions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;