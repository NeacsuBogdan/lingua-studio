import type { ExerciseActivity } from '../activity-schema';

const normalization = {
  caseSensitive: false,
  terminalPunctuation: 'ignore' as const,
};
const common = {
  level: 'B1' as const,
  skill: 'grammar' as const,
  instructions: 'Answer for the stated context, then check your response.',
};
export const englishExercises: Record<string, ExerciseActivity[]> = {
  'en-b1-present-perfect': [
    {
      ...common,
      id: 'en-b1-present-perfect-choice',
      order: 2,
      type: 'multiple_choice',
      prompt: 'Which sentence correctly describes a finished event yesterday?',
      tags: ['past-simple', 'finished-time'],
      explanation:
        'Yesterday is a finished past time. Use past simple: sent. Present perfect does not combine with this finished-time expression.',
      payload: {
        shuffleOptions: false,
        correctOptionId: 'sent',
        options: [
          {
            id: 'have-sent',
            text: 'I have sent the email yesterday.',
            feedback:
              'Present perfect connects the past to now without a finished-time expression.',
          },
          {
            id: 'sent',
            text: 'I sent the email yesterday.',
            feedback:
              'Sent places the completed event in the finished time yesterday.',
          },
          {
            id: 'send',
            text: 'I send the email yesterday.',
            feedback:
              'The present form send does not locate this completed event in the past.',
          },
        ],
      },
    },
    {
      ...common,
      id: 'en-b1-present-perfect-gap',
      order: 3,
      type: 'fill_gap',
      prompt: 'Complete the gap. The speaker still lives in the same place.',
      tags: ['present-perfect', 'since'],
      explanation:
        'Since 2022 gives the starting point of a situation continuing now. Have lived or have been living expresses that ongoing connection.',
      payload: {
        context: 'I ___ here since 2022.',
        acceptedAnswers: [
          'have lived',
          'have been living',
          "'ve lived",
          "'ve been living",
        ],
        normalization,
      },
    },
    {
      ...common,
      id: 'en-b1-present-perfect-correction',
      order: 4,
      type: 'error_correction',
      prompt:
        'Correct the sentence while keeping its meaning and time reference.',
      tags: ['past-simple', 'irregular-verbs'],
      explanation:
        'Yesterday requires past simple. The past simple of go is went. Have went combines an inappropriate tense with the wrong participle.',
      payload: {
        originalText: 'I have went there yesterday.',
        acceptedAnswers: ['I went there yesterday.'],
        normalization,
      },
    },
  ],
  'en-b1-narrative': [
    {
      ...common,
      id: 'en-b1-narrative-reorder',
      order: 2,
      type: 'sentence_reorder',
      instructions:
        'Add the tokens in order. Use the move controls to revise your sentence.',
      prompt: 'Build the sentence: the train left before our arrival.',
      tags: ['past-perfect', 'sequence'],
      explanation:
        'Had already left marks the departure as earlier than our arrival. When connects the two events.',
      payload: {
        tokens: [
          { id: 'when', text: 'when' },
          { id: 'we', text: 'we' },
          { id: 'the-train', text: 'The train' },
          { id: 'arrived', text: 'arrived.' },
          { id: 'had-left', text: 'had already left' },
        ],
        correctOrder: ['the-train', 'had-left', 'when', 'we', 'arrived'],
      },
    },
    {
      ...common,
      id: 'en-b1-narrative-typed',
      order: 3,
      type: 'typed_answer',
      prompt:
        'Use the past perfect of “leave”: She ___ her keys at work before she realised.',
      tags: ['past-perfect', 'irregular-verbs'],
      explanation:
        'Had left is the past perfect of leave. It shows that leaving the keys happened before the later realisation.',
      payload: { acceptedAnswers: ['had left', "'d left"], normalization },
    },
  ],
  'en-b1-collocations': [
    {
      ...common,
      skill: 'vocabulary',
      id: 'en-b1-collocations-match',
      order: 2,
      type: 'matching',
      instructions: 'Choose one ending for each verb. Use every ending once.',
      prompt: 'Match each verb to its natural everyday collocation.',
      tags: ['collocations', 'verb-noun'],
      explanation:
        'English uses make a decision, take a break and keep a promise as natural verb–noun combinations. Learn each phrase as a chunk.',
      payload: {
        left: [
          { id: 'make', text: 'make' },
          { id: 'take', text: 'take' },
          { id: 'keep', text: 'keep' },
        ],
        right: [
          { id: 'promise', text: 'a promise' },
          { id: 'decision', text: 'a decision' },
          { id: 'break', text: 'a break' },
        ],
        correctPairs: [
          { leftId: 'make', rightId: 'decision' },
          { leftId: 'take', rightId: 'break' },
          { leftId: 'keep', rightId: 'promise' },
        ],
      },
    },
  ],
  'en-b1-polite-requests': [
    {
      ...common,
      skill: 'communication',
      id: 'en-b1-polite-requests-translate',
      order: 2,
      type: 'translation',
      instructions:
        'Translate into English using “Could you” or “Could you please”.',
      prompt: 'Ask a colleague politely to send the file by this evening.',
      tags: ['polite-requests', 'deadline'],
      explanation:
        'Could you softens a request. By this evening gives a clear deadline. This curated exercise accepts the model forms below, not every possible translation.',
      payload: {
        sourceLanguage: 'Romanian',
        sourceText: 'Ai putea să-mi trimiți fișierul până diseară, te rog?',
        acceptedAnswers: [
          'Could you send me the file by this evening, please?',
          'Could you please send me the file by this evening?',
          'Could you send me the file by this evening please?',
        ],
        normalization,
      },
    },
  ],
  'en-b2-reading-inference': [
    {
      ...common,
      level: 'B2',
      skill: 'reading',
      id: 'en-b2-reading-inference-choice',
      order: 2,
      type: 'multiple_choice',
      instructions:
        'Choose the inference supported by the passage, without inventing a fact.',
      prompt:
        'The council called the cycle lane a success. Yet its report covers only the first month and says nothing about winter use. What does the writer imply?',
      tags: ['inference', 'evidence'],
      explanation:
        'The limited time frame makes the success claim premature. The passage supplies no winter figures and does not say the lane failed.',
      payload: {
        shuffleOptions: true,
        correctOptionId: 'limited-evidence',
        options: [
          {
            id: 'winter-failure',
            text: 'The lane definitely failed during winter.',
            feedback:
              'No winter results are given, so that conclusion adds a fact.',
          },
          {
            id: 'limited-evidence',
            text: 'The evidence may be too limited for a firm conclusion.',
          },
          {
            id: 'no-users',
            text: 'Nobody used the lane during its first month.',
            feedback: 'The passage does not give a usage figure.',
          },
        ],
      },
    },
  ],
};
