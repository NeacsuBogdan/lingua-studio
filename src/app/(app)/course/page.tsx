import type { Metadata } from 'next';
import { curriculum } from '@/content/curriculum';
import { Card } from '@/components/ui/card';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { languageLabels } from '@/lib/language-labels';
export const metadata: Metadata = { title: 'Learning path' };
export default async function Course() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const language = languageLabels[profile.learningLanguage] ?? 'your language';
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Your {language} learning path.</h1>
          <p className="subtitle">
            {profile.learningLanguage === 'en'
              ? 'Six stages. A growing range of possibilities.'
              : 'Your language choice is saved for a future course.'}
          </p>
        </div>
        <span className="edition">02 / LEARNING PATH</span>
      </div>
      <div className="notice">
        {profile.learningLanguage === 'en'
          ? 'English curriculum outline · Lessons are not available yet. Levels describe learning goals, not certified proficiency.'
          : `${language} curriculum is not available yet. Your language choice is saved; no lessons or progress are being claimed.`}
      </div>
      {profile.learningLanguage === 'en' && (
        <div className="course-grid">
          {curriculum.map((c) => (
            <Card key={c.level} className="course-card">
              <div className="section-top">
                <span className="level-badge">{c.level}</span>
                <span className="small-label">PLANNED</span>
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
      )}
    </>
  );
}
