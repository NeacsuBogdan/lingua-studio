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
  real,
  doublePrecision,
  index,
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { LearningActivity } from '../../content/activity-schema';
import type { ExerciseAnswer, GradingResult } from '../../lib/exercise-answer';
export const weaknessDefinitions = pgTable(
  'weakness_definitions',
  {
    id: text('id').primaryKey(),
    languageCode: text('language_code')
      .notNull()
      .references(() => languages.code),
    skill: text('skill').notNull(),
    label: text('label').notNull(),
    description: text('description').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (t) => [
    check(
      'weakness_skill_allowed',
      sql`${t.skill} in ('grammar','vocabulary','reading','communication')`,
    ),
    index('weakness_language_idx').on(t.languageCode),
  ],
);
// Version-scoped mappings prevent future editorial changes reclassifying old answers.
export const activityWeaknesses = pgTable(
  'activity_weaknesses',
  {
    activityId: text('activity_id')
      .notNull()
      .references(() => lessonActivities.id),
    weaknessId: text('weakness_id')
      .notNull()
      .references(() => weaknessDefinitions.id),
    contentVersion: integer('content_version').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.contentVersion, t.weaknessId] }),
    index('activity_weakness_target_idx').on(t.weaknessId),
    check('activity_weakness_version_positive', sql`${t.contentVersion} > 0`),
  ],
);
export const mistakeOccurrences = pgTable(
  'mistake_occurrences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weaknessId: text('weakness_id')
      .notNull()
      .references(() => weaknessDefinitions.id),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => exerciseAttempts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('mistake_occurrence_source_unique').on(
      t.attemptId,
      t.weaknessId,
    ),
    index('mistake_occurrence_user_recent_idx').on(t.userId, t.createdAt),
    index('mistake_occurrence_user_weakness_idx').on(
      t.userId,
      t.weaknessId,
      t.createdAt,
    ),
  ],
);
export const mistakePracticeAttempts = pgTable(
  'mistake_practice_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weaknessId: text('weakness_id')
      .notNull()
      .references(() => weaknessDefinitions.id),
    activityId: text('activity_id')
      .notNull()
      .references(() => lessonActivities.id),
    contentVersion: integer('content_version').notNull(),
    submissionId: uuid('submission_id').notNull(),
    submittedAnswer: jsonb('submitted_answer')
      .$type<ExerciseAnswer>()
      .notNull(),
    result: jsonb('result').$type<GradingResult>().notNull(),
    isCorrect: boolean('is_correct').notNull(),
    score: real('score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('mistake_practice_submission_unique').on(
      t.userId,
      t.submissionId,
    ),
    index('mistake_practice_user_weakness_idx').on(
      t.userId,
      t.weaknessId,
      t.createdAt,
    ),
    check('mistake_practice_version_positive', sql`${t.contentVersion} > 0`),
    check(
      'mistake_practice_score_range',
      sql`${t.score} >= 0 and ${t.score} <= 1`,
    ),
    check(
      'mistake_practice_answer_object',
      sql`jsonb_typeof(${t.submittedAnswer}) = 'object'`,
    ),
  ],
);

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
    payload: jsonb('payload').$type<LearningActivity['payload']>().notNull(),
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

export const exerciseAttempts = pgTable(
  'exercise_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    activityId: text('activity_id')
      .notNull()
      .references(() => lessonActivities.id),
    contentVersion: integer('content_version').notNull(),
    submissionId: uuid('submission_id').notNull(),
    submittedAnswer: jsonb('submitted_answer')
      .$type<ExerciseAnswer>()
      .notNull(),
    result: jsonb('result').$type<GradingResult>().notNull(),
    isCorrect: boolean('is_correct').notNull(),
    score: real('score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('exercise_attempts_user_submission_unique').on(
      t.userId,
      t.submissionId,
    ),
    index('exercise_attempts_user_activity_version_idx').on(
      t.userId,
      t.activityId,
      t.contentVersion,
      t.createdAt,
    ),
    check('exercise_attempts_version_positive', sql`${t.contentVersion} > 0`),
    check(
      'exercise_attempts_score_range',
      sql`${t.score} >= 0 and ${t.score} <= 1`,
    ),
    check(
      'exercise_attempts_answer_object',
      sql`jsonb_typeof(${t.submittedAnswer}) = 'object'`,
    ),
  ],
);

