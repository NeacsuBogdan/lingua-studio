import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  Layers3,
  Sparkles,
  Target,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { languageLabels } from '@/lib/language-labels';
export default async function Home() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const language = languageLabels[profile.learningLanguage] ?? 'your language';
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h1>Make room for {language}.</h1>
          <p className="subtitle">
            A focused space to grow from knowing the words to owning them.
          </p>
        </div>
        <span className="edition">01 / OVERVIEW</span>
      </div>
      <div className="dashboard-grid">
        <section className="journey-card">
          <div className="hero-top">
            <span className="hero-label">
              <Sparkles size={16} /> YOUR {language.toUpperCase()} JOURNEY
            </span>
            <span className="outline-pill">
              {language} · {profile.targetLevel} target
            </span>
          </div>
          <h2>
            Go further.
            <br />
            <em>Express more.</em>
          </h2>
          <p>
            Build on what you know. Develop the precision, confidence, and range
            to make every word count.
          </p>
          <Link href="/course" className="primary-link">
            Explore your learning path <ArrowUpRight size={19} />
          </Link>
          <div className="hero-bottom">
            <span>
              <BookOpen size={15} /> Thoughtful practice
            </span>
            <span>
              <Target size={15} /> Meaningful progress
            </span>
          </div>
        </section>
        <Card className="daily-card">
          <div className="section-top">
            <h2>A fresh start</h2>
            <Clock3 size={19} />
          </div>
          <div className="goal-ring">
            <span>
              <strong>0</strong>
              <small>minutes studied</small>
            </span>
          </div>
          <h3>Your story starts here.</h3>
          <p>
            Study activity will appear here after your first completed session.
          </p>
          <div className="quiet-tag">No sessions yet</div>
        </Card>
      </div>
      <div className="section-heading">
        <h2>A clear direction</h2>
        <span>Designed around your goals</span>
      </div>
      <div className="metric-grid">
        <Card>
          <span className="metric-icon">
            <Layers3 size={19} />
          </span>
          <p className="metric-label">Starting point</p>
          <h3>
            {profile.estimatedLevel ?? '—'} <span>not assessed</span>
          </h3>
          <p>Placement assessment comes later.</p>
        </Card>
        <Card>
          <span className="metric-icon">
            <Target size={19} />
          </span>
          <p className="metric-label">On the horizon</p>
          <h3>
            {profile.targetLevel} <span>your target</span>
          </h3>
          <p>Change your target in Preferences.</p>
        </Card>
        <Card>
          <span className="metric-icon">
            <BookOpen size={19} />
          </span>
          <p className="metric-label">Words made yours</p>
          <h3>
            — <span>not tracked yet</span>
          </h3>
          <p>Vocabulary grows through practice.</p>
        </Card>
      </div>
      <Card className="foundation-note">
        <div>
          <span className="small-label">A STRONG FOUNDATION</span>
          <h2>Your workspace is taking shape.</h2>
          <p>
            Your profile is saved.{' '}
            {profile.learningLanguage === 'en'
              ? 'Explore the English course outline while lessons and learning progress are being built.'
              : `${language} course content is planned. Your saved goals will be ready when that path is built.`}
          </p>
        </div>
        <Link href="/course" className="text-link">
          View the outline <ArrowUpRight size={17} />
        </Link>
      </Card>
    </>
  );
}
