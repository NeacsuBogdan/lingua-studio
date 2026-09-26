import { and, eq, inArray, asc, ne } from 'drizzle-orm';
import type { getDb } from '../db/client';
import {
  languages,
  courses,
  courseLevels,
  units,
  lessons,
  lessonActivities,
  lessonPrerequisites,
  lessonProgress,
  exerciseAttempts,
} from '../db/schema';
import { learningActivitySchema } from '../../content/course-schema';

type Database = ReturnType<typeof getDb>;
type LessonRow = typeof lessons.$inferSelect;
type ProgressRow = typeof lessonProgress.$inferSelect;
export type LessonState = 'locked' | 'available' | 'in_progress' | 'completed';

export class CourseError extends Error {
  constructor(
    public code:
      'not_found' | 'locked' | 'not_started' | 'stale' | 'answer_required',
  ) {
    super(code);
  }
}

export function lessonState(
  lesson: Pick<LessonRow, 'id' | 'contentVersion'>,
  prerequisites: string[],
  progress: Pick<ProgressRow, 'lessonId' | 'contentVersion' | 'status'>[],
  versionByLesson: Map<string, number>,
): LessonState {
  const current = progress.find(
    (row) =>
      row.lessonId === lesson.id &&
      row.contentVersion === lesson.contentVersion,
  );
  if (current?.status === 'completed') return 'completed';
  const unlocked = prerequisites.every((id) =>
    progress.some(
      (row) =>
        row.lessonId === id &&
        row.contentVersion === versionByLesson.get(id) &&
        row.status === 'completed',
    ),
  );
  if (!unlocked) return 'locked';
  return current?.status === 'in_progress' ? 'in_progress' : 'available';
}

export async function getCourseMap(
  db: Database,
  userId: string,
  languageCode: string,
) {
  const [language] = await db
    .select()
    .from(languages)
    .where(eq(languages.code, languageCode))
    .limit(1);
  if (!language?.isActive) return null;
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.languageCode, languageCode))
    .limit(1);
  if (!course) return null;
  const levelRows = await db
    .select()
    .from(courseLevels)
    .where(eq(courseLevels.courseId, course.id))
    .orderBy(asc(courseLevels.sortOrder));
  const unitRows = levelRows.length
    ? await db
        .select()
        .from(units)
        .where(
          inArray(
            units.courseLevelId,
            levelRows.map((row) => row.id),
          ),
        )
        .orderBy(asc(units.sortOrder))
    : [];
  const lessonRows = unitRows.length
    ? await db
        .select()
        .from(lessons)
        .where(
          inArray(
            lessons.unitId,
            unitRows.map((row) => row.id),
          ),
        )
        .orderBy(asc(lessons.sortOrder))
    : [];
  const ids = lessonRows.map((row) => row.id);
  const prerequisiteRows = ids.length
    ? await db
        .select()
        .from(lessonPrerequisites)
        .where(inArray(lessonPrerequisites.lessonId, ids))
    : [];
  const progressRows = ids.length
    ? await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            inArray(lessonProgress.lessonId, ids),
          ),
        )
    : [];
  const versions = new Map(
    lessonRows.map((row) => [row.id, row.contentVersion]),
  );
  const levels = levelRows.map((level) => ({
    ...level,
    units: unitRows
      .filter((unit) => unit.courseLevelId === level.id)
      .map((unit) => ({
        ...unit,
        lessons: lessonRows
          .filter((lesson) => lesson.unitId === unit.id)
          .map((lesson) => {
            const prerequisites = prerequisiteRows
              .filter((row) => row.lessonId === lesson.id)
              .map((row) => row.prerequisiteId);
            return {
              ...lesson,
              prerequisiteIds: prerequisites,
              state: lessonState(lesson, prerequisites, progressRows, versions),
              position:
                progressRows.find(
                  (row) =>
                    row.lessonId === lesson.id &&
                    row.contentVersion === lesson.contentVersion,
                )?.position ?? 0,
            };
          }),
      })),
  }));
  const orderedLessons = levels.flatMap((level) =>
    level.units.flatMap((unit) => unit.lessons),
  );
  const recommended =
    orderedLessons.find((lesson) => lesson.state === 'in_progress') ??
    orderedLessons.find((lesson) => lesson.state === 'available') ??
    null;
  const completedCount = orderedLessons.filter(
    (lesson) => lesson.state === 'completed',
  ).length;
  const currentLevel =
    levels.find((level) =>
      level.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.id === recommended?.id),
      ),
    )?.level ??
    (completedCount
      ? levels.findLast((level) =>
          level.units.some((unit) =>
            unit.lessons.some((lesson) => lesson.state === 'completed'),
          ),
        )?.level
      : null) ??
    null;
  return {
    language,
    course,
    levels,
    recommended,
    currentLevel,
    completedCount,
    lessonCount: orderedLessons.length,
  };
}

