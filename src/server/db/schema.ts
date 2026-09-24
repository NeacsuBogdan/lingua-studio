import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  check,
  uniqueIndex,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const cefr = pgEnum('cefr', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const exam = pgEnum('cambridge_exam', [
  'b2-first',
  'c1-advanced',
  'c2-proficiency',
]);
export const languages = pgTable(
  'languages',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    nativeName: text('native_name').notNull().default(''),
    writingDirection: text('writing_direction').notNull().default('ltr'),
    isActive: boolean('is_active').notNull().default(false),
  },
  (t) => [
    check(
      'language_writing_direction',
      sql`${t.writingDirection} in ('ltr','rtl')`,
    ),
  ],
);
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull().default('Learner'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);
export const sessions = pgTable(
  'sessions',
  {
    id: text('id')
      .default(sql`gen_random_uuid()::text`)
      .primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('sessions_token_unique').on(t.token)],
);
export const accounts = pgTable(
  'accounts',
  {
    id: text('id')
      .default(sql`gen_random_uuid()::text`)
      .primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('accounts_provider_account_unique').on(
      t.providerId,
      t.accountId,
    ),
  ],
);
export const verifications = pgTable('verifications', {
  id: text('id')
    .default(sql`gen_random_uuid()::text`)
    .primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
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
    description: text('description').notNull().default(''),
    contentVersion: integer('content_version').notNull().default(1),
  },
  (t) => [check('content_version_positive', sql`${t.contentVersion} > 0`)],
);

export const courseLevels = pgTable(
  'course_levels',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    level: cefr('level').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    uniqueIndex('course_levels_course_level_unique').on(t.courseId, t.level),
    uniqueIndex('course_levels_course_order_unique').on(
      t.courseId,
      t.sortOrder,
    ),
    check('course_levels_order_positive', sql`${t.sortOrder} > 0`),
  ],
);

export const units = pgTable(
  'units',
  {
    id: text('id').primaryKey(),
    courseLevelId: text('course_level_id')
      .notNull()
      .references(() => courseLevels.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    uniqueIndex('units_level_order_unique').on(t.courseLevelId, t.sortOrder),
    check('units_order_positive', sql`${t.sortOrder} > 0`),
  ],
);

export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    skill: text('skill').notNull(),
    sortOrder: integer('sort_order').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    contentVersion: integer('content_version').notNull().default(1),
  },
  (t) => [
    uniqueIndex('lessons_unit_order_unique').on(t.unitId, t.sortOrder),
    check('lessons_order_positive', sql`${t.sortOrder} > 0`),
    check('lessons_minutes_positive', sql`${t.estimatedMinutes} > 0`),
    check('lessons_version_positive', sql`${t.contentVersion} > 0`),
  ],
);

export const lessonActivities = pgTable(
  'lesson_activities',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    sortOrder: integer('sort_order').notNull(),
    type: text('type').notNull(),
    instructions: text('instructions').notNull(),
    prompt: text('prompt').notNull(),
    explanation: text('explanation').notNull(),
    skill: text('skill').notNull(),
    level: cefr('level').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    uniqueIndex('lesson_activities_lesson_order_unique').on(
      t.lessonId,
      t.sortOrder,
    ),
    check('lesson_activities_order_positive', sql`${t.sortOrder} > 0`),
  ],
);

export const lessonPrerequisites = pgTable(
  'lesson_prerequisites',
  {
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    prerequisiteId: text('prerequisite_id')
      .notNull()
      .references(() => lessons.id),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.prerequisiteId] }),
    check(
      'lesson_prerequisite_not_self',
      sql`${t.lessonId} <> ${t.prerequisiteId}`,
    ),
  ],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    contentVersion: integer('content_version').notNull(),
    status: text('status').notNull().default('in_progress'),
    position: integer('position').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    check(
      'lesson_progress_status_allowed',
      sql`${t.status} in ('in_progress','completed')`,
    ),
    check('lesson_progress_position_nonnegative', sql`${t.position} >= 0`),
    check(
      'lesson_progress_completion_consistent',
      sql`(${t.status} = 'completed' and ${t.completedAt} is not null) or (${t.status} = 'in_progress' and ${t.completedAt} is null)`,
    ),
  ],
);
