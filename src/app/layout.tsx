import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
