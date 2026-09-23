import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
  check,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const cefr = pgEnum('cefr', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const exam = pgEnum('cambridge_exam', [
  'b2-first',
  'c1-advanced',
  'c2-proficiency',
]);
export const languages = pgTable('languages', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
});
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);
export const learnerProfiles = pgTable(
  'learner_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    nativeLanguage: text('native_language')
      .notNull()
      .references(() => languages.code),
    learningLanguage: text('learning_language')
      .notNull()
      .references(() => languages.code),
    estimatedLevel: cefr('estimated_level'),
    targetLevel: cefr('target_level').notNull().default('C1'),
    targetExam: exam('target_exam'),
    dailyMinutes: integer('daily_minutes').notNull().default(20),
    timezone: text('timezone').notNull().default('Europe/Bucharest'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'daily_minutes_allowed',
      sql`${t.dailyMinutes} in (5,10,20,30,45,60)`,
    ),
  ],
);
export const courses = pgTable(
  'courses',
  {
    id: text('id').primaryKey(),
    languageCode: text('language_code')
      .notNull()
      .references(() => languages.code),
    title: text('title').notNull(),
    contentVersion: integer('content_version').notNull().default(1),
  },
  (t) => [check('content_version_positive', sql`${t.contentVersion} > 0`)],
);
