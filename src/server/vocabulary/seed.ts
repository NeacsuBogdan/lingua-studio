import { eq } from 'drizzle-orm';
import type { getDb } from '../db/client';
import { englishVocabulary } from '../../content/en/vocabulary';
import {
  vocabularySenses,
  vocabularyExamples,
  vocabularyTags,
  vocabularySenseTags,
  vocabularyFamilies,
  vocabularyCollocations,
  vocabularyCollocationSenses,
  activityVocabulary,
} from '../db/schema';

type Database = ReturnType<typeof getDb>;
/** Additive publication. Existing user state and evidence are never rewritten. */
export async function seedEnglishVocabulary(db: Database) {
  const catalog = englishVocabulary;
  await db.transaction(async (tx) => {
    const published = await tx
      .select({ id: vocabularySenses.id })
      .from(vocabularySenses)
      .where(eq(vocabularySenses.languageCode, 'en'));
    if (
      published.some(
        (row) => !catalog.senses.some((item) => item.id === row.id),
      )
    )
      throw new Error(
        'Removing published vocabulary IDs requires an explicit migration.',
      );
    for (const sense of catalog.senses) {
      const { examples, tags, id, ...fields } = sense;
      await tx
        .insert(vocabularySenses)
        .values({ id, languageCode: 'en', ...fields })
        .onConflictDoUpdate({
          target: vocabularySenses.id,
          set: { ...fields, isPublished: true },
        });
      for (const example of examples)
        await tx
          .insert(vocabularyExamples)
          .values({ ...example, senseId: id })
          .onConflictDoUpdate({
            target: vocabularyExamples.id,
            set: { sentence: example.sentence, note: example.note ?? null },
          });
      for (const tag of tags) {
        await tx
          .insert(vocabularyTags)
          .values({ id: tag, label: tag.replaceAll('-', ' ') })
          .onConflictDoUpdate({
            target: vocabularyTags.id,
            set: { label: tag.replaceAll('-', ' ') },
          });
        await tx
          .insert(vocabularySenseTags)
          .values({ senseId: id, tagId: tag })
          .onConflictDoNothing();
      }
    }
    for (const [senseId, relatedSenseId] of catalog.families)
      await tx
        .insert(vocabularyFamilies)
        .values({ senseId, relatedSenseId })
        .onConflictDoNothing();
    for (const collocation of catalog.collocations) {
      await tx
        .insert(vocabularyCollocations)
        .values({
          id: collocation.id,
          phrase: collocation.phrase,
          note: collocation.note ?? null,
          example: collocation.example,
        })
        .onConflictDoUpdate({
          target: vocabularyCollocations.id,
          set: {
            phrase: collocation.phrase,
            note: collocation.note ?? null,
            example: collocation.example,
          },
        });
      for (const senseId of collocation.senseIds)
        await tx
          .insert(vocabularyCollocationSenses)
          .values({ collocationId: collocation.id, senseId })
          .onConflictDoNothing();
    }
    for (const association of catalog.associations)
      await tx
        .insert(activityVocabulary)
        .values(association)
        .onConflictDoUpdate({
          target: [activityVocabulary.activityId, activityVocabulary.senseId],
          set: {
            role: association.role,
            targetKey: association.targetKey ?? null,
          },
        });
  });
}
