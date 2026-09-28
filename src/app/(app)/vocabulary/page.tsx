import type { Metadata } from 'next';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { listVocabulary } from '@/server/vocabulary/repository';
import { VocabularyBrowser } from '@/components/vocabulary/vocabulary-browser';

export const metadata: Metadata = { title: 'Vocabulary' };
export default async function VocabularyPage() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const items = await listVocabulary(
    getDb(),
    owner.id,
    profile.learningLanguage,
  );
  return (
    <div className="vocab-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORDS</p>
          <h1>Vocabulary</h1>
          <p className="subtitle">
            Encountered words, saved words and a small curated collection.
            Practice status describes recorded activity, not proficiency.
          </p>
        </div>
      </div>
      <VocabularyBrowser items={items} />
    </div>
  );
}
