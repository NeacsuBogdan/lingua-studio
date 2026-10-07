import { eq } from 'drizzle-orm';
import type { getDb } from '../db/client';
import { englishWeaknesses } from '../../content/en/weaknesses';
import { weaknessDefinitions, activityWeaknesses } from '../db/schema';

type Database = ReturnType<typeof getDb>;
export async function seedEnglishWeaknesses(db: Database) {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(weaknessDefinitions)
      .where(eq(weaknessDefinitions.languageCode, 'en'));
    if (
      existing.some(
        (w) => !englishWeaknesses.definitions.some((d) => d.id === w.id),
      )
    )
      throw new Error(
        'Removing weakness identities requires an explicit migration.',
      );
    for (const definition of englishWeaknesses.definitions)
      await tx
        .insert(weaknessDefinitions)
        .values(definition)
        .onConflictDoUpdate({
          target: weaknessDefinitions.id,
          set: definition,
        });
    // Retain every historical mapping for backfill, but publish only current authored targets.
    for (const definition of englishWeaknesses.definitions) {
      await tx
        .update(activityWeaknesses)
        .set({ isPublished: false })
        .where(eq(activityWeaknesses.weaknessId, definition.id));
    }
    for (const mapping of englishWeaknesses.mappings)
      await tx
        .insert(activityWeaknesses)
        .values(mapping)
        .onConflictDoUpdate({
          target: [
            activityWeaknesses.activityId,
            activityWeaknesses.contentVersion,
            activityWeaknesses.weaknessId,
          ],
          set: { isPublished: mapping.isPublished },
        });
  });
}
