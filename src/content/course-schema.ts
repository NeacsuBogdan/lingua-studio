import { z } from 'zod';
import { cefrSchema } from './schema';
import {
  learningActivitySchema as activity,
  skillSchema,
} from './activity-schema';
export { learningActivitySchema } from './activity-schema';
export type { LearningActivity } from './activity-schema';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const order = z.number().int().positive();
const languageCode = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);
const lesson = z
  .object({
    id,
    order,
    title: z.string().min(5),
    summary: z.string().min(15),
    skill: skillSchema,
    estimatedMinutes: z.number().int().min(2).max(60),
    contentVersion: z.number().int().positive(),
    prerequisiteIds: z.array(id),
    activities: z.array(activity).min(2),
  })
  .strict();
const unit = z
  .object({
    id,
    order,
    title: z.string().min(4),
    description: z.string().min(12),
    lessons: z.array(lesson),
  })
  .strict();
const level = z
  .object({
    id,
    order,
    cefr: cefrSchema,
    title: z.string().min(4),
    description: z.string().min(12),
    units: z.array(unit),
  })
  .strict();
export const courseCatalogSchema = z
  .object({
    schemaVersion: z.literal(2),
    language: z
      .object({
        code: languageCode,
        name: z.string().min(2),
        nativeName: z.string().min(2),
        writingDirection: z.enum(['ltr', 'rtl']),
        isActive: z.boolean(),
      })
      .strict(),
    course: z
      .object({
        id,
        languageCode,
        title: z.string().min(5),
        description: z.string().min(12),
        contentVersion: z.number().int().positive(),
        levels: z.array(level).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (catalog.course.languageCode !== catalog.language.code)
      fail('Course language must match the language definition');
    const seen = new Set<string>();
    const lessonPositions = new Map<string, number>();
    const lessons: z.infer<typeof lesson>[] = [];
    const ordered = (items: { id: string; order: number }[], scope: string) => {
      const orders = items.map((item) => item.order).sort((a, b) => a - b);
      if (orders.some((value, index) => value !== index + 1))
        fail(`${scope} must have consecutive ordering from 1`);
      for (const item of items) {
        if (seen.has(item.id)) fail(`Duplicate content ID: ${item.id}`);
        seen.add(item.id);
      }
    };
    ordered(catalog.course.levels, 'Levels');
    if (
      new Set(catalog.course.levels.map((item) => item.cefr)).size !==
      catalog.course.levels.length
    )
      fail('Duplicate CEFR level');
    const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const sortedLevels = [...catalog.course.levels].sort(
      (a, b) => a.order - b.order,
    );
    if (
      sortedLevels.some(
        (item, index) =>
          index > 0 &&
          cefrOrder.indexOf(item.cefr) <=
            cefrOrder.indexOf(sortedLevels[index - 1].cefr),
      )
    )
      fail('CEFR levels must follow ascending order');
    for (const courseLevel of catalog.course.levels) {
      ordered(courseLevel.units, `Units in ${courseLevel.id}`);
      for (const courseUnit of courseLevel.units) {
        ordered(courseUnit.lessons, `Lessons in ${courseUnit.id}`);
        for (const item of courseUnit.lessons) {
          lessonPositions.set(item.id, lessonPositions.size);
          lessons.push(item);
          ordered(item.activities, `Activities in ${item.id}`);
          if (item.activities.some((block) => block.level !== courseLevel.cefr))
            fail(`Activity level differs from ${item.id}`);
        }
      }
    }
    for (const item of lessons) {
      if (new Set(item.prerequisiteIds).size !== item.prerequisiteIds.length)
        fail(`Duplicate prerequisite in ${item.id}`);
      for (const dependency of item.prerequisiteIds) {
        const dependencyPosition = lessonPositions.get(dependency);
        if (
          dependencyPosition === undefined ||
          dependencyPosition >= lessonPositions.get(item.id)!
        )
          fail(
            `Prerequisite ${dependency} must be an earlier lesson of ${item.id}`,
          );
      }
    }
    if (
      lessons.length &&
      !lessons.some((item) => item.prerequisiteIds.length === 0)
    )
      fail('At least one lesson must be initially available');
  });

export type CourseCatalog = z.infer<typeof courseCatalogSchema>;
