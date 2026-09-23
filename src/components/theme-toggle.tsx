'use client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      className="theme-toggle"
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun size={18} className="sun-icon" />
      <Moon size={18} className="moon-icon" />
      <span>Appearance</span>
    </button>
  );
}
