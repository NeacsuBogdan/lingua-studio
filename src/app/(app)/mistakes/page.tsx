import type { Metadata } from 'next';
import Link from 'next/link';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { listWeaknesses, recentMistakes } from '@/server/mistakes/repository';
import { Card } from '@/components/ui/card';
import { MistakeHistoryCards } from '@/components/mistakes/history';
export const metadata: Metadata = { title: 'Mistake Center' };
export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; status?: string; repeated?: string }>;
}) {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const filters = await searchParams;
  const [all, recent] = await Promise.all([
    listWeaknesses(getDb(), owner.id, profile.learningLanguage),
    recentMistakes(getDb(), owner.id, profile.learningLanguage),
  ]);
  const visible = all.filter(
    (w) =>
      (!filters.skill || w.skill === filters.skill) &&
      (!filters.status || w.status === filters.status) &&
      (filters.repeated !== 'yes' || w.recurrence >= 2),
  );
  return (
    <div className="mistakes-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CORRECTIVE PRACTICE</p>
          <h1>Mistake Center</h1>
          <p className="subtitle">
            Revisit assessed errors and practise the areas that caused
            difficulty.
          </p>
        </div>
      </div>
      <p>
        Needs practice: {all.filter((w) => w.status !== 'recovered').length}
        {' · '}Repeated: {all.filter((w) => w.recurrence >= 2).length}
        {' · '}Recovered: {all.filter((w) => w.status === 'recovered').length}
      </p>
      <form className="mistake-filters" action="/mistakes">
        <label>
          Skill
          <select name="skill" defaultValue={filters.skill ?? ''}>
            <option value="">All skills</option>
            {['grammar', 'vocabulary', 'reading', 'communication'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ''}>
            <option value="">All states</option>
            {['needs practice', 'repeated', 'recovered'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            name="repeated"
            value="yes"
            defaultChecked={filters.repeated === 'yes'}
          />{' '}
          Repeated only
        </label>
        <button className="secondary-button" type="submit">
          Apply filters
        </button>
      </form>
      <h2>Areas to practise</h2>
      {!all.length && (
        <Card>
          <h3>No recorded mistakes yet</h3>
          <p>
            Assessed lesson errors will appear here. Memory review ratings stay
            in Review.
          </p>
          <Link href="/course" className="text-link">
            Explore your learning path
          </Link>
        </Card>
      )}
      {!!all.length && !visible.length && <p>No areas match these filters.</p>}
      <div className="review-grid">
        {visible.map((w) => (
          <Card key={w.id}>
            <p className="small-label">
              {w.skill} · {w.status}
            </p>
            <h3>
              <Link href={`/mistakes/${w.id}`} className="text-link">
                {w.label}
              </Link>
            </h3>
            <p>{w.description}</p>
            <p>
              {w.recurrence} recorded {w.recurrence === 1 ? 'error' : 'errors'}{' '}
              · Corrective attempts: {w.practiceCount}
            </p>
            <p>
              Latest error:{' '}
              {w.lastSeen.toLocaleString('en-GB', {
                timeZone: profile.timezone,
              })}
            </p>
          </Card>
        ))}
      </div>
      <h2>Recent mistakes</h2>
      <p>The latest 20 recorded errors, newest first.</p>
      <MistakeHistoryCards rows={recent} timezone={profile.timezone} />
      <p className="form-hint">
        Repeated difficulty is evidence from these activities, not a diagnosis
        of ability. Recovered does not mean permanently mastered.
      </p>
    </div>
  );
}