export async function getLessonView(
  db: Database,
  userId: string,
  languageCode: string,
  lessonId: string,
) {
  const map = await getCourseMap(db, userId, languageCode);
  const lesson = map?.levels
    .flatMap((level) => level.units.flatMap((unit) => unit.lessons))
    .find((item) => item.id === lessonId);
  if (!lesson) throw new CourseError('not_found');
  const blocks = await db
    .select()
    .from(lessonActivities)
    .where(eq(lessonActivities.lessonId, lessonId))
    .orderBy(asc(lessonActivities.sortOrder));
  if (!blocks.length) throw new CourseError('not_found');
  const activities = blocks.map((block) =>
    learningActivitySchema.parse({
      id: block.id,
      order: block.sortOrder,
      type: block.type,
      instructions: block.instructions,
      prompt: block.prompt,
      explanation: block.explanation,
      skill: block.skill,
      level: block.level,
      tags: block.tags,
      payload: block.payload,
    }),
  );
  return { lesson, activities };
}

async function gate(db: Database, userId: string, lessonId: string) {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new CourseError('not_found');
  const prerequisites = await db
    .select()
    .from(lessonPrerequisites)
    .where(eq(lessonPrerequisites.lessonId, lessonId));
  if (prerequisites.length) {
    const ids = prerequisites.map((row) => row.prerequisiteId);
    const requiredLessons = await db
      .select({ id: lessons.id, contentVersion: lessons.contentVersion })
      .from(lessons)
      .where(inArray(lessons.id, ids));
    const completed = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.lessonId, ids),
        ),
      );
    if (
      requiredLessons.length !== ids.length ||
      requiredLessons.some(
        (item) =>
          !completed.some(
            (row) =>
              row.lessonId === item.id &&
              row.contentVersion === item.contentVersion &&
              row.status === 'completed',
          ),
      )
    )
      throw new CourseError('locked');
  }
  return lesson;
}

export async function startLesson(
  db: Database,
  userId: string,
  lessonId: string,
) {
  const lesson = await gate(db, userId, lessonId);
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, contentVersion: lesson.contentVersion })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        contentVersion: lesson.contentVersion,
        status: 'in_progress',
        position: 0,
        startedAt: new Date(),
        completedAt: null,
      },
      setWhere: ne(lessonProgress.contentVersion, lesson.contentVersion),
    });
  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    )
    .limit(1);
  if (!progress || progress.contentVersion !== lesson.contentVersion)
    throw new CourseError('stale');
  return progress;
}

export async function advanceLesson(
  db: Database,
  userId: string,
  lessonId: string,
  expectedPosition: number,
  expectedVersion: number,
) {
  const lesson = await gate(db, userId, lessonId);
  if (lesson.contentVersion !== expectedVersion) throw new CourseError('stale');
  const blocks = await db
    .select({ id: lessonActivities.id, type: lessonActivities.type })
    .from(lessonActivities)
    .where(eq(lessonActivities.lessonId, lessonId))
    .orderBy(asc(lessonActivities.sortOrder));
  if (
    !blocks.length ||
    !Number.isInteger(expectedPosition) ||
    expectedPosition < 0 ||
    expectedPosition >= blocks.length
  )
    throw new CourseError('stale');
  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    )
    .limit(1);
  if (!progress || progress.contentVersion !== lesson.contentVersion)
    throw new CourseError('not_started');
  if (progress.status === 'completed') return progress;
  if (progress.position !== expectedPosition) throw new CourseError('stale');
  const block = blocks[expectedPosition];
  if (block.type !== 'explanation' && block.type !== 'reflection') {
    const [attempt] = await db
      .select({ id: exerciseAttempts.id })
      .from(exerciseAttempts)
      .where(
        and(
          eq(exerciseAttempts.userId, userId),
          eq(exerciseAttempts.activityId, block.id),
          eq(exerciseAttempts.contentVersion, lesson.contentVersion),
        ),
      )
      .limit(1);
    if (!attempt) throw new CourseError('answer_required');
  }
  const final = expectedPosition === blocks.length - 1;
  const [updated] = await db
    .update(lessonProgress)
    .set({
      position: expectedPosition + 1,
      status: final ? 'completed' : 'in_progress',
      completedAt: final ? new Date() : null,
    })
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.contentVersion, lesson.contentVersion),
        eq(lessonProgress.position, expectedPosition),
        eq(lessonProgress.status, 'in_progress'),
      ),
    )
    .returning();
  if (!updated) throw new CourseError('stale');
  return updated;
}
