import { and, desc, eq } from 'drizzle-orm';
import type { getDb } from '../db/client';
import { exerciseAttempts, lessons, lessonProgress } from '../db/schema';
import { getLessonView } from '../course/repository';
import { isExercise } from '../../content/activity-schema';
import {
  attemptRequestSchema,
  exerciseAnswerSchema,
  type SavedResult,
  type ExerciseAnswer,
} from '../../lib/exercise-answer';
import { evaluateExercise } from './evaluate';

type Database = ReturnType<typeof getDb>;
export class AttemptError extends Error {
  constructor(public code: 'invalid' | 'stale' | 'not_current') {
    super(code);
  }
}
export async function latestAttempt(
  db: Database,
  userId: string,
  activityId: string,
  contentVersion: number,
): Promise<{ answer: ExerciseAnswer; result: SavedResult } | null> {
  const [row] = await db
    .select({
      id: exerciseAttempts.id,
      result: exerciseAttempts.result,
      answer: exerciseAttempts.submittedAnswer,
    })
    .from(exerciseAttempts)
    .where(
      and(
        eq(exerciseAttempts.userId, userId),
        eq(exerciseAttempts.activityId, activityId),
        eq(exerciseAttempts.contentVersion, contentVersion),
      ),
    )
    .orderBy(desc(exerciseAttempts.createdAt), desc(exerciseAttempts.id))
    .limit(1);
  return row
    ? { answer: row.answer, result: { ...row.result, attemptId: row.id } }
    : null;
}

/** Identity comes from the authenticated caller, never from the strict request body. */
export async function submitExercise(
  db: Database,
  userId: string,
  languageCode: string,
  raw: unknown,
): Promise<SavedResult> {
  const parsed = attemptRequestSchema.safeParse(raw);
  if (!parsed.success) throw new AttemptError('invalid');
  const request = parsed.data;
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const [lesson] = await tx
      .select()
      .from(lessons)
      .where(eq(lessons.id, request.lessonId))
      .for('share');
    if (!lesson || lesson.contentVersion !== request.contentVersion)
      throw new AttemptError('stale');
    const view = await getLessonView(
      database,
      userId,
      languageCode,
      request.lessonId,
    );
    if (view.lesson.state === 'locked') throw new AttemptError('not_current');
    const [progress] = await tx
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, request.lessonId),
        ),
      )
      .for('update');
    const [existing] = await tx
      .select()
      .from(exerciseAttempts)
      .where(
        and(
          eq(exerciseAttempts.userId, userId),
          eq(exerciseAttempts.submissionId, request.submissionId),
        ),
      )
      .limit(1);
    if (existing) {
      const storedAnswer = exerciseAnswerSchema.safeParse(
        existing.submittedAnswer,
      );
      if (
        existing.lessonId !== request.lessonId ||
        existing.activityId !== request.activityId ||
        existing.contentVersion !== request.contentVersion ||
        !storedAnswer.success ||
        JSON.stringify(storedAnswer.data) !== JSON.stringify(request.answer)
      )
        throw new AttemptError('invalid');
      return { ...existing.result, attemptId: existing.id };
    }
    const activity = view.activities[progress?.position ?? -1];
    if (
      !progress ||
      progress.status !== 'in_progress' ||
      progress.contentVersion !== request.contentVersion ||
      !activity ||
      activity.id !== request.activityId ||
      !isExercise(activity)
    )
      throw new AttemptError('not_current');
    const { answer, result } = evaluateExercise(activity, request.answer);
    const [attempt] = await tx
      .insert(exerciseAttempts)
      .values({
        userId,
        lessonId: request.lessonId,
        activityId: activity.id,
        contentVersion: request.contentVersion,
        submissionId: request.submissionId,
        submittedAnswer: answer,
        result,
        isCorrect: result.isCorrect,
        score: result.score,
      })
      .returning({ id: exerciseAttempts.id });
    return { ...result, attemptId: attempt.id };
  });
}
