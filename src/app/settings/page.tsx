import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
export const metadata: Metadata = { title: 'Preferences' };
export default function Settings() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>A space that suits you.</h1>
          <p className="subtitle">Start with the way your workspace feels.</p>
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
      <Card className="foundation-note">
        <div>
          <span className="small-label">COMING WITH YOUR ACCOUNT</span>
          <h2>Your goals. Your pace.</h2>
          <p>
            Native language, study duration, time zone, and Cambridge exam
            targets will be editable when profiles are available.
          </p>
        </div>
      </Card>
    </>
  );
}
