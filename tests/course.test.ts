import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { isExercise } from '../src/content/activity-schema';
import { submitExercise } from '../src/server/exercises/repository';
import { correctAnswer } from './helpers/exercise';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { englishCatalog } from '../src/content/en/course';
import { courseCatalogSchema } from '../src/content/course-schema';
import { seedEnglishCourse } from '../src/server/course/seed';
import {
  advanceLesson,
  getCourseMap,
  getLessonView,
  startLesson,
} from '../src/server/course/repository';

const client = new PGlite();
const pgliteDb = drizzle(client, { schema });
const db = pgliteDb as unknown as ReturnType<typeof getDb>;
let firstUserId: string;
let secondUserId: string;

beforeAll(async () => {
  await migrate(pgliteDb, { migrationsFolder: 'drizzle' });
  await pgliteDb
    .insert(schema.languages)
    .values({ code: 'ro', name: 'Romanian' });
  await seedEnglishCourse(db);
  const [first] = await pgliteDb
    .insert(schema.users)
    .values({ email: 'course-first@example.test' })
    .returning();
  const [second] = await pgliteDb
    .insert(schema.users)
    .values({ email: 'course-second@example.test' })
    .returning();
  firstUserId = first.id;
  secondUserId = second.id;
  await pgliteDb.insert(schema.learnerProfiles).values({
    userId: firstUserId,
    nativeLanguage: 'ro',
    learningLanguage: 'en',
    dailyMinutes: 45,
  });
}, 30000);
afterAll(async () => {
  await client.close();
});

describe('English course publication', () => {
  it('validates every level, unit, lesson, activity and prerequisite', () => {
    expect(
      courseCatalogSchema
        .parse(englishCatalog)
        .course.levels.map((item) => item.cefr),
    ).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    const invalid = structuredClone(englishCatalog);
    invalid.course.levels[2].units[0].lessons[1].prerequisiteIds = [
      'missing-lesson',
    ];
    expect(courseCatalogSchema.safeParse(invalid).success).toBe(false);
    const duplicate = structuredClone(englishCatalog);
    duplicate.course.levels[2].units[0].lessons[1].order = 1;
    expect(courseCatalogSchema.safeParse(duplicate).success).toBe(false);
    const unexpected = structuredClone(englishCatalog);
    Object.assign(
      unexpected.course.levels[2].units[0].lessons[0].activities[0],
      { typo: 'unpublished field' },
    );
    expect(courseCatalogSchema.safeParse(unexpected).success).toBe(false);
  });
  it('seeds idempotently without touching a learner profile or progress', async () => {
    await seedEnglishCourse(db);
    expect(await pgliteDb.select().from(schema.courseLevels)).toHaveLength(6);
    expect(await pgliteDb.select().from(schema.units)).toHaveLength(3);
    expect(await pgliteDb.select().from(schema.lessons)).toHaveLength(5);
    expect(await pgliteDb.select().from(schema.lessonActivities)).toHaveLength(
      18,
    );
    const [profile] = await pgliteDb
      .select()
      .from(schema.learnerProfiles)
      .where(eq(schema.learnerProfiles.userId, firstUserId));
    expect(profile.dailyMinutes).toBe(45);
    const map = await getCourseMap(db, firstUserId, 'en');
    expect(map?.levels.map((item) => item.level)).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2',
    ]);
    expect(map?.levels[2].units.map((item) => item.title)).toEqual([
      'Time and meaning',
      'Everyday precision',
    ]);
    expect(map?.levels[2].units[0].lessons.map((item) => item.id)).toEqual([
      'en-b1-present-perfect',
      'en-b1-narrative',
    ]);
    expect(await getCourseMap(db, firstUserId, 'ja')).toBeNull();
  });
});

describe('server-side progression', () => {
  it('blocks direct access to prerequisites and binds progress to a user', async () => {
    await expect(
      startLesson(db, firstUserId, 'en-b1-narrative'),
    ).rejects.toMatchObject({ code: 'locked' });
    await expect(
      advanceLesson(db, firstUserId, 'en-b1-narrative', 0, 2),
    ).rejects.toMatchObject({ code: 'locked' });
    await expect(
      advanceLesson(db, firstUserId, 'en-b1-present-perfect', 0, 2),
    ).rejects.toMatchObject({ code: 'not_started' });
    const started = await startLesson(db, firstUserId, 'en-b1-present-perfect');
    expect(started).toMatchObject({
      status: 'in_progress',
      position: 0,
      contentVersion: 2,
    });
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(
      (await getLessonView(db, firstUserId, 'en', 'en-b1-present-perfect'))
        .activities,
    ).toHaveLength(5);
    expect(
      (await getCourseMap(db, firstUserId, 'en'))?.recommended?.state,
    ).toBe('in_progress');
    const advanced = await advanceLesson(
      db,
      firstUserId,
      'en-b1-present-perfect',
      0,
      2,
    );
    expect(advanced.position).toBe(1);
    await expect(
      advanceLesson(db, firstUserId, 'en-b1-present-perfect', 0, 2),
    ).rejects.toMatchObject({ code: 'stale' });
    let completed = advanced;
    const view = await getLessonView(
      db,
      firstUserId,
      'en',
      'en-b1-present-perfect',
    );
    for (let position = 1; position < view.activities.length; position++) {
      const activity = view.activities[position];
      if (isExercise(activity))
        await submitExercise(db, firstUserId, 'en', {
          submissionId: randomUUID(),
          lessonId: view.lesson.id,
          activityId: activity.id,
          contentVersion: 2,
          answer: correctAnswer(activity),
        });
      completed = await advanceLesson(
        db,
        firstUserId,
        view.lesson.id,
        position,
        2,
      );
    }
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect((await getCourseMap(db, firstUserId, 'en'))?.recommended?.id).toBe(
      'en-b1-narrative',
    );
    expect((await getCourseMap(db, secondUserId, 'en'))?.recommended?.id).toBe(
      'en-b1-present-perfect',
    );
    await expect(
      startLesson(db, secondUserId, 'en-b1-narrative'),
    ).rejects.toMatchObject({ code: 'locked' });
    expect(
      await advanceLesson(db, firstUserId, 'en-b1-present-perfect', 1, 2),
    ).toMatchObject({ status: 'completed', position: 5 });
    await seedEnglishCourse(db);
    const [saved] = await pgliteDb
      .select()
      .from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.userId, firstUserId));
    expect(saved.status).toBe('completed');
    expect(saved.completedAt?.getTime()).toBe(completed.completedAt?.getTime());
  });
  it('starts a revised lesson at its new content version without carrying over completion', async () => {
    await pgliteDb
      .update(schema.lessons)
      .set({ contentVersion: 3 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
    expect((await getCourseMap(db, firstUserId, 'en'))?.recommended?.id).toBe(
      'en-b1-present-perfect',
    );
    const restarted = await startLesson(
      db,
      firstUserId,
      'en-b1-present-perfect',
    );
    expect(restarted).toMatchObject({
      contentVersion: 3,
      status: 'in_progress',
      position: 0,
      completedAt: null,
    });
    await seedEnglishCourse(db);
    expect((await getCourseMap(db, firstUserId, 'en'))?.recommended?.id).toBe(
      'en-b1-present-perfect',
    );
  });
});
