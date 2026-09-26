'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { PublicExercise } from '@/content/activity-schema';
import {
  savedResultSchema,
  type ExerciseAnswer,
  type SavedResult,
} from '@/lib/exercise-answer';
import { AnswerControls } from './answer-controls';
import { ExerciseFeedback } from './feedback';

function ContinueButton({ final }: { final: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary-link" type="submit" disabled={pending}>
      {pending ? 'Saving progress…' : final ? 'Complete lesson' : 'Continue'}
    </button>
  );
}

export function ExercisePlayer({
  activity,
  lessonId,
  contentVersion,
  initialResult,
  initialAnswer,
  continueAction,
  final,
}: {
  activity: PublicExercise;
  lessonId: string;
  contentVersion: number;
  initialResult: SavedResult | null;
  initialAnswer: ExerciseAnswer | null;
  continueAction: (data: FormData) => Promise<void>;
  final: boolean;
}) {
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(initialAnswer);
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const submissionId = useRef<string | null>(null);
  const feedback = useRef<HTMLElement>(null);
  const answerForm = useRef<HTMLFormElement>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const complete =
    answer &&
    (answer.type === 'sentence_reorder' && activity.type === 'sentence_reorder'
      ? answer.tokenIds.length === activity.payload.tokens.length
      : answer.type === 'matching' && activity.type === 'matching'
        ? answer.pairs.length === activity.payload.left.length &&
          new Set(answer.pairs.map((pair) => pair.rightId)).size ===
            activity.payload.right.length
        : 'text' in answer
          ? answer.text.trim().length > 0
          : true);
  useEffect(() => {
    if (result && result.attemptId !== initialResult?.attemptId)
      feedback.current?.focus();
  }, [result, initialResult]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !answer) return;
    sending.current = true;
    setPending(true);
    setError('');
    setSessionEnded(false);
    submissionId.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/exercises/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionId.current,
          lessonId,
          activityId: activity.id,
          contentVersion,
          answer,
        }),
      });
      const body: unknown = await response.json();
      const parsed = savedResultSchema.safeParse(
        body && typeof body === 'object' && 'result' in body
          ? body.result
          : null,
      );
      if (!response.ok || !parsed.success) {
        setSessionEnded(response.status === 401);
        setError(
          response.status === 401
            ? 'Your session has ended. Sign in again before answering.'
            : response.status === 409
              ? 'The lesson has changed. Refresh before continuing.'
              : response.status === 400
                ? 'Check that your answer is complete and uses each item once.'
                : 'Your answer could not be saved. Please try again.',
        );
        return;
      }
      setResult(parsed.data);
    } catch {
      setError('Connection interrupted. Your input is preserved; try again.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  return (
    <div className="exercise-player">
      <form ref={answerForm} onSubmit={submit} aria-label="Exercise answer">
        <AnswerControls
          activity={activity}
          answer={answer}
          disabled={pending || !!result}
          onChange={(next) => {
            setAnswer(next);
            submissionId.current = null;
            setError('');
          }}
        />
        {!result && (
          <button
            className="primary-link"
            type="submit"
            disabled={pending || !complete}
          >
            {pending ? 'Checking your answer…' : 'Check answer'}
          </button>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
            {sessionEnded && (
              <>
                {' '}
                <a href="/sign-in" className="text-link">
                  Sign in
                </a>
              </>
            )}
          </p>
        )}
      </form>
      {result && (
        <>
          <ExerciseFeedback ref={feedback} result={result} />
          <div className="exercise-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setResult(null);
                submissionId.current = null;
                setError('');
                requestAnimationFrame(() =>
                  answerForm.current
                    ?.querySelector<HTMLElement>(
                      'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)',
                    )
                    ?.focus(),
                );
              }}
            >
              Try again
            </button>
            <form action={continueAction}>
              <ContinueButton final={final} />
            </form>
          </div>
          <p className="form-hint">
            Each checked answer is saved separately. You can continue after
            practising; lesson completion is separate from correctness.
          </p>
        </>
      )}
    </div>
  );
}
