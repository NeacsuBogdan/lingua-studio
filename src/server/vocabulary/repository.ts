import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { getDb } from '../db/client';
import {
  vocabularySenses,
  vocabularyExamples,
  vocabularyTags,
  vocabularySenseTags,
  vocabularyFamilies,
  vocabularyCollocations,
  vocabularyCollocationSenses,
  activityVocabulary,
  userVocabulary,
  vocabularyEvidence,
} from '../db/schema';

type Database = ReturnType<typeof getDb>;
export type LearningStatus =
  'not encountered' | 'encountered' | 'practising' | 'familiar' | 'strong';
/** Editorial practice indicator, never a proficiency or retention estimate. */
export function learningStatus(
  introduced: boolean,
  correct: number,
  incorrect: number,
): LearningStatus {
  if (correct + incorrect === 0)
    return introduced ? 'encountered' : 'not encountered';
  if (incorrect === 0 && correct >= 4) return 'strong';
  if (incorrect === 0 && correct >= 2) return 'familiar';
  return 'practising';
}

export async function listVocabulary(
  db: Database,
  userId: string,
  languageCode: string,
) {
  const senses = await db
    .select()
    .from(vocabularySenses)
    .where(
      and(
        eq(vocabularySenses.languageCode, languageCode),
        eq(vocabularySenses.isPublished, true),
      ),
    )
    .orderBy(vocabularySenses.lemma)
    .limit(100);
  if (!senses.length) return [];
  const ids = senses.map((item) => item.id);
  const [states, evidence, tagged] = await Promise.all([
    db
      .select()
      .from(userVocabulary)
      .where(
        and(
          eq(userVocabulary.userId, userId),
          inArray(userVocabulary.senseId, ids),
        ),
      ),
    db
      .select({
        senseId: vocabularyEvidence.senseId,
        correct: sql<number>`count(*) filter (where ${vocabularyEvidence.isCorrect})::integer`,
        incorrect: sql<number>`count(*) filter (where not ${vocabularyEvidence.isCorrect})::integer`,
      })
      .from(vocabularyEvidence)
      .where(
        and(
          eq(vocabularyEvidence.userId, userId),
          inArray(vocabularyEvidence.senseId, ids),
        ),
      )
      .groupBy(vocabularyEvidence.senseId),
    db
      .select({
        senseId: vocabularySenseTags.senseId,
        tagId: vocabularyTags.id,
        label: vocabularyTags.label,
      })
      .from(vocabularySenseTags)
      .innerJoin(
        vocabularyTags,
        eq(vocabularySenseTags.tagId, vocabularyTags.id),
      )
      .where(inArray(vocabularySenseTags.senseId, ids)),
  ]);
  return senses.map((sense) => {
    const state = states.find((item) => item.senseId === sense.id);
    const counts = evidence.find((item) => item.senseId === sense.id);
    const correct = counts?.correct ?? 0;
    const incorrect = counts?.incorrect ?? 0;
    return {
      ...sense,
      introduced: Boolean(state?.introducedAt),
      saved: Boolean(state?.savedAt),
      correct,
      incorrect,
      status: learningStatus(Boolean(state?.introducedAt), correct, incorrect),
      tags: tagged
        .filter((item) => item.senseId === sense.id)
        .map(({ tagId, label }) => ({ id: tagId, label })),
    };
  });
}

export async function getVocabularyDetail(
  db: Database,
  userId: string,
  languageCode: string,
  id: string,
) {
  const item = (await listVocabulary(db, userId, languageCode)).find(
    (sense) => sense.id === id,
  );
  if (!item) return null;
  const [examples, relations, collocations] = await Promise.all([
    db
      .select()
      .from(vocabularyExamples)
      .where(eq(vocabularyExamples.senseId, id)),
    db
      .select()
      .from(vocabularyFamilies)
      .where(
        or(
          eq(vocabularyFamilies.senseId, id),
          eq(vocabularyFamilies.relatedSenseId, id),
        ),
      ),
    db
      .select({
        id: vocabularyCollocations.id,
        phrase: vocabularyCollocations.phrase,
        note: vocabularyCollocations.note,
        example: vocabularyCollocations.example,
      })
      .from(vocabularyCollocationSenses)
      .innerJoin(
        vocabularyCollocations,
        eq(
          vocabularyCollocationSenses.collocationId,
          vocabularyCollocations.id,
        ),
      )
      .where(eq(vocabularyCollocationSenses.senseId, id)),
  ]);
  const familyIds = relations.map((row) =>
    row.senseId === id ? row.relatedSenseId : row.senseId,
  );
  const family = familyIds.length
    ? await db
        .select({
          id: vocabularySenses.id,
          displayForm: vocabularySenses.displayForm,
          partOfSpeech: vocabularySenses.partOfSpeech,
        })
        .from(vocabularySenses)
        .where(
          and(
            inArray(vocabularySenses.id, familyIds),
            eq(vocabularySenses.isPublished, true),
            eq(vocabularySenses.languageCode, languageCode),
          ),
        )
    : [];
  return { ...item, examples, collocations, family };
}

export async function getActivityIntroductions(
  db: Database,
  activityId: string,
  languageCode: string,
) {
  return db
    .select({
      id: vocabularySenses.id,
      displayForm: vocabularySenses.displayForm,
      partOfSpeech: vocabularySenses.partOfSpeech,
      definition: vocabularySenses.definition,
      level: vocabularySenses.level,
    })
    .from(activityVocabulary)
    .innerJoin(
      vocabularySenses,
      eq(activityVocabulary.senseId, vocabularySenses.id),
    )
    .where(
      and(
        eq(activityVocabulary.activityId, activityId),
        eq(activityVocabulary.role, 'introduces'),
        eq(vocabularySenses.languageCode, languageCode),
        eq(vocabularySenses.isPublished, true),
      ),
    );
}

export async function setSavedVocabulary(
  db: Database,
  userId: string,
  languageCode: string,
  senseId: string,
  save: boolean,
) {
  const [sense] = await db
    .select({ id: vocabularySenses.id })
    .from(vocabularySenses)
    .where(
      and(
        eq(vocabularySenses.id, senseId),
        eq(vocabularySenses.languageCode, languageCode),
        eq(vocabularySenses.isPublished, true),
      ),
    )
    .limit(1);
  if (!sense) return false;
  if (save)
    await db
      .insert(userVocabulary)
      .values({ userId, senseId, savedAt: new Date() })
      .onConflictDoUpdate({
        target: [userVocabulary.userId, userVocabulary.senseId],
        set: {
          savedAt: sql`coalesce(${userVocabulary.savedAt}, excluded.saved_at)`,
        },
      });
  else
    await db
      .update(userVocabulary)
      .set({ savedAt: null })
      .where(
        and(
          eq(userVocabulary.userId, userId),
          eq(userVocabulary.senseId, senseId),
        ),
      );
  return true;
}
