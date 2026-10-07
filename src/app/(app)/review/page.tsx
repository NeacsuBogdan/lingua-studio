import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getReviewOverview } from '@/server/review/repository';
import { listWeaknesses } from '@/server/mistakes/repository';
import { startReviewAction } from './actions';

export const metadata: Metadata = { title: 'Review' };
export default async function ReviewPage() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const stats = await getReviewOverview(
    getDb(),
    owner.id,
    profile.learningLanguage,
    new Date(),
  );
  const mistakes = await listWeaknesses(
    getDb(),
    owner.id,
    profile.learningLanguage,
  );
  const activeMistakes = mistakes.filter(
    (w) => w.status !== 'recovered',
  ).length;
  return (
    <div className="review-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SPACED REPETITION</p>
          <h1>Review</h1>
          <p className="subtitle">
            Recall the meanings of words you have encountered or practised.
            Saving a word alone does not schedule it.
          </p>
        </div>
      </div>
      <Card>
        <h2>Mistakes to revisit</h2>
        <p>
          Areas needing practice: {activeMistakes}. Corrective practice is
          separate from memory scheduling.
        </p>
        <Link className="text-link" href="/mistakes">
          Open Mistake Center
        </Link>
      </Card>
      <div className="review-grid">
        <Card>
          <p className="metric-label">Ready now</p>
          <h2>{stats.dueCount} reviews due</h2>
          <p>
            {stats.activeOtherLanguage
              ? `Finish your open ${stats.activeOtherLanguage} session after switching the learning language back in Preferences.`
              : stats.dueCount
                ? 'Work through a focused set of up to 20 cards.'
                : stats.nextDue
                  ? `Next review: ${stats.nextDue.toLocaleString('en-GB', { timeZone: profile.timezone })}`
                  : 'No reviews scheduled yet. Keep learning in your lessons.'}
          </p>
          {stats.activeSessionId ? (
            <Link
              className="primary-link"
              href={`/review/session/${stats.activeSessionId}`}
            >
              Resume review
            </Link>
          ) : !stats.activeOtherLanguage && stats.dueCount > 0 ? (
            <form action={startReviewAction}>
              <button className="primary-link" type="submit">
                Start review
              </button>
            </form>
          ) : null}
        </Card>
        <Card>
          <p className="metric-label">Past 7 days</p>
          <h2>{stats.recentCount} reviews</h2>
          <p>
            Again {stats.ratings.Again} · Hard {stats.ratings.Hard} · Good{' '}
            {stats.ratings.Good} · Easy {stats.ratings.Easy}
          </p>
        </Card>
      </div>
    </div>
  );
}
