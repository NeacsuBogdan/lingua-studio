import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { GitHubSignIn } from '@/components/github-sign-in';
import { getOwner } from '@/server/auth/session';
import { authSetupReady } from '@/lib/auth-env';

export const metadata = { title: 'Sign in' };

export default async function SignIn() {
  if (await getOwner()) redirect('/');
  const configured = authSetupReady();
  return (
    <main id="main" className="sign-in-page" tabIndex={-1}>
      <Card className="sign-in-card">
        <p className="eyebrow">LINGUA STUDIO</p>
        <h1>Your learning space.</h1>
        <p className="subtitle">
          Sign in with the GitHub account connected to this personal studio.
        </p>
        {configured ? (
          <GitHubSignIn />
        ) : (
          <p className="notice" role="status">
            Owner sign-in is being configured. Set the GitHub OAuth and
            application secrets before using this space.
          </p>
        )}
      </Card>
    </main>
  );
}
