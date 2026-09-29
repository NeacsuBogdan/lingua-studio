'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReviewRating } from '@/server/review/scheduler';

type Answer = {
  definition: string;
  notes: string | null;
  example: string | null;
};
const ratings: { rating: ReviewRating; hint: string; key: string }[] = [
  { rating: 'Again', hint: 'Did not remember', key: '1' },
  { rating: 'Hard', hint: 'Remembered with difficulty', key: '2' },
  { rating: 'Good', hint: 'Remembered', key: '3' },
  { rating: 'Easy', hint: 'Remembered immediately', key: '4' },
];
export function ReviewPlayer({
  sessionId,
  size,
  current,
}: {
  sessionId: string;
  size: number;
  current: {
    itemId: string;
    cardId: string;
    position: number;
    headword: string;
    partOfSpeech: string;
    reviewable: boolean;
  };
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lockedRating, setLockedRating] = useState<ReviewRating | null>(null);
  const [transitioning, startTransition] = useTransition();
  const submission = useRef<{ id: string; rating: ReviewRating } | null>(null);
  const reveal = useCallback(async () => {
    if (loading || answer) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ sessionId, itemId: current.itemId });
      const response = await fetch(`/api/review/answer?${query}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      setAnswer((await response.json()) as Answer);
    } catch {
      setError('The answer could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, [answer, current.itemId, loading, sessionId]);
  const rate = useCallback(
    async (rating: ReviewRating) => {
      if (!answer || saving || transitioning) return;
      if (submission.current && submission.current.rating !== rating) return;
      if (!submission.current) {
        submission.current = { id: crypto.randomUUID(), rating };
        setLockedRating(rating);
      }
      setSaving(true);
      setError('');
      try {
        const response = await fetch('/api/review/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            itemId: current.itemId,
            cardId: current.cardId,
            submissionId: submission.current.id,
            rating,
          }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          if (response.status === 409) {
            setError(body.error ?? 'Review changed. Refresh the page.');
            return;
          }
          throw new Error();
        }
        startTransition(() => router.refresh());
      } catch {
        setError('The review could not be saved. Retry the same rating.');
      } finally {
        setSaving(false);
      }
    },
    [
      answer,
      current.cardId,
      current.itemId,
      router,
      saving,
      sessionId,
      transitioning,
    ],
  );
  useEffect(() => {
    if (!answer) return;
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      const option = ratings.find((entry) => entry.key === event.key);
      if (option) {
        event.preventDefault();
        void rate(option.rating);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [answer, rate]);
  return (
    <section className="review-card" aria-label="Vocabulary review card">
      <p className="eyebrow">
        CARD {current.position} OF {size} · RECOGNITION
      </p>
      <h2>{current.headword}</h2>
      <p className="subtitle">{current.partOfSpeech}</p>
      {!current.reviewable ? (
        <p role="alert">
          This card changed or is no longer due. Refresh the page to continue.
        </p>
      ) : !answer ? (
        <button
          type="button"
          className="primary-link"
          onClick={() => void reveal()}
          disabled={loading}
        >
          {loading ? 'Loading answer…' : 'Show answer'}
        </button>
      ) : (
        <div className="review-answer" aria-live="polite">
          <h3>Meaning</h3>
          <p>{answer.definition}</p>
          {answer.example && <blockquote>{answer.example}</blockquote>}
          {answer.notes && <p>{answer.notes}</p>}
          <fieldset disabled={saving || transitioning}>
            <legend>How well did you remember?</legend>
            <div className="review-ratings">
              {ratings.map(({ rating, hint, key }) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => void rate(rating)}
                  disabled={Boolean(lockedRating && lockedRating !== rating)}
                >
                  <strong>{rating}</strong>
                  <span>{hint}</span>
                  <small>Press {key}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {error && (
        <p role="alert" className="review-error">
          {error}
        </p>
      )}
    </section>
  );
}
