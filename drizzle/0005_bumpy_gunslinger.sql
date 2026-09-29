CREATE TABLE "activity_vocabulary" (
	"activity_id" text NOT NULL,
	"sense_id" text NOT NULL,
	"role" text NOT NULL,
	"target_key" text,
	CONSTRAINT "activity_vocabulary_activity_id_sense_id_pk" PRIMARY KEY("activity_id","sense_id"),
	CONSTRAINT "activity_vocabulary_role_allowed" CHECK ("activity_vocabulary"."role" in ('introduces','practises','context'))
);
--> statement-breakpoint
CREATE TABLE "user_vocabulary" (
	"user_id" uuid NOT NULL,
	"sense_id" text NOT NULL,
	"introduced_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"saved_at" timestamp with time zone,
	CONSTRAINT "user_vocabulary_user_id_sense_id_pk" PRIMARY KEY("user_id","sense_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_collocation_senses" (
	"collocation_id" text NOT NULL,
	"sense_id" text NOT NULL,
	CONSTRAINT "vocabulary_collocation_senses_collocation_id_sense_id_pk" PRIMARY KEY("collocation_id","sense_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_collocations" (
	"id" text PRIMARY KEY NOT NULL,
	"phrase" text NOT NULL,
	"note" text,
	"example" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocabulary_evidence" (
	"attempt_id" uuid NOT NULL,
	"sense_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_evidence_attempt_id_sense_id_pk" PRIMARY KEY("attempt_id","sense_id"),
	CONSTRAINT "vocabulary_evidence_score_range" CHECK ("vocabulary_evidence"."score" >= 0 and "vocabulary_evidence"."score" <= 1)
);
--> statement-breakpoint
CREATE TABLE "vocabulary_examples" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"sentence" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "vocabulary_families" (
	"sense_id" text NOT NULL,
	"related_sense_id" text NOT NULL,
	CONSTRAINT "vocabulary_families_sense_id_related_sense_id_pk" PRIMARY KEY("sense_id","related_sense_id"),
	CONSTRAINT "vocabulary_family_not_self" CHECK ("vocabulary_families"."sense_id" <> "vocabulary_families"."related_sense_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_sense_tags" (
	"sense_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "vocabulary_sense_tags_sense_id_tag_id_pk" PRIMARY KEY("sense_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_senses" (
	"id" text PRIMARY KEY NOT NULL,
	"language_code" text NOT NULL,
	"lemma" text NOT NULL,
	"display_form" text NOT NULL,
	"part_of_speech" text NOT NULL,
	"level" "cefr" NOT NULL,
	"definition" text NOT NULL,
	"notes" text,
	"is_published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vocabulary_senses_pos_allowed" CHECK ("vocabulary_senses"."part_of_speech" in ('noun','verb','adjective','adverb','phrase'))
);
--> statement-breakpoint
CREATE TABLE "vocabulary_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_vocabulary" ADD CONSTRAINT "activity_vocabulary_activity_id_lesson_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."lesson_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_vocabulary" ADD CONSTRAINT "activity_vocabulary_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_collocation_senses" ADD CONSTRAINT "vocabulary_collocation_senses_collocation_id_vocabulary_collocations_id_fk" FOREIGN KEY ("collocation_id") REFERENCES "public"."vocabulary_collocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_collocation_senses" ADD CONSTRAINT "vocabulary_collocation_senses_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_evidence" ADD CONSTRAINT "vocabulary_evidence_attempt_id_exercise_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exercise_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_evidence" ADD CONSTRAINT "vocabulary_evidence_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_evidence" ADD CONSTRAINT "vocabulary_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_examples" ADD CONSTRAINT "vocabulary_examples_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_families" ADD CONSTRAINT "vocabulary_families_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_families" ADD CONSTRAINT "vocabulary_families_related_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("related_sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_sense_tags" ADD CONSTRAINT "vocabulary_sense_tags_sense_id_vocabulary_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."vocabulary_senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_sense_tags" ADD CONSTRAINT "vocabulary_sense_tags_tag_id_vocabulary_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."vocabulary_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_senses" ADD CONSTRAINT "vocabulary_senses_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_vocabulary_sense_idx" ON "activity_vocabulary" USING btree ("sense_id");--> statement-breakpoint
CREATE INDEX "user_vocabulary_saved_idx" ON "user_vocabulary" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE INDEX "vocabulary_evidence_user_sense_idx" ON "vocabulary_evidence" USING btree ("user_id","sense_id","created_at");--> statement-breakpoint
CREATE INDEX "vocabulary_sense_tags_tag_idx" ON "vocabulary_sense_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "vocabulary_senses_language_level_idx" ON "vocabulary_senses" USING btree ("language_code","level");
--> statement-breakpoint
-- Practice evidence is an append-only projection of immutable graded attempts.
CREATE FUNCTION prevent_vocabulary_evidence_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Vocabulary evidence is immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER vocabulary_evidence_immutable BEFORE UPDATE ON vocabulary_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_vocabulary_evidence_update();