// Editorial senses have stable identities independent of spelling or display form.
export const vocabularySenses = pgTable(
  'vocabulary_senses',
  {
    id: text('id').primaryKey(),
    languageCode: text('language_code')
      .notNull()
      .references(() => languages.code),
    lemma: text('lemma').notNull(),
    displayForm: text('display_form').notNull(),
    partOfSpeech: text('part_of_speech').notNull(),
    level: cefr('level').notNull(),
    definition: text('definition').notNull(),
    notes: text('notes'),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (t) => [
    index('vocabulary_senses_language_level_idx').on(t.languageCode, t.level),
    check(
      'vocabulary_senses_pos_allowed',
      sql`${t.partOfSpeech} in ('noun','verb','adjective','adverb','phrase')`,
    ),
  ],
);
export const vocabularyExamples = pgTable('vocabulary_examples', {
  id: text('id').primaryKey(),
  senseId: text('sense_id')
    .notNull()
    .references(() => vocabularySenses.id),
  sentence: text('sentence').notNull(),
  note: text('note'),
});
export const vocabularyTags = pgTable('vocabulary_tags', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
});
export const vocabularySenseTags = pgTable(
  'vocabulary_sense_tags',
  {
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => vocabularyTags.id),
  },
  (t) => [
    primaryKey({ columns: [t.senseId, t.tagId] }),
    index('vocabulary_sense_tags_tag_idx').on(t.tagId),
  ],
);
export const vocabularyFamilies = pgTable(
  'vocabulary_families',
  {
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    relatedSenseId: text('related_sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
  },
  (t) => [
    primaryKey({ columns: [t.senseId, t.relatedSenseId] }),
    check(
      'vocabulary_family_not_self',
      sql`${t.senseId} <> ${t.relatedSenseId}`,
    ),
  ],
);
export const vocabularyCollocations = pgTable('vocabulary_collocations', {
  id: text('id').primaryKey(),
  phrase: text('phrase').notNull(),
  note: text('note'),
  example: text('example').notNull(),
});
export const vocabularyCollocationSenses = pgTable(
  'vocabulary_collocation_senses',
  {
    collocationId: text('collocation_id')
      .notNull()
      .references(() => vocabularyCollocations.id),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
  },
  (t) => [primaryKey({ columns: [t.collocationId, t.senseId] })],
);
export const activityVocabulary = pgTable(
  'activity_vocabulary',
  {
    activityId: text('activity_id')
      .notNull()
      .references(() => lessonActivities.id),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    role: text('role').notNull(),
    targetKey: text('target_key'),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.senseId] }),
    index('activity_vocabulary_sense_idx').on(t.senseId),
    check(
      'activity_vocabulary_role_allowed',
      sql`${t.role} in ('introduces','practises','context')`,
    ),
  ],
);
export const userVocabulary = pgTable(
  'user_vocabulary',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    introducedAt: timestamp('introduced_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    savedAt: timestamp('saved_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.senseId] }),
    index('user_vocabulary_saved_idx').on(t.userId, t.savedAt),
  ],
);
export const vocabularyEvidence = pgTable(
  'vocabulary_evidence',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => exerciseAttempts.id, { onDelete: 'cascade' }),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isCorrect: boolean('is_correct').notNull(),
    score: real('score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.attemptId, t.senseId] }),
    index('vocabulary_evidence_user_sense_idx').on(
      t.userId,
      t.senseId,
      t.createdAt,
    ),
    check(
      'vocabulary_evidence_score_range',
      sql`${t.score} >= 0 and ${t.score} <= 1`,
    ),
  ],
);

