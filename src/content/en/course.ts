import { curriculum } from '../curriculum';
import { courseCatalogSchema } from '../course-schema';
import { englishExercises } from './exercises';

const blocks = (
  lessonId: string,
  level: 'B1' | 'B2',
  skill: 'grammar' | 'vocabulary' | 'reading' | 'communication',
  first: {
    instructions: string;
    prompt: string;
    explanation: string;
    example: string;
    tags: string[];
  },
  second: {
    instructions: string;
    prompt: string;
    explanation: string;
    example: string;
    tags: string[];
  },
) => [
  {
    id: `${lessonId}-study`,
    order: 1,
    type: 'explanation' as const,
    skill,
    level,
    instructions: first.instructions,
    prompt: first.prompt,
    explanation: first.explanation,
    tags: first.tags,
    payload: { example: first.example },
  },
  ...(englishExercises[lessonId] ?? []),
  {
    id: `${lessonId}-reflect`,
    order: 2 + (englishExercises[lessonId]?.length ?? 0),
    type: 'reflection' as const,
    skill,
    level,
    instructions: second.instructions,
    prompt: second.prompt,
    explanation: second.explanation,
    tags: second.tags,
    payload: { example: second.example },
  },
];

const b1Units = [
  {
    id: 'en-b1-time-meaning',
    order: 1,
    title: 'Time and meaning',
    description:
      'Choose verb forms that match the time and purpose of a story.',
    lessons: [
      {
        id: 'en-b1-present-perfect',
        order: 1,
        title: 'The past that matters now',
        summary:
          'Distinguish a finished past event from an experience with a present connection.',
        skill: 'grammar',
        estimatedMinutes: 8,
        contentVersion: 2,
        prerequisiteIds: [],
        activities: blocks(
          'en-b1-present-perfect',
          'B1',
          'grammar',
          {
            instructions: 'Read the contrast, then notice the time reference.',
            prompt:
              'I visited Edinburgh in 2022. I have visited Edinburgh twice.',
            explanation:
              'The first sentence places a finished event in a named past time. The second counts experience up to now without saying when it happened.',
            example:
              'I sent the email yesterday. I have sent the email, so you can read it now.',
            tags: ['present-perfect', 'past-simple'],
          },
          {
            instructions:
              'Pause and say your own example aloud or write it down.',
            prompt:
              'Describe one completed trip and one experience you have had in your life. Which sentence needs a finished-time expression?',
            explanation:
              'Use past simple with a finished time such as last year. Use present perfect when the experience matters now and no finished time is given.',
            example:
              'I went to Rome last summer. I have visited Italy three times.',
            tags: ['active-recall', 'time-reference'],
          },
        ),
      },
      {
        id: 'en-b1-narrative',
        order: 2,
        title: 'A story with a clear sequence',
        summary:
          'Use past simple, continuous and perfect to show what happened and what came before.',
        skill: 'grammar',
        estimatedMinutes: 9,
        contentVersion: 2,
        prerequisiteIds: ['en-b1-present-perfect'],
        activities: blocks(
          'en-b1-narrative',
          'B1',
          'grammar',
          {
            instructions: 'Read the short scene and trace its timeline.',
            prompt:
              'I was walking home when I realised I had left my keys at work.',
            explanation:
              'Was walking sets the background; realised is the event; had left happened before that realisation.',
            example: 'The train had already left when we reached the platform.',
            tags: ['narrative-tenses', 'sequence'],
          },
          {
            instructions:
              'Retell the scene in your own words before continuing.',
            prompt:
              'You arrived at a café. Your friend was waiting because you had missed the earlier bus. Which action happened first?',
            explanation:
              'Missing the bus came first. Past perfect makes that earlier cause clear; past continuous can describe the waiting background.',
            example:
              'My friend was waiting when I arrived because I had missed the bus.',
            tags: ['active-recall', 'narrative-tenses'],
          },
        ),
      },
    ],
  },
  {
    id: 'en-b1-everyday-precision',
    order: 2,
    title: 'Everyday precision',
    description:
      'Make familiar ideas sound more natural and useful in conversation.',
    lessons: [
      {
        id: 'en-b1-collocations',
        order: 1,
        title: 'Words that travel together',
        summary:
          'Choose natural verb–noun combinations in work and daily life.',
        skill: 'vocabulary',
        estimatedMinutes: 7,
        contentVersion: 2,
        prerequisiteIds: ['en-b1-narrative'],
        activities: blocks(
          'en-b1-collocations',
          'B1',
          'vocabulary',
          {
            instructions: 'Read each phrase as one useful chunk.',
            prompt: 'Make a decision, take a break, keep a promise.',
            explanation:
              'English often pairs particular verbs with nouns. Learning the whole phrase makes speech more natural than translating each word separately.',
            example: 'We need to make a decision before Friday.',
            tags: ['collocations', 'daily-life'],
          },
          {
            instructions: 'Try to recall the verb before viewing the example.',
            prompt:
              'A colleague needs rest after a long meeting. Would you advise them to make, take or do a break?',
            explanation:
              'Say take a break. We make a decision and keep a promise, but take a break.',
            example: 'Let’s take a short break and return to the decision.',
            tags: ['active-recall', 'collocations'],
          },
        ),
      },
      {
        id: 'en-b1-polite-requests',
        order: 2,
        title: 'Requests with the right tone',
        summary:
          'Ask for help clearly while matching the level of formality to the situation.',
        skill: 'communication',
        estimatedMinutes: 7,
        contentVersion: 2,
        prerequisiteIds: ['en-b1-collocations'],
        activities: blocks(
          'en-b1-polite-requests',
          'B1',
          'communication',
          {
            instructions: 'Compare the tone of these requests.',
            prompt:
              'Send me the file. Could you send me the file when you have a moment?',
            explanation:
              'The second version softens the request without obscuring what is needed. Could you and a realistic time frame work well with colleagues.',
            example: 'Could you take a look at the draft this afternoon?',
            tags: ['functional-english', 'register'],
          },
          {
            instructions: 'Formulate a request for a real situation.',
            prompt:
              'You need a colleague’s notes before tomorrow morning. Ask politely and include a clear deadline.',
            explanation:
              'A useful request combines a soft opening, the specific item and a practical deadline.',
            example:
              'Could you send me your notes by this evening, please? I need them for tomorrow morning.',
            tags: ['active-recall', 'register'],
          },
        ),
      },
    ],
  },
];

