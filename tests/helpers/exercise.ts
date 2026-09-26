import type { ExerciseActivity } from '../../src/content/activity-schema';
import type { ExerciseAnswer } from '../../src/lib/exercise-answer';
export function correctAnswer(activity: ExerciseActivity): ExerciseAnswer {
  switch (activity.type) {
    case 'multiple_choice':
      return {
        type: activity.type,
        optionId: activity.payload.correctOptionId,
      };
    case 'sentence_reorder':
      return { type: activity.type, tokenIds: activity.payload.correctOrder };
    case 'matching':
      return { type: activity.type, pairs: activity.payload.correctPairs };
    default:
      return { type: activity.type, text: activity.payload.acceptedAnswers[0] };
  }
}
