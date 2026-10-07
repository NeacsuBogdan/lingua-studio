import { z } from 'zod';
import { isExercise, skillSchema } from './activity-schema';
import type { englishCatalog } from './en/course';

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
export const weaknessCatalogSchema = z
  .object({
    definitions: z
      .array(
        z
          .object({
            id,
            languageCode: z.string().min(2).max(20),
            skill: skillSchema,
            label: z.string().min(3).max(120),
            description: z.string().min(12).max(1000),
            isPublished: z.boolean(),
          })
          .strict(),
      )
      .min(1),
    mappings: z
      .array(
        z
          .object({
            activityId: id,
            weaknessId: id,
            contentVersion: z.number().int().positive(),
            isPublished: z.boolean(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export function validateWeaknessCatalog(
  raw: unknown,
  catalog: typeof englishCatalog,
) {
  const value = weaknessCatalogSchema.parse(raw);
  if (
    new Set(value.definitions.map((w) => w.id)).size !==
    value.definitions.length
  )
    throw new Error('Duplicate weakness IDs');
  const keys = value.mappings.map(
    (m) => `${m.activityId}:${m.contentVersion}:${m.weaknessId}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new Error('Duplicate weakness mappings');
  const activities = catalog.course.levels.flatMap((l) =>
    l.units.flatMap((u) =>
      u.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => ({
          activity,
          version: lesson.contentVersion,
        })),
      ),
    ),
  );
  for (const definition of value.definitions)
    if (definition.languageCode !== catalog.language.code)
      throw new Error('Invalid weakness language');
  for (const mapping of value.mappings) {
    const target = activities.find((a) => a.activity.id === mapping.activityId);
    const weakness = value.definitions.find((w) => w.id === mapping.weaknessId);
    if (
      !target ||
      !isExercise(target.activity) ||
      !weakness ||
      target.version !== mapping.contentVersion
    )
      throw new Error(
        'Weakness targets must reference a known graded activity and version',
      );
  }
  return value;
}
