import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getReviewSession, ReviewError } from '@/server/review/repository';
import { ReviewPlayer } from '@/components/review/review-player';
import { finishReviewAction, skipStaleReviewAction } from '../../actions';

export const metadata: Metadata = { title: 'Review session' };
export default async function ReviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  let session;
  try {
    session = await getReviewSession(
      getDb(),
      owner.id,
      profile.learningLanguage,
      sessionId,
      new Date(),
    );
  } catch (error) {
    if (error instanceof ReviewError && error.code === 'not_found') notFound();
    throw error;
  }
  return (
    <div className="review-page">
      <Link className="text-link" href="/review">
        ← Review overview
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR REVIEW SESSION</p>
          <h1>
            {session.status === 'completed'
              ? 'Review complete.'
              : 'One word at a time.'}
          </h1>
          <p className="subtitle">
            {session.reviewed} of {session.size} cards reviewed
            {session.stale ? ` · ${session.stale} skipped after changing` : ''}
          </p>
        </div>
      </div>
      {session.status === 'completed' || !session.current ? (
        <section className="vocab-card" aria-label="Session summary">
          <h2>Session summary</h2>
          <p>
            Again {session.ratings.Again} · Hard {session.ratings.Hard} · Good{' '}
            {session.ratings.Good} · Easy {session.ratings.Easy}
          </p>
          {session.status === 'active' && (
            <form action={finishReviewAction.bind(null, session.id)}>
              <button className="primary-link" type="submit">
                Finish session
              </button>
            </form>
          )}
          {session.status === 'completed' && (
            <Link className="primary-link" href="/review">
              Back to review
            </Link>
          )}
        </section>
      ) : session.current.reviewable ? (
        <ReviewPlayer
          key={session.current.itemId}
          sessionId={session.id}
          size={session.size}
          current={session.current}
        />
      ) : (
        <section className="vocab-card">
          <h2>Card changed</h2>
          <p>This card is no longer due in this session.</p>
          <form
            action={skipStaleReviewAction.bind(
              null,
              session.id,
              session.current.itemId,
            )}
          >
            <button className="primary-link" type="submit">
              Skip changed card
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
