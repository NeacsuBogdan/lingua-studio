import { z } from 'zod';
import { englishCatalog } from './course';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const senseSchema = z
  .object({
    id,
    lemma: z.string().trim().min(1),
    displayForm: z.string().trim().min(1),
    partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    definition: z.string().trim().min(10),
    notes: z.string().trim().min(1).optional(),
    examples: z
      .array(
        z
          .object({
            id,
            sentence: z.string().trim().min(12),
            note: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    tags: z.array(id).min(1),
  })
  .strict();
const collocationSchema = z
  .object({
    id,
    phrase: z.string().trim().min(3),
    note: z.string().optional(),
    example: z.string().trim().min(12),
    senseIds: z.array(id).min(1),
  })
  .strict();
const associationSchema = z
  .object({
    activityId: id,
    senseId: id,
    role: z.enum(['introduces', 'practises', 'context']),
    targetKey: id.optional(),
  })
  .strict();
export const vocabularyCatalogSchema = z
  .object({
    senses: z.array(senseSchema).min(1),
    families: z.array(z.tuple([id, id])),
    collocations: z.array(collocationSchema),
    associations: z.array(associationSchema),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const ids = new Set(catalog.senses.map((item) => item.id));
    const add = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (ids.size !== catalog.senses.length)
      add('Duplicate vocabulary sense ID');
    const examples = catalog.senses.flatMap((item) =>
      item.examples.map((example) => example.id),
    );
    if (new Set(examples).size !== examples.length) add('Duplicate example ID');
    const activityById = new Map(
      englishCatalog.course.levels
        .flatMap((level) =>
          level.units.flatMap((unit) =>
            unit.lessons.flatMap((lesson) => lesson.activities),
          ),
        )
        .map((activity) => [activity.id, activity]),
    );
    for (const [a, b] of catalog.families)
      if (!ids.has(a) || !ids.has(b) || a === b) add('Invalid family relation');
    if (
      new Set(catalog.collocations.map((item) => item.id)).size !==
      catalog.collocations.length
    )
      add('Duplicate collocation ID');
    for (const item of catalog.collocations)
      for (const id of item.senseIds)
        if (!ids.has(id)) add('Unknown collocation sense');
    const associations = new Set<string>();
    for (const item of catalog.associations) {
      const activity = activityById.get(item.activityId);
      if (!ids.has(item.senseId) || !activity)
        add('Unknown activity vocabulary reference');
      if (
        item.role === 'practises' &&
        (!activity ||
          activity.type === 'explanation' ||
          activity.type === 'reflection')
      )
        add('Practice target requires a graded activity');
      if (
        item.targetKey &&
        (item.role !== 'practises' ||
          activity?.type !== 'matching' ||
          !activity.payload.left.some((left) => left.id === item.targetKey))
      )
        add('Invalid matching target key');
      if (
        activity?.type === 'matching' &&
        item.role === 'practises' &&
        !item.targetKey
      )
        add('Matching target requires a left ID');
      const key = `${item.activityId}:${item.senseId}`;
      if (associations.has(key))
        add('Duplicate activity vocabulary association');
      associations.add(key);
    }
  });

const entry = (
  id: string,
  lemma: string,
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase',
  level: 'B1' | 'B2',
  definition: string,
  sentence: string,
  tags: string[],
) => ({
  id,
  lemma,
  displayForm: lemma,
  partOfSpeech,
  level,
  definition,
  examples: [{ id: `${id}-example`, sentence }],
  tags,
});

/** Representative editorial senses; CEFR is Lingua Studio metadata, not an official rating. */
export const englishVocabulary = vocabularyCatalogSchema.parse({
  senses: [
    entry(
      'en-decision-noun-1',
      'decision',
      'noun',
      'B1',
      'A choice made after thinking about what to do.',
      'We need to make a decision before Friday.',
      ['work', 'collocation'],
    ),
    entry(
      'en-decide-verb-1',
      'decide',
      'verb',
      'B1',
      'To choose one option after considering others.',
      'They will decide which route to take tomorrow.',
      ['everyday-life'],
    ),
    entry(
      'en-decisive-adjective-1',
      'decisive',
      'adjective',
      'B2',
      'Able to make choices quickly and with confidence.',
      'Her decisive response helped the team move forward.',
      ['work'],
    ),
    entry(
      'en-break-noun-1',
      'break',
      'noun',
      'B1',
      'A short period when you stop an activity to rest.',
      'Let us take a break after this meeting.',
      ['everyday-life', 'collocation'],
    ),
    entry(
      'en-promise-noun-1',
      'promise',
      'noun',
      'B1',
      'A statement that you will do something.',
      'He kept his promise to call before leaving.',
      ['communication', 'collocation'],
    ),
    entry(
      'en-promise-verb-1',
      'promise',
      'verb',
      'B1',
      'To say firmly that you will do something.',
      'I promise to send you the details tonight.',
      ['communication'],
    ),
    entry(
      'en-request-noun-1',
      'request',
      'noun',
      'B1',
      'A polite or formal act of asking for something.',
      'Her request for more time was reasonable.',
      ['communication', 'work'],
    ),
    entry(
      'en-request-verb-1',
      'request',
      'verb',
      'B2',
      'To ask for something in a formal or careful way.',
      'You may request a copy of the report.',
      ['communication', 'formal'],
    ),
    entry(
      'en-colleague-noun-1',
      'colleague',
      'noun',
      'B1',
      'A person you work with.',
      'My colleague reviewed the draft yesterday.',
      ['work'],
    ),
    entry(
      'en-draft-noun-1',
      'draft',
      'noun',
      'B2',
      'An early version of a piece of writing.',
      'Could you read the first draft of my report?',
      ['work', 'academic'],
    ),
    entry(
      'en-evidence-noun-1',
      'evidence',
      'noun',
      'B2',
      'Facts or information that support a conclusion.',
      'The report gives little evidence about winter use.',
      ['academic', 'reading'],
    ),
    entry(
      'en-inference-noun-1',
      'inference',
      'noun',
      'B2',
      'An idea reached from available information rather than stated directly.',
      'That inference goes beyond what the article says.',
      ['reading', 'academic'],
    ),
    entry(
      'en-infer-verb-1',
      'infer',
      'verb',
      'B2',
      'To reach an idea from clues instead of a direct statement.',
      'We cannot infer the result from one month of data.',
      ['reading', 'academic'],
    ),
    entry(
      'en-conclusion-noun-1',
      'conclusion',
      'noun',
      'B2',
      'A judgment reached after considering information.',
      'The writer thinks the conclusion may be premature.',
      ['reading', 'academic'],
    ),
    entry(
      'en-premature-adjective-1',
      'premature',
      'adjective',
      'B2',
      'Happening before enough time or evidence is available.',
      'A firm judgment would be premature at this stage.',
      ['reading', 'academic'],
    ),
    entry(
      'en-sequence-noun-1',
      'sequence',
      'noun',
      'B1',
      'The order in which events happen.',
      'The sequence of events became clear in her story.',
      ['reading'],
    ),
  ],
  families: [
    ['en-decision-noun-1', 'en-decide-verb-1'],
    ['en-decision-noun-1', 'en-decisive-adjective-1'],
    ['en-promise-noun-1', 'en-promise-verb-1'],
    ['en-inference-noun-1', 'en-infer-verb-1'],
    ['en-request-noun-1', 'en-request-verb-1'],
  ],
  collocations: [
    {
      id: 'make-a-decision',
      phrase: 'make a decision',
      example: 'We need to make a decision before Friday.',
      senseIds: ['en-decision-noun-1'],
    },
    {
      id: 'take-a-break',
      phrase: 'take a break',
      example: 'Let us take a break after the meeting.',
      senseIds: ['en-break-noun-1'],
    },
    {
      id: 'keep-a-promise',
      phrase: 'keep a promise',
      example: 'She always tries to keep a promise.',
      senseIds: ['en-promise-noun-1'],
    },
    {
      id: 'reach-a-conclusion',
      phrase: 'reach a conclusion',
      example: 'We cannot reach a conclusion from one month of data.',
      senseIds: ['en-conclusion-noun-1'],
    },
  ],
  associations: [
    {
      activityId: 'en-b1-collocations-study',
      senseId: 'en-decision-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b1-collocations-study',
      senseId: 'en-break-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b1-collocations-study',
      senseId: 'en-promise-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b1-collocations-match',
      senseId: 'en-decision-noun-1',
      role: 'practises',
      targetKey: 'make',
    },
    {
      activityId: 'en-b1-collocations-match',
      senseId: 'en-break-noun-1',
      role: 'practises',
      targetKey: 'take',
    },
    {
      activityId: 'en-b1-collocations-match',
      senseId: 'en-promise-noun-1',
      role: 'practises',
      targetKey: 'keep',
    },
    {
      activityId: 'en-b1-polite-requests-study',
      senseId: 'en-request-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b1-polite-requests-study',
      senseId: 'en-colleague-noun-1',
      role: 'context',
    },
    {
      activityId: 'en-b1-polite-requests-study',
      senseId: 'en-draft-noun-1',
      role: 'context',
    },
    {
      activityId: 'en-b2-reading-inference-study',
      senseId: 'en-evidence-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b2-reading-inference-study',
      senseId: 'en-inference-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b2-reading-inference-study',
      senseId: 'en-conclusion-noun-1',
      role: 'introduces',
    },
    {
      activityId: 'en-b2-reading-inference-reflect',
      senseId: 'en-premature-adjective-1',
      role: 'context',
    },
  ],
});
