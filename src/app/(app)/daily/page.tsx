import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { DailyStartButton } from '@/components/daily/start-button';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getTodayDaily } from '@/server/daily/repository';
import { languageLabels } from '@/lib/language-labels';

export default async function DailyPage() {
  const owner = await requireOwner();
  await getOrCreateProfile(owner.id);
  const today = await getTodayDaily(getDb(), owner.id, new Date());
  const plan = today.plan;
  const items = plan?.items ?? today.preview!;
  const target = plan?.session.targetMinutes ?? today.profile.dailyMinutes;
  const planned =
    plan?.session.plannedMinutes ??
    items.reduce((sum, i) => sum + i.estimatedMinutes, 0);
  const completed =
    plan?.items.filter((i) => i.status === 'completed').length ?? 0;
  const unavailable =
    plan?.items.filter((i) => i.status === 'unavailable').length ?? 0;
  const next = plan?.items.find((i) => i.status === 'pending');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE SPACE TO LEARN</p>
          <h1>Today’s learning</h1>
          <p className="subtitle">
            {languageLabels[today.profile.learningLanguage]} · {today.date}
          </p>
        </div>
        <span className="edition">TODAY</span>
      </div>
      <Card className="daily-summary">
        <p className="eyebrow">
          {plan ? 'YOUR SAVED PLAN' : 'YOUR PLAN PREVIEW'}
        </p>
        <h2>{target}-minute goal</h2>
        <p className="subtitle">
          ~{planned} min planned · {items.length}{' '}
          {items.length === 1 ? 'task' : 'tasks'}
        </p>
        {plan ? (
          <>
            <p>
              {completed}/{items.length} tasks complete
              {unavailable ? ` · ${unavailable} unavailable` : ''}
            </p>
            <progress
              aria-label="Daily plan progress"
              value={completed + unavailable}
              max={items.length}
            />
            {plan.session.completedAt ? (
              <>
                <h3>
                  {unavailable
                    ? 'Today’s available plan is complete.'
                    : 'Today’s plan is complete.'}
                </h3>
                <p>
                  You’ve finished this plan. You can keep learning at your own
                  pace.
                </p>
                <Link className="text-link" href="/course">
                  Explore your learning path
                </Link>
              </>
            ) : (
              next && (
                <Link className="primary-link" href={next.href}>
                  Continue today’s plan
                </Link>
              )
            )}
            <p className="daily-note">
              Goal and timezone saved when you started: {plan.session.timezone}.
              Preference changes apply to your next plan.
            </p>
          </>
        ) : items.length ? (
          <>
            <p>
              A balanced starting point from the work available now. Start to
              save today’s plan.
            </p>
            <DailyStartButton />
          </>
        ) : (
          <>
            <h3>No work is available right now.</h3>
            <p>
              Check your learning language or return when more content is
              available.
            </p>
            <Link className="text-link" href="/settings">
              Open Preferences
            </Link>
          </>
        )}
        <p className="daily-note">
          Minutes estimate the workload; they do not measure time studied.
        </p>
      </Card>
      {items.length > 0 && (
        <ol className="daily-tasks" aria-label="Daily tasks">
          {items.map((item, index) => {
            const saved = plan?.items[index];
            return (
              <li key={saved?.id ?? index}>
                <Card>
                  <div className="section-top">
                    <span className="eyebrow">
                      {index + 1} /{' '}
                      {item.kind === 'lesson'
                        ? 'LESSON SEGMENT'
                        : item.kind === 'mistake'
                          ? 'CORRECTIVE PRACTICE'
                          : 'REVIEW'}
                    </span>
                    <span className="quiet-tag">
                      ~{item.estimatedMinutes} min
                    </span>
                  </div>
                  <h2>{item.label}</h2>
                  <p className="daily-focus">{item.focus.join(' · ')}</p>
                  <p>
                    {item.kind === 'review'
                      ? `${item.targetCount} vocabulary reviews`
                      : item.kind === 'mistake'
                        ? 'One saved practice answer, whether correct or incorrect'
                        : `${item.targetCount} consecutive lesson activities`}
                  </p>
                  {saved && (
                    <>
                      <p className="daily-status">
                        {saved.status === 'unavailable'
                          ? 'Content changed — this task is unavailable and won’t block your plan.'
                          : saved.status === 'completed'
                            ? 'Complete'
                            : `${saved.completedUnits}/${saved.targetCount} done`}
                      </p>
                      {saved.status === 'pending' && (
                        <Link className="text-link" href={saved.href}>
                          Open{' '}
                          {item.kind === 'lesson'
                            ? 'lesson'
                            : item.kind === 'mistake'
                              ? 'practice'
                              : 'Review'}
                        </Link>
                      )}
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
