'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="theme-toggle sign-out"
        type="button"
        onClick={async () => {
          setError('');
          try {
            const result = await authClient.signOut();
            if (result.error) {
              setError('Could not sign out. Try again.');
              return;
            }
            router.replace('/sign-in');
            router.refresh();
          } catch {
            setError('Could not sign out. Try again.');
          }
        }}
      >
        Sign out
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
