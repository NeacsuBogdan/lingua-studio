import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import {
  listWeaknesses,
  recentMistakes,
  practiceHistory,
} from '@/server/mistakes/repository';
import { MistakeHistoryCards } from '@/components/mistakes/history';
export default async function WeaknessPage({
  params,
}: {
  params: Promise<{ weaknessId: string }>;
}) {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const { weaknessId } = await params;
  const weakness = (
    await listWeaknesses(getDb(), owner.id, profile.learningLanguage)
  ).find((w) => w.id === weaknessId);
  if (!weakness) notFound();
  const [recent, practice] = await Promise.all([
    recentMistakes(getDb(), owner.id, profile.learningLanguage, weaknessId),
    practiceHistory(getDb(), owner.id, weaknessId),
  ]);
  const date = (value: Date) =>
    value.toLocaleString('en-GB', { timeZone: profile.timezone });
  return (
    <div className="mistakes-page">
      <Link className="text-link" href="/mistakes">
        Back to Mistake Center
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{weakness.skill}</p>
          <h1>{weakness.label}</h1>
          <p className="subtitle">{weakness.description}</p>
        </div>
      </div>
      <p>
        <strong>Current state: {weakness.status}</strong>
      </p>
      <p>
        {weakness.recurrence} recorded{' '}
        {weakness.recurrence === 1 ? 'error' : 'errors'} (lesson:{' '}
        {weakness.lessonCount}, corrective: {weakness.practiceErrors}).
      </p>
      <p>
        First observed: {date(weakness.firstSeen)} · Latest error:{' '}
        {date(weakness.lastSeen)}
      </p>
      {weakness.status === 'recovered' && (
        <p>
          A successful corrective attempt followed your latest error. This does
          not mean permanently mastered.
        </p>
      )}
      <Link className="primary-link" href={`/mistakes/${weaknessId}/practice`}>
        Practice again
      </Link>
      <h2>Recent errors and saved feedback</h2>
      <MistakeHistoryCards rows={recent} timezone={profile.timezone} />
      <h2>Corrective practice history</h2>
      {!practice.length ? (
        <p>No corrective attempts yet.</p>
      ) : (
        <ul>
          {practice.map((p) => (
            <li key={p.id}>
              {date(p.createdAt)} · {p.isCorrect ? 'Correct' : 'Needs practice'}{' '}
              · {Math.round(p.score * 100)}% · {p.result.feedback}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