const b2Units = [
  {
    id: 'en-b2-making-a-case',
    order: 1,
    title: 'Making a case',
    description:
      'Read beyond the literal sentence and express a balanced view.',
    lessons: [
      {
        id: 'en-b2-reading-inference',
        order: 1,
        title: 'What the writer implies',
        summary:
          'Separate a writer’s stated claim from a cautious implication.',
        skill: 'reading',
        estimatedMinutes: 10,
        contentVersion: 2,
        prerequisiteIds: ['en-b1-polite-requests'],
        activities: blocks(
          'en-b2-reading-inference',
          'B2',
          'reading',
          {
            instructions:
              'Read the passage and distinguish fact from inference.',
            prompt:
              'The council called the new cycle lane a success. Yet the report mentions only its first month and says nothing about winter use.',
            explanation:
              'The writer questions whether early figures are enough to judge long-term success. The passage does not claim that winter use is low.',
            example:
              'A cautious inference is: the evidence may be too limited for a firm conclusion.',
            tags: ['inference', 'critical-reading'],
          },
          {
            instructions: 'State the implication without inventing a fact.',
            prompt:
              'What concern does the word “Yet” introduce? Give a one-sentence inference.',
            explanation:
              '“Yet” contrasts the success claim with a gap in the evidence. Avoid claiming the project failed; the text gives no such result.',
            example:
              'The council’s conclusion may be premature because the report covers only one month.',
            tags: ['active-recall', 'inference'],
          },
        ),
      },
    ],
  },
];

export const englishCatalog = courseCatalogSchema.parse({
  schemaVersion: 2,
  language: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    writingDirection: 'ltr',
    isActive: true,
  },
  course: {
    id: 'english-core',
    languageCode: 'en',
    title: 'English: A thoughtful path',
    description:
      'A structured route from foundations to nuanced expression, with a focused B1–B2 starting collection.',
    contentVersion: 2,
    levels: curriculum.map((item, index) => ({
      id: `english-${item.level.toLowerCase()}`,
      order: index + 1,
      cefr: item.level,
      title: item.title,
      description: item.description,
      units: item.level === 'B1' ? b1Units : item.level === 'B2' ? b2Units : [],
    })),
  },
});
