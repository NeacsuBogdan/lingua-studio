'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Route,
  SlidersHorizontal,
  BookOpen,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { SignOutButton } from './sign-out-button';
const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/course', label: 'Learning path', icon: Route },
  { href: '/settings', label: 'Preferences', icon: SlidersHorizontal },
];
export function Navigation({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Lingua Studio home">
        <span className="brand-mark">
          <BookOpen size={23} />
        </span>
        <span>
          lingua<span className="brand-light">studio</span>
        </span>
      </Link>
      <div className="workspace-label">YOUR LEARNING SPACE</div>
      <nav aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'nav-link active' : 'nav-link'}
            aria-current={pathname === href ? 'page' : undefined}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="small-label">ONE STEP AT A TIME</span>
        <p>
          A little practice.
          <br />A wider world.
        </p>
        <span>Learn at your own pace</span>
      </div>
      <div className="sidebar-bottom">
        <ThemeToggle />
        <SignOutButton />
        <div className="profile">
          <span className="avatar">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{displayName}</strong>
            <small>Personal workspace</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
