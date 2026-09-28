'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LearningStatus } from '@/server/vocabulary/repository';

export type VocabularyCard = {
  id: string;
  displayForm: string;
  partOfSpeech: string;
  level: string;
  definition: string;
  tags: { id: string; label: string }[];
  introduced: boolean;
  saved: boolean;
  status: LearningStatus;
  correct: number;
  incorrect: number;
};
export function VocabularyBrowser({ items }: { items: VocabularyCard[] }) {
  const [view, setView] = useState('encountered');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [part, setPart] = useState('all');
  const [tag, setTag] = useState('all');
  const [status, setStatus] = useState('all');
  const tags = useMemo(
    () =>
      [
        ...new Map(
          items.flatMap((item) => item.tags).map((item) => [item.id, item]),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [items],
  );
  const filtered = items.filter(
    (item) =>
      (view === 'explore' ||
        (view === 'saved'
          ? item.saved
          : item.introduced || item.correct + item.incorrect > 0)) &&
      (search === '' ||
        `${item.displayForm} ${item.definition}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())) &&
      (level === 'all' || item.level === level) &&
      (part === 'all' || item.partOfSpeech === part) &&
      (tag === 'all' || item.tags.some((value) => value.id === tag)) &&
      (status === 'all' || item.status === status),
  );
  return (
    <>
      <div className="vocab-views" role="group" aria-label="Vocabulary view">
        {[
          ['encountered', 'Encountered'],
          ['saved', 'Saved'],
          ['explore', 'Explore'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="vocab-filters">
        <label>
          Search{' '}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Word or definition"
          />
        </label>
        <label>
          CEFR{' '}
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="all">All levels</option>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Part of speech{' '}
          <select
            value={part}
            onChange={(event) => setPart(event.target.value)}
          >
            <option value="all">All parts</option>
            {['noun', 'verb', 'adjective', 'adverb', 'phrase'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Tag{' '}
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="all">All tags</option>
            {tags.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Practice status{' '}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              'not encountered',
              'encountered',
              'practising',
              'familiar',
              'strong',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="vocab-result-count" role="status">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>
      {filtered.length ? (
        <div className="vocab-grid">
          {filtered.map((item) => (
            <article className="vocab-card" key={item.id}>
              <div className="vocab-card-heading">
                <h2>
                  <Link href={`/vocabulary/${item.id}`}>
                    {item.displayForm}
                  </Link>
                </h2>
                <span className="vocab-cefr">{item.level}</span>
              </div>
              <p className="vocab-meta">
                {item.partOfSpeech} · {item.status}
                {item.saved ? ' · Saved' : ''}
              </p>
              <p>{item.definition}</p>
              <div className="vocab-tags">
                {item.tags.map((value) => (
                  <span key={value.id}>{value.label}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="vocab-empty">
          No words match this view. Explore the curated collection or try
          different filters.
        </p>
      )}
    </>
  );
}
