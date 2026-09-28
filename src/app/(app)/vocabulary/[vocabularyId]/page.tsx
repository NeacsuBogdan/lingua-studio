import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getVocabularyDetail } from '@/server/vocabulary/repository';
import { SaveButton } from '@/components/vocabulary/save-button';

export const metadata: Metadata = { title: 'Vocabulary detail' };
export default async function VocabularyDetailPage({
  params,
}: {
  params: Promise<{ vocabularyId: string }>;
}) {
  const { vocabularyId } = await params;
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const item = await getVocabularyDetail(
    getDb(),
    owner.id,
    profile.learningLanguage,
    vocabularyId,
  );
  if (!item) notFound();
  return (
    <div className="vocab-page">
      <Link className="text-link" href="/vocabulary">
        ← Vocabulary
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CURATED ENGLISH · {item.level}</p>
          <h1>{item.displayForm}</h1>
          <p className="subtitle">
            {item.partOfSpeech} · {item.status}
          </p>
        </div>
      </div>
      <div className="vocab-detail">
        <section className="vocab-card">
          <h2>Meaning</h2>
          <p>{item.definition}</p>
          {item.notes && <p>{item.notes}</p>}
          <SaveButton id={item.id} saved={item.saved} />
          <p className="vocab-disclaimer">
            Saving a word does not count as practice. This status is based only
            on lessons and checked exercises.
          </p>
        </section>
        <section className="vocab-card">
          <h2>In context</h2>
          {item.examples.map((example) => (
            <blockquote key={example.id}>
              {example.sentence}
              {example.note && <small>{example.note}</small>}
            </blockquote>
          ))}
        </section>
        {item.collocations.length > 0 && (
          <section className="vocab-card">
            <h2>Collocations</h2>
            <ul>
              {item.collocations.map((value) => (
                <li key={value.id}>
                  <strong>{value.phrase}</strong> — {value.example}
                  {value.note && <span> {value.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {item.family.length > 0 && (
          <section className="vocab-card">
            <h2>Word family</h2>
            <ul>
              {item.family.map((value) => (
                <li key={value.id}>
                  <Link href={`/vocabulary/${value.id}`}>
                    {value.displayForm}
                  </Link>{' '}
                  <span className="vocab-meta">({value.partOfSpeech})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="vocab-card">
          <h2>Tags</h2>
          <div className="vocab-tags">
            {item.tags.map((value) => (
              <span key={value.id}>{value.label}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
