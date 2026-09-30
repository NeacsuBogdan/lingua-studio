import Link from 'next/link';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getMistakePractice, MistakeError } from '@/server/mistakes/repository';
import { ExercisePlayer } from '@/components/exercises/exercise-player';
export default async function PracticePage({
  params,
}: {
  params: Promise<{ weaknessId: string }>;
}) {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const { weaknessId } = await params;
  let practice;
  try {
    practice = await getMistakePractice(
      getDb(),
      owner.id,
      profile.learningLanguage,
      weaknessId,
    );
  } catch (error) {
    if (!(error instanceof MistakeError)) throw error;
  }
  if (!practice)
    return (
      <div>
        <h1>Practice unavailable</h1>
        <p>No current mapped activity is available for your recorded area.</p>
        <Link className="text-link" href="/mistakes">
          Return to Mistake Center
        </Link>
      </div>
    );
  return (
    <div className="mistakes-page">
      <Link className="text-link" href={`/mistakes/${weaknessId}`}>
        Return to area
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CORRECTIVE PRACTICE</p>
          <h1>{practice.label}</h1>
          <p className="subtitle">{practice.activity.instructions}</p>
        </div>
      </div>
      <h2>{practice.activity.prompt}</h2>
      <ExercisePlayer
        key={`${practice.activity.id}:${practice.contentVersion}`}
        activity={practice.activity}
        lessonId=""
        contentVersion={practice.contentVersion}
        weaknessId={weaknessId}
        initialAnswer={null}
        initialResult={null}
        final={false}
      />
    </div>
  );
}
