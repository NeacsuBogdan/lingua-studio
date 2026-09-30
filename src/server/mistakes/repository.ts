import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { getDb } from '../db/client';
import {
  activityWeaknesses,
  courses,
  courseLevels,
  languages,
  lessonActivities,
  lessons,
  mistakeOccurrences,
  mistakePracticeAttempts,
  units,
  users,
  weaknessDefinitions,
} from '../db/schema';
import {
  isExercise,
  learningActivitySchema,
  presentExercise,
} from '../../content/activity-schema';
import {
  exerciseAnswerSchema,
  type SavedResult,
} from '../../lib/exercise-answer';
import { evaluateExercise } from '../exercises/evaluate';

type Database = ReturnType<typeof getDb>;
export class MistakeError extends Error {
  constructor(public code: 'invalid' | 'unavailable' | 'stale') {
    super(code);
  }
}
export const practiceRequestSchema = z
  .object({
    weaknessId: z.string().min(1).max(120),
    activityId: z.string().min(1).max(120),
    contentVersion: z.number().int().positive(),
    submissionId: z.uuid(),
    answer: exerciseAnswerSchema,
  })
  .strict();

/** Count all assessed errors; a tied timestamp cannot establish recovery. */
export function attentionState(
  count: number,
  lastError: Date,
  lastSuccess: Date | null,
) {
  return lastSuccess && lastSuccess > lastError
    ? 'recovered'
    : count >= 2
      ? 'repeated'
      : 'needs practice';
}
export async function listWeaknesses(
  db: Database,
  userId: string,
  languageCode: string,
) {
  const lessonErrors = db
    .select({
      weaknessId: mistakeOccurrences.weaknessId,
      total: sql<number>`count(*)::integer`.as('total'),
      firstSeen: sql<string>`min(${mistakeOccurrences.createdAt})`.as(
        'first_seen',
      ),
      lastSeen: sql<string>`max(${mistakeOccurrences.createdAt})`.as(
        'last_seen',
      ),
    })
    .from(mistakeOccurrences)
    .where(eq(mistakeOccurrences.userId, userId))
    .groupBy(mistakeOccurrences.weaknessId)
    .as('lesson_errors');
  const practice = db
    .select({
      weaknessId: mistakePracticeAttempts.weaknessId,
      total: sql<number>`count(*)::integer`.as('practice_total'),
      errors:
        sql<number>`count(*) filter (where not ${mistakePracticeAttempts.isCorrect})::integer`.as(
          'practice_errors',
        ),
      lastError: sql<
        string | null
      >`max(${mistakePracticeAttempts.createdAt}) filter (where not ${mistakePracticeAttempts.isCorrect})`.as(
        'last_error',
      ),
      lastSuccess: sql<
        string | null
      >`max(${mistakePracticeAttempts.createdAt}) filter (where ${mistakePracticeAttempts.isCorrect})`.as(
        'last_success',
      ),
    })
    .from(mistakePracticeAttempts)
    .where(eq(mistakePracticeAttempts.userId, userId))
    .groupBy(mistakePracticeAttempts.weaknessId)
    .as('practice');
  const rows = await db
    .select({
      definition: weaknessDefinitions,
      lessonCount: lessonErrors.total,
      firstSeen: lessonErrors.firstSeen,
      lastSeen: lessonErrors.lastSeen,
      practiceCount: practice.total,
      practiceErrors: practice.errors,
      lastPracticeError: practice.lastError,
      lastSuccess: practice.lastSuccess,
    })
    .from(weaknessDefinitions)
    .innerJoin(
      lessonErrors,
      eq(lessonErrors.weaknessId, weaknessDefinitions.id),
    )
    .leftJoin(practice, eq(practice.weaknessId, weaknessDefinitions.id))
    .where(eq(weaknessDefinitions.languageCode, languageCode));
  return rows
    .map((r) => {
      const recurrence = r.lessonCount + (r.practiceErrors ?? 0);
      const lastSeen = new Date(
        Math.max(
          new Date(r.lastSeen).getTime(),
          r.lastPracticeError ? new Date(r.lastPracticeError).getTime() : 0,
        ),
      );
      const lastSuccess = r.lastSuccess ? new Date(r.lastSuccess) : null;
      return {
        ...r.definition,
        recurrence,
        lessonCount: r.lessonCount,
        practiceCount: r.practiceCount ?? 0,
        practiceErrors: r.practiceErrors ?? 0,
        firstSeen: new Date(r.firstSeen),
        lastSeen,
        lastSuccess,
        status: attentionState(recurrence, lastSeen, lastSuccess),
      };
    })
    .sort(
      (a, b) =>
        b.lastSeen.getTime() - a.lastSeen.getTime() || a.id.localeCompare(b.id),
    );
}

