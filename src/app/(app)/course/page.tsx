import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Check, LockKeyhole, Play } from 'lucide-react';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getCourseMap } from '@/server/course/repository';
import { languageLabels } from '@/lib/language-labels';

export const metadata: Metadata = { title: 'Learning path' };

export default async function Course() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const map = await getCourseMap(getDb(), owner.id, profile.learningLanguage);
  const language = languageLabels[profile.learningLanguage] ?? 'your language';
  if (!map)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">THE BIG PICTURE</p>
            <h1>Your {language} learning path.</h1>
            <p className="subtitle">Your language choice is saved.</p>
          </div>
        </div>
        <div className="notice">
          A course for {language} is not published yet. Choose English in
          Preferences to study the available lessons.
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Your {language} learning path.</h1>
          <p className="subtitle">
            Move through focused lessons, one idea at a time.
          </p>
        </div>
        <span className="edition">02 / LEARNING PATH</span>
      </div>
      <section className="course-overview" aria-label="Course progress">
        <div>
          <span className="small-label">{map.course.title}</span>
          <h2>
            {map.currentLevel
              ? `Currently exploring ${map.currentLevel}`
              : 'Begin with a B1 bridge'}
          </h2>
          <p>{map.course.description}</p>
        </div>
        <div className="course-overview-actions">
          <strong>
            {map.completedCount} / {map.lessonCount}
          </strong>
          <span>lessons completed</span>
          {map.recommended && (
            <Link
              className="primary-link"
              href={`/course/lesson/${map.recommended.id}`}
            >
              {map.recommended.state === 'in_progress'
                ? 'Resume lesson'
                : 'Start next lesson'}{' '}
              <ArrowUpRight size={18} />
            </Link>
          )}
        </div>
      </section>
      <div className="course-levels">
        {map.levels.map((level) => (
          <section
            className="course-level"
            key={level.id}
            aria-labelledby={`heading-${level.id}`}
          >
            <div className="course-level-heading">
              <span className="level-badge">{level.level}</span>
              <div>
                <h2 id={`heading-${level.id}`}>{level.title}</h2>
                <p>{level.description}</p>
              </div>
              <span className="small-label">
                {level.units.length
                  ? `${level.units.length} ${level.units.length === 1 ? 'UNIT' : 'UNITS'}`
                  : 'COMING LATER'}
              </span>
            </div>
            {level.units.length ? (
              level.units.map((unit) => (
                <div className="course-unit" key={unit.id}>
                  <div className="course-unit-heading">
                    <span className="small-label">
                      UNIT {unit.sortOrder.toString().padStart(2, '0')}
                    </span>
                    <h3>{unit.title}</h3>
                    <p>{unit.description}</p>
                  </div>
                  <ol className="lesson-list">
                    {unit.lessons.map((lesson) => (
                      <li
                        className={`lesson-row lesson-${lesson.state}`}
                        key={lesson.id}
                      >
                        <span className="lesson-index">
                          {lesson.state === 'completed' ? (
                            <Check size={18} />
                          ) : lesson.state === 'locked' ? (
                            <LockKeyhole size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </span>
                        <div className="lesson-info">
                          <span className="small-label">
                            LESSON{' '}
                            {lesson.sortOrder.toString().padStart(2, '0')} ·{' '}
                            {lesson.estimatedMinutes} MIN ·{' '}
                            {lesson.skill.toUpperCase()}
                          </span>
                          <h4>{lesson.title}</h4>
                          <p>{lesson.summary}</p>
                        </div>
                        {lesson.state === 'locked' ? (
                          <span className="lesson-state">
                            Locked · complete earlier lessons
                          </span>
                        ) : (
                          <Link
                            href={`/course/lesson/${lesson.id}`}
                            className="lesson-open"
                            aria-label={`${lesson.state === 'completed' ? 'Review' : lesson.state === 'in_progress' ? 'Resume' : 'Open'} ${lesson.title}`}
                          >
                            {lesson.state === 'completed'
                              ? 'Review'
                              : lesson.state === 'in_progress'
                                ? 'Resume'
                                : 'Open'}{' '}
                            <ArrowUpRight size={17} />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            ) : (
              <p className="course-empty">
                The {level.level} learning goals are mapped; lessons will be
                published in a later content release.
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
