import { Navigation } from '@/components/navigation';
import { requireOwner } from '@/server/auth/session';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOwner();
  return (
    <div className="app-shell">
      <Navigation displayName={user.name} />
      <div className="main-shell">
        <header className="topbar">
          <span>Personal learning studio</span>
          <span className="language-pill">Personal edition</span>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>
          Built for understanding, one day at a time.
          <span>Personal edition · 01</span>
        </footer>
      </div>
    </div>
  );
}