/** Recent means the newest 20 recorded errors, not an arbitrary time window. */
export async function recentMistakes(
  db: Database,
  userId: string,
  languageCode: string,
  weaknessId?: string,
) {
  const rows = await db.execute(sql`
    select e.*, w.label, l.title as lesson_title, a.prompt, a.payload, a.type, l.content_version as current_version
    from (
      select o.id, o.weakness_id, x.activity_id, x.content_version, o.created_at, x.submitted_answer, x.result, 'lesson' as source
      from mistake_occurrences o join exercise_attempts x on x.id = o.attempt_id and x.user_id = o.user_id
      where o.user_id = ${userId}::uuid
      union all
      select p.id, p.weakness_id, p.activity_id, p.content_version, p.created_at, p.submitted_answer, p.result, 'corrective practice' as source
      from mistake_practice_attempts p where p.user_id = ${userId}::uuid and not p.is_correct
    ) e join weakness_definitions w on w.id = e.weakness_id
    join lesson_activities a on a.id = e.activity_id join lessons l on l.id = a.lesson_id
    where w.language_code = ${languageCode} ${weaknessId ? sql`and w.id = ${weaknessId}` : sql``}
    order by e.created_at desc, e.id desc limit 20
  `);
  return (Array.isArray(rows)
    ? rows
    : (rows as unknown as { rows: unknown[] })
        .rows) as unknown as MistakeHistory[];
}
export type MistakeHistory = {
  id: string;
  weakness_id: string;
  label: string;
  lesson_title: string;
  prompt: string;
  activity_id: string;
  content_version: number;
  current_version: number;
  created_at: string | Date;
  submitted_answer: z.infer<typeof exerciseAnswerSchema>;
  result: Omit<SavedResult, 'attemptId'>;
  payload: Record<string, unknown>;
  type: string;
  source: string;
};

export async function practiceHistory(
  db: Database,
  userId: string,
  weaknessId: string,
) {
  return db
    .select()
    .from(mistakePracticeAttempts)
    .where(
      and(
        eq(mistakePracticeAttempts.userId, userId),
        eq(mistakePracticeAttempts.weaknessId, weaknessId),
      ),
    )
    .orderBy(
      desc(mistakePracticeAttempts.createdAt),
      desc(mistakePracticeAttempts.id),
    )
    .limit(20);
}