// Review state belongs to one learner and one stable editorial sense.
export const reviewCards = pgTable(
  'review_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    kind: text('kind').notNull().default('recognition'),
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    elapsedDays: doublePrecision('elapsed_days').notNull(),
    scheduledDays: doublePrecision('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    state: integer('state').notNull(),
    lastReview: timestamp('last_review', { withTimezone: true }),
    revision: integer('revision').notNull().default(0),
    schedulerVersion: text('scheduler_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('review_cards_user_sense_kind_unique').on(
      t.userId,
      t.senseId,
      t.kind,
    ),
    index('review_cards_user_due_idx').on(t.userId, t.due),
    check('review_cards_kind_allowed', sql`${t.kind} = 'recognition'`),
    check('review_cards_state_allowed', sql`${t.state} between 0 and 3`),
    check(
      'review_cards_counts_nonnegative',
      sql`${t.revision} >= 0 and ${t.reps} >= 0 and ${t.lapses} >= 0 and ${t.learningSteps} >= 0`,
    ),
  ],
);

export const reviewSessions = pgTable(
  'review_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    languageCode: text('language_code')
      .notNull()
      .references(() => languages.code),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('review_sessions_user_status_idx').on(t.userId, t.status),
    uniqueIndex('review_sessions_one_active_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
    check(
      'review_sessions_status_allowed',
      sql`${t.status} in ('active','completed')`,
    ),
    check(
      'review_sessions_completion_consistent',
      sql`(${t.status} = 'active' and ${t.completedAt} is null) or (${t.status} = 'completed' and ${t.completedAt} is not null)`,
    ),
  ],
);

export const reviewSessionItems = pgTable(
  'review_session_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => reviewSessions.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => reviewCards.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    status: text('status').notNull().default('pending'),
    expectedRevision: integer('expected_revision').notNull(),
  },
  (t) => [
    uniqueIndex('review_session_items_position_unique').on(
      t.sessionId,
      t.position,
    ),
    uniqueIndex('review_session_items_card_unique').on(t.sessionId, t.cardId),
    check('review_session_items_position_positive', sql`${t.position} > 0`),
    check(
      'review_session_items_status_allowed',
      sql`${t.status} in ('pending','reviewed','stale')`,
    ),
  ],
);

export const reviewHistory = pgTable(
  'review_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => reviewCards.id, { onDelete: 'cascade' }),
    senseId: text('sense_id')
      .notNull()
      .references(() => vocabularySenses.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => reviewSessions.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => reviewSessionItems.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id').notNull(),
    rating: integer('rating').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
    beforeDue: timestamp('before_due', { withTimezone: true }).notNull(),
    afterDue: timestamp('after_due', { withTimezone: true }).notNull(),
    beforeState: integer('before_state').notNull(),
    afterState: integer('after_state').notNull(),
    beforeStability: doublePrecision('before_stability').notNull(),
    afterStability: doublePrecision('after_stability').notNull(),
    beforeDifficulty: doublePrecision('before_difficulty').notNull(),
    afterDifficulty: doublePrecision('after_difficulty').notNull(),
    scheduledDays: doublePrecision('scheduled_days').notNull(),
    schedulerVersion: text('scheduler_version').notNull(),
  },
  (t) => [
    uniqueIndex('review_history_user_submission_unique').on(
      t.userId,
      t.submissionId,
    ),
    uniqueIndex('review_history_item_unique').on(t.itemId),
    index('review_history_user_reviewed_idx').on(t.userId, t.reviewedAt),
    index('review_history_card_reviewed_idx').on(t.cardId, t.reviewedAt),
    check('review_history_rating_allowed', sql`${t.rating} between 1 and 4`),
  ],
);

