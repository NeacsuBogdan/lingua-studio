'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function GitHubSignIn() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="primary-link"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = await authClient.signIn.social({
              provider: 'github',
              callbackURL: '/',
            });
            if (!result.error) return;
          } catch {
            // A network failure leaves the user on this page with a retry option.
          }
          setError('GitHub sign-in could not start. Please try again.');
          setBusy(false);
        }}
      >
        {busy ? 'Connecting…' : 'Continue with GitHub'}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