async function currentPractice(
  db: Database,
  userId: string,
  languageCode: string,
  weaknessId: string,
) {
  const [owned] = await db
    .select({ id: mistakeOccurrences.id })
    .from(mistakeOccurrences)
    .where(
      and(
        eq(mistakeOccurrences.userId, userId),
        eq(mistakeOccurrences.weaknessId, weaknessId),
      ),
    )
    .limit(1);
  if (!owned) throw new MistakeError('unavailable');
  const [row] = await db
    .select({
      activity: lessonActivities,
      version: lessons.contentVersion,
      label: weaknessDefinitions.label,
    })
    .from(activityWeaknesses)
    .innerJoin(
      weaknessDefinitions,
      eq(activityWeaknesses.weaknessId, weaknessDefinitions.id),
    )
    .innerJoin(
      lessonActivities,
      eq(activityWeaknesses.activityId, lessonActivities.id),
    )
    .innerJoin(lessons, eq(lessonActivities.lessonId, lessons.id))
    .innerJoin(units, eq(lessons.unitId, units.id))
    .innerJoin(courseLevels, eq(units.courseLevelId, courseLevels.id))
    .innerJoin(courses, eq(courseLevels.courseId, courses.id))
    .innerJoin(languages, eq(courses.languageCode, languages.code))
    .where(
      and(
        eq(activityWeaknesses.weaknessId, weaknessId),
        eq(activityWeaknesses.isPublished, true),
        eq(activityWeaknesses.contentVersion, lessons.contentVersion),
        eq(weaknessDefinitions.isPublished, true),
        eq(weaknessDefinitions.languageCode, languageCode),
        eq(courses.languageCode, languageCode),
        eq(languages.isActive, true),
      ),
    )
    .orderBy(
      asc(courseLevels.sortOrder),
      asc(units.sortOrder),
      asc(lessons.sortOrder),
      asc(lessonActivities.sortOrder),
      asc(lessonActivities.id),
    )
    .limit(1);
  if (!row) throw new MistakeError('unavailable');
  const { lessonId: _lessonId, sortOrder, ...fields } = row.activity;
  void _lessonId;
  const parsed = learningActivitySchema.safeParse({
    ...fields,
    order: sortOrder,
  });
  if (!parsed.success || !isExercise(parsed.data))
    throw new MistakeError('unavailable');
  return {
    activity: parsed.data,
    contentVersion: row.version,
    label: row.label,
  };
}
export async function getMistakePractice(
  db: Database,
  userId: string,
  languageCode: string,
  weaknessId: string,
) {
  const current = await currentPractice(db, userId, languageCode, weaknessId);
  return { ...current, activity: presentExercise(current.activity) };
}
export async function submitMistakePractice(
  db: Database,
  userId: string,
  languageCode: string,
  raw: unknown,
  now: Date,
): Promise<SavedResult> {
  const parsed = practiceRequestSchema.safeParse(raw);
  if (!parsed.success) throw new MistakeError('invalid');
  const request = parsed.data;
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    // Shared content locks prevent publication changing the activity during grading.
    await tx
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(lessonActivities, eq(lessons.id, lessonActivities.lessonId))
      .where(eq(lessonActivities.id, request.activityId))
      .for('share');
    await tx
      .select()
      .from(activityWeaknesses)
      .innerJoin(
        weaknessDefinitions,
        eq(activityWeaknesses.weaknessId, weaknessDefinitions.id),
      )
      .where(eq(activityWeaknesses.weaknessId, request.weaknessId))
      .for('share');
    const current = await currentPractice(
      database,
      userId,
      languageCode,
      request.weaknessId,
    );
    const [existing] = await tx
      .select()
      .from(mistakePracticeAttempts)
      .where(
        and(
          eq(mistakePracticeAttempts.userId, userId),
          eq(mistakePracticeAttempts.submissionId, request.submissionId),
        ),
      );
    if (existing) {
      if (
        existing.weaknessId !== request.weaknessId ||
        existing.activityId !== request.activityId ||
        existing.contentVersion !== request.contentVersion ||
        JSON.stringify(exerciseAnswerSchema.parse(existing.submittedAnswer)) !==
          JSON.stringify(request.answer)
      )
        throw new MistakeError('invalid');
      return { ...existing.result, attemptId: existing.id };
    }
    if (
      current.activity.id !== request.activityId ||
      current.contentVersion !== request.contentVersion
    )
      throw new MistakeError('stale');
    const { answer, result } = evaluateExercise(
      current.activity,
      request.answer,
    );
    const [attempt] = await tx
      .insert(mistakePracticeAttempts)
      .values({
        userId,
        weaknessId: request.weaknessId,
        activityId: request.activityId,
        contentVersion: request.contentVersion,
        submissionId: request.submissionId,
        submittedAnswer: answer,
        result,
        isCorrect: result.isCorrect,
        score: result.score,
        createdAt: now,
      })
      .returning({ id: mistakePracticeAttempts.id });
    return { ...result, attemptId: attempt.id };
  });
}
