import type { Metadata } from 'next';
import { curriculum } from '@/content/curriculum';
import { Card } from '@/components/ui/card';
export const metadata: Metadata = { title: 'Learning path' };
export default function Course() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Your English learning path.</h1>
          <p className="subtitle">
            Six stages. A growing range of possibilities.
          </p>
        </div>
        <span className="edition">02 / LEARNING PATH</span>
      </div>
      <div className="notice">
        Curriculum outline · Lessons are not available yet. Levels describe
        learning goals, not certified proficiency.
      </div>
      <div className="course-grid">
        {curriculum.map((c) => (
          <Card
            key={c.level}
            className={
              c.level === 'B2' ? 'course-card highlighted' : 'course-card'
            }
          >
            <div className="section-top">
              <span className="level-badge">{c.level}</span>
              <span className="small-label">
                {c.level === 'B2' ? 'SUGGESTED START' : 'PLANNED'}
              </span>
            </div>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <ul>
              {c.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <span className="course-status">Content in preparation</span>
          </Card>
        ))}
      </div>
    </>
  );
}
