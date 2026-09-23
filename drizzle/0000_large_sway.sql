CREATE TYPE "public"."cefr" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."cambridge_exam" AS ENUM('b2-first', 'c1-advanced', 'c2-proficiency');--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"language_code" text NOT NULL,
	"title" text NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "content_version_positive" CHECK ("courses"."content_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"native_language" text NOT NULL,
	"learning_language" text NOT NULL,
	"estimated_level" "cefr",
	"target_level" "cefr" DEFAULT 'C1' NOT NULL,
	"target_exam" "cambridge_exam",
	"daily_minutes" integer DEFAULT 20 NOT NULL,
	"timezone" text DEFAULT 'Europe/Bucharest' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_minutes_allowed" CHECK ("learner_profiles"."daily_minutes" in (5,10,20,30,45,60))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_native_language_languages_code_fk" FOREIGN KEY ("native_language") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_learning_language_languages_code_fk" FOREIGN KEY ("learning_language") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));