export const dailySessions = pgTable(
  'daily_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    languageCode: text('language_code')
      .notNull()
      .references(() => languages.code),
    studyDate: date('study_date', { mode: 'string' }).notNull(),
    timezone: text('timezone').notNull(),
    targetMinutes: integer('target_minutes').notNull(),
    plannedMinutes: doublePrecision('planned_minutes').notNull(),
    plannerVersion: text('planner_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('daily_sessions_user_language_date_unique').on(
      t.userId,
      t.languageCode,
      t.studyDate,
    ),
    check(
      'daily_sessions_target_allowed',
      sql`${t.targetMinutes} in (5,10,20,30,45,60)`,
    ),
    check(
      'daily_sessions_minutes_bounded',
      sql`${t.plannedMinutes} > 0 and ${t.plannedMinutes} <= ${t.targetMinutes}`,
    ),
    check(
      'daily_sessions_snapshot_valid',
      sql`length(${t.timezone}) between 1 and 100 and length(${t.plannerVersion}) between 1 and 80`,
    ),
    check(
      'daily_sessions_completion_valid',
      sql`${t.completedAt} is null or ${t.completedAt} >= ${t.createdAt}`,
    ),
  ],
);

export const dailySessionItems = pgTable(
  'daily_session_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => dailySessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    focus: jsonb('focus').$type<string[]>().notNull(),
    estimatedMinutes: doublePrecision('estimated_minutes').notNull(),
    targetCount: integer('target_count').notNull(),
    baselineCount: integer('baseline_count').notNull().default(0),
    completedUnits: integer('completed_units').notNull().default(0),
    status: text('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
    lessonId: text('lesson_id').references(() => lessons.id),
    lessonContentVersion: integer('lesson_content_version'),
    startPosition: integer('start_position'),
    targetPosition: integer('target_position'),
    weaknessId: text('weakness_id').references(() => weaknessDefinitions.id),
  },
  (t) => [
    uniqueIndex('daily_items_position_unique').on(t.sessionId, t.position),
    uniqueIndex('daily_items_single_block_unique')
      .on(t.sessionId, t.kind)
      .where(sql`${t.kind} in ('review','lesson')`),
    uniqueIndex('daily_items_weakness_unique')
      .on(t.sessionId, t.weaknessId)
      .where(sql`${t.kind} = 'mistake'`),
    check(
      'daily_items_counts_valid',
      sql`${t.position} > 0 and ${t.estimatedMinutes} > 0 and ${t.targetCount} > 0 and ${t.baselineCount} >= 0 and ${t.completedUnits} between 0 and ${t.targetCount}`,
    ),
    check(
      'daily_items_status_consistent',
      sql`(${t.status} = 'pending' and ${t.completedAt} is null and ${t.unavailableAt} is null) or (${t.status} = 'completed' and ${t.completedAt} is not null and ${t.unavailableAt} is null and ${t.completedUnits} = ${t.targetCount}) or (${t.status} = 'unavailable' and ${t.completedAt} is null and ${t.unavailableAt} is not null)`,
    ),
    check(
      'daily_items_source_consistent',
      sql`(${t.kind} = 'review' and ${t.targetCount} <= 20 and ${t.lessonId} is null and ${t.lessonContentVersion} is null and ${t.startPosition} is null and ${t.targetPosition} is null and ${t.weaknessId} is null) or (${t.kind} = 'lesson' and ${t.lessonId} is not null and ${t.lessonContentVersion} is not null and ${t.startPosition} is not null and ${t.targetPosition} is not null and ${t.lessonContentVersion} > 0 and ${t.startPosition} >= 0 and ${t.targetPosition} > ${t.startPosition} and ${t.targetCount} = ${t.targetPosition} - ${t.startPosition} and ${t.weaknessId} is null) or (${t.kind} = 'mistake' and ${t.weaknessId} is not null and ${t.targetCount} = 1 and ${t.lessonId} is null and ${t.lessonContentVersion} is null and ${t.startPosition} is null and ${t.targetPosition} is null)`,
    ),
  ],
);
