import { englishCatalog } from '../../content/en/course';
import {
  languages,
  courses,
  courseLevels,
  units,
  lessons,
  lessonActivities,
  lessonPrerequisites,
} from '../db/schema';
import type { getDb } from '../db/client';
import { eq, sql } from 'drizzle-orm';

type Database = ReturnType<typeof getDb>;

/** Upserts only catalog rows. Learner, auth and progress rows are never touched. */
export async function seedEnglishCourse(db: Database) {
  const { language, course } = englishCatalog;
  await db.transaction(async (tx) => {
    await tx
      .insert(languages)
      .values(language)
      .onConflictDoUpdate({
        target: languages.code,
        set: {
          name: language.name,
          nativeName: language.nativeName,
          writingDirection: language.writingDirection,
          isActive: language.isActive,
        },
      });
    await tx
      .insert(courses)
      .values({
        id: course.id,
        languageCode: course.languageCode,
        title: course.title,
        description: course.description,
        contentVersion: course.contentVersion,
      })
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          title: course.title,
          description: course.description,
          contentVersion: course.contentVersion,
        },
      });
    for (const level of course.levels) {
      await tx
        .insert(courseLevels)
        .values({
          id: level.id,
          courseId: course.id,
          level: level.cefr,
          title: level.title,
          description: level.description,
          sortOrder: level.order,
        })
        .onConflictDoUpdate({
          target: courseLevels.id,
          set: {
            title: level.title,
            description: level.description,
            sortOrder: level.order,
          },
        });
      for (const unit of level.units) {
        await tx
          .insert(units)
          .values({
            id: unit.id,
            courseLevelId: level.id,
            title: unit.title,
            description: unit.description,
            sortOrder: unit.order,
          })
          .onConflictDoUpdate({
            target: units.id,
            set: {
              title: unit.title,
              description: unit.description,
              sortOrder: unit.order,
            },
          });
        for (const lesson of unit.lessons) {
          await tx
            .insert(lessons)
            .values({
              id: lesson.id,
              unitId: unit.id,
              title: lesson.title,
              summary: lesson.summary,
              skill: lesson.skill,
              sortOrder: lesson.order,
              estimatedMinutes: lesson.estimatedMinutes,
              contentVersion: lesson.contentVersion,
            })
            .onConflictDoUpdate({
              target: lessons.id,
              set: {
                title: lesson.title,
                summary: lesson.summary,
                skill: lesson.skill,
                sortOrder: lesson.order,
                estimatedMinutes: lesson.estimatedMinutes,
                contentVersion: lesson.contentVersion,
              },
            });
          const existing = await tx
            .select({ id: lessonActivities.id })
            .from(lessonActivities)
            .where(eq(lessonActivities.lessonId, lesson.id));
          if (
            existing.some(
              (row) => !lesson.activities.some((block) => block.id === row.id),
            )
          )
            throw new Error(
              'Removing published activity IDs requires an explicit migration.',
            );
          // Make room for reordered blocks before inserting new exercise IDs.
          await tx
            .update(lessonActivities)
            .set({ sortOrder: sql`${lessonActivities.sortOrder} + 10000` })
            .where(eq(lessonActivities.lessonId, lesson.id));
          for (const block of lesson.activities) {
            await tx
              .insert(lessonActivities)
              .values({
                id: block.id,
                lessonId: lesson.id,
                sortOrder: block.order,
                type: block.type,
                instructions: block.instructions,
                prompt: block.prompt,
                explanation: block.explanation,
                skill: block.skill,
                level: block.level,
                tags: block.tags,
                payload: block.payload,
              })
              .onConflictDoUpdate({
                target: lessonActivities.id,
                set: {
                  sortOrder: block.order,
                  type: block.type,
                  instructions: block.instructions,
                  prompt: block.prompt,
                  explanation: block.explanation,
                  skill: block.skill,
                  level: block.level,
                  tags: block.tags,
                  payload: block.payload,
                },
              });
          }
        }
      }
    }
    for (const level of course.levels)
      for (const unit of level.units)
        for (const lesson of unit.lessons) {
          for (const prerequisiteId of lesson.prerequisiteIds) {
            await tx
              .insert(lessonPrerequisites)
              .values({
                lessonId: lesson.id,
                prerequisiteId,
              })
              .onConflictDoNothing();
          }
        }
  });
}
