CREATE TABLE "course_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"level" "cefr" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "course_levels_order_positive" CHECK ("course_levels"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"type" text NOT NULL,
	"instructions" text NOT NULL,
	"prompt" text NOT NULL,
	"explanation" text NOT NULL,
	"skill" text NOT NULL,
	"level" "cefr" NOT NULL,
	"tags" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "lesson_activities_order_positive" CHECK ("lesson_activities"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_prerequisites" (
	"lesson_id" text NOT NULL,
	"prerequisite_id" text NOT NULL,
	CONSTRAINT "lesson_prerequisites_lesson_id_prerequisite_id_pk" PRIMARY KEY("lesson_id","prerequisite_id"),
	CONSTRAINT "lesson_prerequisite_not_self" CHECK ("lesson_prerequisites"."lesson_id" <> "lesson_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id"),
	CONSTRAINT "lesson_progress_status_allowed" CHECK ("lesson_progress"."status" in ('in_progress','completed')),
	CONSTRAINT "lesson_progress_position_nonnegative" CHECK ("lesson_progress"."position" >= 0),
	CONSTRAINT "lesson_progress_completion_consistent" CHECK (("lesson_progress"."status" = 'completed' and "lesson_progress"."completed_at" is not null) or ("lesson_progress"."status" = 'in_progress' and "lesson_progress"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"skill" text NOT NULL,
	"sort_order" integer NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lessons_order_positive" CHECK ("lessons"."sort_order" > 0),
	CONSTRAINT "lessons_minutes_positive" CHECK ("lessons"."estimated_minutes" > 0),
	CONSTRAINT "lessons_version_positive" CHECK ("lessons"."content_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"course_level_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "units_order_positive" CHECK ("units"."sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "languages" ADD COLUMN "native_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "languages" ADD COLUMN "writing_direction" text DEFAULT 'ltr' NOT NULL;--> statement-breakpoint
ALTER TABLE "languages" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_levels" ADD CONSTRAINT "course_levels_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_activities" ADD CONSTRAINT "lesson_activities_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_prerequisite_id_lessons_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_course_level_id_course_levels_id_fk" FOREIGN KEY ("course_level_id") REFERENCES "public"."course_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_levels_course_level_unique" ON "course_levels" USING btree ("course_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "course_levels_course_order_unique" ON "course_levels" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_activities_lesson_order_unique" ON "lesson_activities" USING btree ("lesson_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_unit_order_unique" ON "lessons" USING btree ("unit_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "units_level_order_unique" ON "units" USING btree ("course_level_id","sort_order");--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "language_writing_direction" CHECK ("languages"."writing_direction" in ('ltr','rtl'));