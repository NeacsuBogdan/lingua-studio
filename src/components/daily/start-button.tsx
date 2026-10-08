'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DailyStartButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/daily/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error();
      // Finish consuming the saved-plan response before refreshing the route.
      await response.json();
      router.refresh();
    } catch {
      setError('Your plan could not be saved. Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="primary-link" onClick={start} disabled={pending}>
        {pending ? 'Starting…' : 'Start today’s plan'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
