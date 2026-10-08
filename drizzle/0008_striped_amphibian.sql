CREATE TABLE "daily_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"focus" jsonb NOT NULL,
	"estimated_minutes" double precision NOT NULL,
	"target_count" integer NOT NULL,
	"baseline_count" integer DEFAULT 0 NOT NULL,
	"completed_units" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"unavailable_at" timestamp with time zone,
	"lesson_id" text,
	"lesson_content_version" integer,
	"start_position" integer,
	"target_position" integer,
	"weakness_id" text,
	CONSTRAINT "daily_items_counts_valid" CHECK ("daily_session_items"."position" > 0 and "daily_session_items"."estimated_minutes" > 0 and "daily_session_items"."target_count" > 0 and "daily_session_items"."baseline_count" >= 0 and "daily_session_items"."completed_units" between 0 and "daily_session_items"."target_count"),
	CONSTRAINT "daily_items_status_consistent" CHECK (("daily_session_items"."status" = 'pending' and "daily_session_items"."completed_at" is null and "daily_session_items"."unavailable_at" is null) or ("daily_session_items"."status" = 'completed' and "daily_session_items"."completed_at" is not null and "daily_session_items"."unavailable_at" is null and "daily_session_items"."completed_units" = "daily_session_items"."target_count") or ("daily_session_items"."status" = 'unavailable' and "daily_session_items"."completed_at" is null and "daily_session_items"."unavailable_at" is not null)),
	CONSTRAINT "daily_items_source_consistent" CHECK (("daily_session_items"."kind" = 'review' and "daily_session_items"."target_count" <= 20 and "daily_session_items"."lesson_id" is null and "daily_session_items"."lesson_content_version" is null and "daily_session_items"."start_position" is null and "daily_session_items"."target_position" is null and "daily_session_items"."weakness_id" is null) or ("daily_session_items"."kind" = 'lesson' and "daily_session_items"."lesson_id" is not null and "daily_session_items"."lesson_content_version" is not null and "daily_session_items"."start_position" is not null and "daily_session_items"."target_position" is not null and "daily_session_items"."lesson_content_version" > 0 and "daily_session_items"."start_position" >= 0 and "daily_session_items"."target_position" > "daily_session_items"."start_position" and "daily_session_items"."target_count" = "daily_session_items"."target_position" - "daily_session_items"."start_position" and "daily_session_items"."weakness_id" is null) or ("daily_session_items"."kind" = 'mistake' and "daily_session_items"."weakness_id" is not null and "daily_session_items"."target_count" = 1 and "daily_session_items"."lesson_id" is null and "daily_session_items"."lesson_content_version" is null and "daily_session_items"."start_position" is null and "daily_session_items"."target_position" is null))
);
--> statement-breakpoint
CREATE TABLE "daily_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"study_date" date NOT NULL,
	"timezone" text NOT NULL,
	"target_minutes" integer NOT NULL,
	"planned_minutes" double precision NOT NULL,
	"planner_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "daily_sessions_target_allowed" CHECK ("daily_sessions"."target_minutes" in (5,10,20,30,45,60)),
	CONSTRAINT "daily_sessions_minutes_bounded" CHECK ("daily_sessions"."planned_minutes" > 0 and "daily_sessions"."planned_minutes" <= "daily_sessions"."target_minutes"),
	CONSTRAINT "daily_sessions_snapshot_valid" CHECK (length("daily_sessions"."timezone") between 1 and 100 and length("daily_sessions"."planner_version") between 1 and 80),
	CONSTRAINT "daily_sessions_completion_valid" CHECK ("daily_sessions"."completed_at" is null or "daily_sessions"."completed_at" >= "daily_sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "daily_session_items" ADD CONSTRAINT "daily_session_items_session_id_daily_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."daily_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_session_items" ADD CONSTRAINT "daily_session_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_session_items" ADD CONSTRAINT "daily_session_items_weakness_id_weakness_definitions_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "public"."weakness_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sessions" ADD CONSTRAINT "daily_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sessions" ADD CONSTRAINT "daily_sessions_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_items_position_unique" ON "daily_session_items" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_items_single_block_unique" ON "daily_session_items" USING btree ("session_id","kind") WHERE "daily_session_items"."kind" in ('review','lesson');--> statement-breakpoint
CREATE UNIQUE INDEX "daily_items_weakness_unique" ON "daily_session_items" USING btree ("session_id","weakness_id") WHERE "daily_session_items"."kind" = 'mistake';--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sessions_user_language_date_unique" ON "daily_sessions" USING btree ("user_id","language_code","study_date");
--> statement-breakpoint
-- Daily owns only its immutable plan and monotonically reconciled progress.
CREATE FUNCTION guard_daily_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'completed_at') IS DISTINCT FROM (to_jsonb(OLD) - 'completed_at')
    OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    RAISE EXCEPTION 'Daily session snapshots cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER daily_session_immutable BEFORE UPDATE ON daily_sessions
FOR EACH ROW EXECUTE FUNCTION guard_daily_session();
--> statement-breakpoint
CREATE FUNCTION guard_daily_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['completed_units','status','completed_at','unavailable_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['completed_units','status','completed_at','unavailable_at'])
    OR NEW.completed_units < OLD.completed_units
    OR (OLD.status <> 'pending' AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Daily targets and resolved progress cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER daily_item_immutable BEFORE UPDATE ON daily_session_items
FOR EACH ROW EXECUTE FUNCTION guard_daily_item();
--> statement-breakpoint
-- Deferred validation permits atomic parent + ordered item insertion.
CREATE FUNCTION check_daily_plan_totals() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  plan_id uuid;
  planned double precision;
  total double precision;
  tasks integer;
BEGIN
  IF TG_TABLE_NAME = 'daily_sessions' THEN plan_id := NEW.id;
  ELSE plan_id := COALESCE(NEW.session_id, OLD.session_id);
  END IF;
  SELECT planned_minutes INTO planned FROM daily_sessions WHERE id = plan_id;
  IF NOT FOUND THEN RETURN NULL; END IF; -- parent deletion cascades
  SELECT COALESCE(sum(estimated_minutes), 0), count(*) INTO total, tasks
    FROM daily_session_items WHERE session_id = plan_id;
  IF total <> planned OR tasks NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Daily task estimates must match the bounded plan';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER daily_session_totals AFTER INSERT ON daily_sessions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_daily_plan_totals();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER daily_item_totals AFTER INSERT OR UPDATE OR DELETE ON daily_session_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_daily_plan_totals();
