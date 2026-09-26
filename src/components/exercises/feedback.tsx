'use client';
import { forwardRef } from 'react';
import { CheckCircle2, CircleHelp } from 'lucide-react';
import type { SavedResult } from '@/lib/exercise-answer';

export const ExerciseFeedback = forwardRef<
  HTMLElement,
  { result: SavedResult }
>(function ExerciseFeedback({ result }, ref) {
  return (
    <section
      ref={ref}
      className={`exercise-feedback ${result.isCorrect ? 'answer-correct' : 'answer-incorrect'}`}
      role="status"
      tabIndex={-1}
      aria-label="Answer feedback"
    >
      <h3>
        {result.isCorrect ? (
          <CheckCircle2 size={22} />
        ) : (
          <CircleHelp size={22} />
        )}
        {result.isCorrect ? 'Correct' : 'Not quite yet'}
      </h3>
      <p>{result.feedback}</p>
      <p>
        <strong>Model answer:</strong> {result.expectedAnswer}
      </p>
      <div className="feedback-explanation">
        <strong>Why this works</strong>
        <p>{result.explanation}</p>
      </div>
    </section>
  );
});
