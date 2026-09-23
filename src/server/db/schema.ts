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
    contentVersion: integer('content_version').notNull().default(1),
  },
  (t) => [check('content_version_positive', sql`${t.contentVersion} > 0`)],
);
