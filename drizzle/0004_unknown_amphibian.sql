CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"submission_id" uuid NOT NULL,
	"submitted_answer" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"is_correct" boolean NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_attempts_version_positive" CHECK ("exercise_attempts"."content_version" > 0),
	CONSTRAINT "exercise_attempts_score_range" CHECK ("exercise_attempts"."score" >= 0 and "exercise_attempts"."score" <= 1),
	CONSTRAINT "exercise_attempts_answer_object" CHECK (jsonb_typeof("exercise_attempts"."submitted_answer") = 'object')
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_activity_id_lesson_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."lesson_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_attempts_user_submission_unique" ON "exercise_attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE INDEX "exercise_attempts_user_activity_version_idx" ON "exercise_attempts" USING btree ("user_id","activity_id","content_version","created_at");
--> statement-breakpoint
-- History is append-only. User deletion may still cascade for fixture/privacy cleanup.
CREATE FUNCTION prevent_exercise_attempt_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Exercise attempts are immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER exercise_attempts_immutable BEFORE UPDATE ON exercise_attempts
FOR EACH ROW EXECUTE FUNCTION prevent_exercise_attempt_update();
