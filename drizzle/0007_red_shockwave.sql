CREATE TABLE "activity_weaknesses" (
	"activity_id" text NOT NULL,
	"weakness_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "activity_weaknesses_activity_id_content_version_weakness_id_pk" PRIMARY KEY("activity_id","content_version","weakness_id"),
	CONSTRAINT "activity_weakness_version_positive" CHECK ("activity_weaknesses"."content_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mistake_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weakness_id" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistake_practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weakness_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"submission_id" uuid NOT NULL,
	"submitted_answer" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mistake_practice_version_positive" CHECK ("mistake_practice_attempts"."content_version" > 0),
	CONSTRAINT "mistake_practice_score_range" CHECK ("mistake_practice_attempts"."score" >= 0 and "mistake_practice_attempts"."score" <= 1),
	CONSTRAINT "mistake_practice_answer_object" CHECK (jsonb_typeof("mistake_practice_attempts"."submitted_answer") = 'object')
);
--> statement-breakpoint
CREATE TABLE "weakness_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"language_code" text NOT NULL,
	"skill" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "weakness_skill_allowed" CHECK ("weakness_definitions"."skill" in ('grammar','vocabulary','reading','communication'))
);
--> statement-breakpoint
ALTER TABLE "activity_weaknesses" ADD CONSTRAINT "activity_weaknesses_activity_id_lesson_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."lesson_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_weaknesses" ADD CONSTRAINT "activity_weaknesses_weakness_id_weakness_definitions_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "public"."weakness_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_occurrences" ADD CONSTRAINT "mistake_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_occurrences" ADD CONSTRAINT "mistake_occurrences_weakness_id_weakness_definitions_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "public"."weakness_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_occurrences" ADD CONSTRAINT "mistake_occurrences_attempt_id_exercise_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exercise_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_practice_attempts" ADD CONSTRAINT "mistake_practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_practice_attempts" ADD CONSTRAINT "mistake_practice_attempts_weakness_id_weakness_definitions_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "public"."weakness_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_practice_attempts" ADD CONSTRAINT "mistake_practice_attempts_activity_id_lesson_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."lesson_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_definitions" ADD CONSTRAINT "weakness_definitions_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_weakness_target_idx" ON "activity_weaknesses" USING btree ("weakness_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_occurrence_source_unique" ON "mistake_occurrences" USING btree ("attempt_id","weakness_id");--> statement-breakpoint
CREATE INDEX "mistake_occurrence_user_recent_idx" ON "mistake_occurrences" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mistake_occurrence_user_weakness_idx" ON "mistake_occurrences" USING btree ("user_id","weakness_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_practice_submission_unique" ON "mistake_practice_attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE INDEX "mistake_practice_user_weakness_idx" ON "mistake_practice_attempts" USING btree ("user_id","weakness_id","created_at");--> statement-breakpoint
CREATE INDEX "weakness_language_idx" ON "weakness_definitions" USING btree ("language_code");--> statement-breakpoint
CREATE FUNCTION prevent_mistake_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Mistake history is immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER mistake_occurrences_immutable BEFORE UPDATE ON mistake_occurrences
FOR EACH ROW EXECUTE FUNCTION prevent_mistake_history_update();
--> statement-breakpoint
CREATE TRIGGER mistake_practice_immutable BEFORE UPDATE ON mistake_practice_attempts
FOR EACH ROW EXECUTE FUNCTION prevent_mistake_history_update();
--> statement-breakpoint
CREATE FUNCTION validate_mistake_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM exercise_attempts a JOIN activity_weaknesses m ON m.activity_id = a.activity_id AND m.content_version = a.content_version
    WHERE a.id = NEW.attempt_id AND a.user_id = NEW.user_id AND NOT a.is_correct AND a.created_at = NEW.created_at AND m.weakness_id = NEW.weakness_id) THEN
    RAISE EXCEPTION 'Invalid mistake evidence source' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER mistake_source_valid BEFORE INSERT ON mistake_occurrences
FOR EACH ROW EXECUTE FUNCTION validate_mistake_source();
