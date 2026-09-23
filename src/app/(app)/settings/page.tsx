import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProfileForm } from '@/components/profile-form';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
export const metadata: Metadata = { title: 'Preferences' };
export default async function Settings() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>A space that suits you.</h1>
          <p className="subtitle">
            Choose your goals and the way your workspace feels.
          </p>
        </div>
      </div>
      <Card className="preferences">
        <div>
          <h2>Appearance</h2>
          <p>
            Switch between light and dark. Your choice is remembered in this
            browser.
          </p>
        </div>
        <ThemeToggle />
      </Card>
      <Card className="settings-profile">
        <div>
          <span className="small-label">YOUR LEARNING PROFILE</span>
          <h2>Goals and pace</h2>
          <p>
            Saved settings shape your future study plan. Your current level
            remains unestimated until a placement assessment is available.
          </p>
        </div>
        <ProfileForm profile={profile} />
      </Card>
    </>
  );
}
