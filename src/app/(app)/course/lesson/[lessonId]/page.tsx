import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { CourseError, getLessonView } from '@/server/course/repository';
import { startLessonAction, advanceLessonAction } from './actions';

export const metadata: Metadata = { title: 'Lesson' };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  let view: Awaited<ReturnType<typeof getLessonView>>;
  try {
    view = await getLessonView(
      getDb(),
      owner.id,
      profile.learningLanguage,
      lessonId,
    );
  } catch (error) {
    if (error instanceof CourseError && error.code === 'not_found') notFound();
    throw error;
  }
  const { lesson, activities } = view;
  const position = Math.min(lesson.position, activities.length - 1);
  const block = activities[position];
  return (
    <div className="lesson-page">
      <Link href="/course" className="lesson-back">
        <ArrowLeft size={17} /> Learning path
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {lesson.skill.toUpperCase()} · {lesson.estimatedMinutes} MINUTES
          </p>
          <h1>{lesson.title}</h1>
          <p className="subtitle">{lesson.summary}</p>
        </div>
      </div>
      {lesson.state === 'locked' ? (
        <section className="lesson-panel lesson-locked">
          <LockKeyhole size={25} />
          <h2>This lesson is locked.</h2>
          <p>Complete the earlier lessons in your path to open it.</p>
          <Link href="/course" className="text-link">
            View learning path <ArrowRight size={17} />
          </Link>
        </section>
      ) : lesson.state === 'completed' ? (
        <section className="lesson-panel lesson-complete">
          <CheckCircle2 size={30} />
          <p className="eyebrow">LESSON COMPLETE</p>
          <h2>Lesson completed.</h2>
          <p>
            Your completion is saved. Review the ideas below or continue along
            the path.
          </p>
          <div className="lesson-actions">
            <Link className="primary-link" href="/course">
              Return to learning path <ArrowRight size={17} />
            </Link>
          </div>
          <div className="lesson-review">
            <h3>Ideas to revisit</h3>
            {activities.map((item) => (
              <article key={item.id}>
                <span className="small-label">{item.skill.toUpperCase()}</span>
                <h4>{item.prompt}</h4>
                <p>{item.explanation}</p>
                <p className="lesson-review-example">{item.payload.example}</p>
              </article>
            ))}
          </div>
        </section>
      ) : lesson.state === 'available' ? (
        <section className="lesson-panel">
          <p className="small-label">BEFORE YOU BEGIN</p>
          <h2>A focused study moment.</h2>
          <p>
            Read each idea, pause to form your own response, then continue. This
            lesson records the blocks you have worked through; answer checking
            arrives with the exercise engine.
          </p>
          <p className="lesson-meta">
            {activities.length} learning blocks · around{' '}
            {lesson.estimatedMinutes} minutes
          </p>
          <form action={startLessonAction.bind(null, lesson.id)}>
            <button className="primary-link" type="submit">
              Begin lesson <ArrowRight size={17} />
            </button>
          </form>
        </section>
      ) : (
        <section className="lesson-panel" aria-labelledby="activity-heading">
          <div className="lesson-step">
            <span className="small-label">
              BLOCK {position + 1} OF {activities.length}
            </span>
            <span>
              {block.skill} · {block.level}
            </span>
          </div>
          <div
            className="lesson-progress-track"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuenow={position}
            aria-valuemin={0}
            aria-valuemax={activities.length}
          >
            <span
              style={{ width: `${(position / activities.length) * 100}%` }}
            />
          </div>
          <p className="lesson-instructions">{block.instructions}</p>
          <h2 id="activity-heading">{block.prompt}</h2>
          <div className="lesson-example">
            <span className="small-label">IN CONTEXT</span>
            <p>{block.payload.example}</p>
          </div>
          <div className="lesson-explanation">
            <span className="small-label">THE IDEA TO KEEP</span>
            <p>{block.explanation}</p>
          </div>
          <form action={advanceLessonAction.bind(null, lesson.id, position)}>
            <button className="primary-link" type="submit">
              {position === activities.length - 1
                ? 'Complete lesson'
                : 'Continue'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
