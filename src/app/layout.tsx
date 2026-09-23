import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Navigation } from '@/components/navigation';
import { readEnv } from '@/lib/env';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'Lingua Studio — Your learning space',
    template: '%s | Lingua Studio',
  },
  description: 'A personal space for thoughtful language learning.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  readEnv();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <div className="app-shell">
            <Navigation />
            <div className="main-shell">
              <header className="topbar">
                <span>Personal learning studio</span>
                <span className="language-pill">
                  EN <span>English</span>
                </span>
              </header>
              <main id="main" tabIndex={-1}>
                {children}
              </main>
              <footer>
                Built for understanding, one day at a time.
                <span>Foundation edition · 01</span>
              </footer>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
