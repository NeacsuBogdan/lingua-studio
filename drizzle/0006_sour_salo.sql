CREATE TABLE "review_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sense_id" text NOT NULL,
	"kind" text DEFAULT 'recognition' NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"elapsed_days" double precision NOT NULL,
	"scheduled_days" double precision NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"state" integer NOT NULL,
	"last_review" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"scheduler_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_cards_kind_allowed" CHECK ("review_cards"."kind" = 'recognition'),
	CONSTRAINT "review_cards_state_allowed" CHECK ("review_cards"."state" between 0 and 3),
	CONSTRAINT "review_cards_counts_nonnegative" CHECK ("review_cards"."revision" >= 0 and "review_cards"."reps" >= 0 and "review_cards"."lapses" >= 0 and "review_cards"."learning_steps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "review_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"sense_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"before_due" timestamp with time zone NOT NULL,
	"after_due" timestamp with time zone NOT NULL,
	"before_state" integer NOT NULL,
	"after_state" integer NOT NULL,
	"before_stability" double precision NOT NULL,
	"after_stability" double precision NOT NULL,
	"before_difficulty" double precision NOT NULL,
	"after_difficulty" double precision NOT NULL,
	"scheduled_days" double precision NOT NULL,
	"scheduler_version" text NOT NULL,
	CONSTRAINT "review_history_rating_allowed" CHECK ("review_history"."rating" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "review_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expected_revision" integer NOT NULL,
	CONSTRAINT "review_session_items_position_positive" CHECK ("review_session_items"."position" > 0),
	CONSTRAINT "review_session_items_status_allowed" CHECK ("review_session_items"."status" in ('pending','reviewed','stale'))
);
--> statement-breakpoint
CREATE TABLE "review_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "review_sessions_status_allowed" CHECK ("review_sessions"."status" in ('active','completed')),
	CONSTRAINT "review_sessions_completion_consistent" CHECK (("review_sessions"."status" = 'active' and "review_sessions"."completed_at" is null) or ("review_sessions"."status" = 'completed' and "review_sessions"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_card_id_review_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."review_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_item_id_review_session_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."review_session_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_session_items" ADD CONSTRAINT "review_session_items_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_session_items" ADD CONSTRAINT "review_session_items_card_id_review_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."review_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_cards_user_sense_kind_unique" ON "review_cards" USING btree ("user_id","sense_id","kind");--> statement-breakpoint
CREATE INDEX "review_cards_user_due_idx" ON "review_cards" USING btree ("user_id","due");--> statement-breakpoint
CREATE UNIQUE INDEX "review_history_user_submission_unique" ON "review_history" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_history_item_unique" ON "review_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "review_history_user_reviewed_idx" ON "review_history" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_history_card_reviewed_idx" ON "review_history" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_session_items_position_unique" ON "review_session_items" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "review_session_items_card_unique" ON "review_session_items" USING btree ("session_id","card_id");--> statement-breakpoint
CREATE INDEX "review_sessions_user_status_idx" ON "review_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_sessions_one_active_per_user" ON "review_sessions" USING btree ("user_id") WHERE "review_sessions"."status" = 'active';
--> statement-breakpoint
-- Review events are append-only; user deletion may still cascade for fixture/privacy cleanup.
CREATE FUNCTION prevent_review_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Review history is immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER review_history_immutable BEFORE UPDATE ON review_history
FOR EACH ROW EXECUTE FUNCTION prevent_review_history_update();
