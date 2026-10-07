import { englishCatalog } from './course';
import { validateWeaknessCatalog } from '../weakness-schema';

export const englishWeaknesses = validateWeaknessCatalog(
  {
    definitions: [
      {
        id: 'en-past-present-perfect',
        languageCode: 'en',
        skill: 'grammar',
        label: 'Past simple and present perfect',
        description:
          'Choose tense forms for finished past events and situations continuing now.',
        isPublished: true,
      },
      {
        id: 'en-narrative-sequence',
        languageCode: 'en',
        skill: 'grammar',
        label: 'Narrative sequencing',
        description:
          'Use the past perfect and word order to show which event happened first.',
        isPublished: true,
      },
      {
        id: 'en-verb-noun-collocations',
        languageCode: 'en',
        skill: 'vocabulary',
        label: 'Everyday collocations',
        description:
          'Practise natural verb–noun combinations. Matching scores describe the activity as a whole.',
        isPublished: true,
      },
      {
        id: 'en-polite-requests',
        languageCode: 'en',
        skill: 'communication',
        label: 'Polite requests',
        description:
          'Form a polite request with a clear deadline using the authored model forms.',
        isPublished: true,
      },
      {
        id: 'en-reading-inference',
        languageCode: 'en',
        skill: 'reading',
        label: 'Evidence-based inference',
        description:
          'Draw a supported inference without adding facts that the passage does not supply.',
        isPublished: true,
      },
    ],
    mappings: [
      ['en-b1-present-perfect-choice', 'en-past-present-perfect'],
      ['en-b1-present-perfect-gap', 'en-past-present-perfect'],
      ['en-b1-present-perfect-correction', 'en-past-present-perfect'],
      ['en-b1-narrative-reorder', 'en-narrative-sequence'],
      ['en-b1-narrative-typed', 'en-narrative-sequence'],
      ['en-b1-collocations-match', 'en-verb-noun-collocations'],
      ['en-b1-polite-requests-translate', 'en-polite-requests'],
      ['en-b2-reading-inference-choice', 'en-reading-inference'],
    ].map(([activityId, weaknessId]) => ({
      activityId,
      weaknessId,
      contentVersion: 2,
      isPublished: true,
    })),
  },
  englishCatalog,
);
