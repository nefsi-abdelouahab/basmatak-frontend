'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  normalizeTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/theme/theme';

// Explicit light/dark switch. Light is the default; the choice is persisted
// and applied on <html data-theme="dark"> so every token follows along.
export function ThemeToggle() {
  const t = useTranslations('common');
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    setTheme(normalizeTheme(document.documentElement.getAttribute('data-theme')));
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the current page still switches immediately.
    }
  }

  const label =
    theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={label}
      title={label}
      aria-pressed={theme === 'dark'}
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" size={18} />
      ) : (
        <Moon aria-hidden="true" size={18} />
      )}
    </button>
  );
}
