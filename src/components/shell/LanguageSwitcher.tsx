'use client';

import { useEffect, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { NavIconLink } from './NavIconLink';

const LOCALE_SWITCH_Y = 'locale-switch-y';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const other = routing.locales.filter((l) => l !== locale);
  // Cross-`[locale]` navigation remounts the React tree (fresh `<html
  // lang dir>`, fresh messages: refs and component state do not survive),
  // and Next scrolls the fresh tree to the top even with `scroll={false}`.
  // The reader's offset therefore rides in `sessionStorage` across the
  // remount and is re-applied until it sticks. Still a client-side
  // transition throughout: no document reload, no jump to the top.
  useEffect(() => {
    const stored = sessionStorage.getItem(LOCALE_SWITCH_Y);
    if (stored === null) return;
    const y = Number(stored);
    if (!Number.isFinite(y) || y <= 0) {
      sessionStorage.removeItem(LOCALE_SWITCH_Y);
      return;
    }
    // The fresh tree streams in, so the target offset may not be reachable
    // on the first frames (scrollTo clamps to the current height): keep
    // re-applying until it sticks or 5s pass, then drop the key.
    const deadline = Date.now() + 5000;
    let rafId = 0;
    const settle = () => {
      window.scrollTo(0, y);
      if (window.scrollY === y || Date.now() > deadline) {
        sessionStorage.removeItem(LOCALE_SWITCH_Y);
        return;
      }
      rafId = requestAnimationFrame(settle);
    };
    rafId = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(rafId);
  }, []);

  function switchLocale(next: Locale) {
    return (event: MouseEvent) => {
      event.preventDefault();
      try {
        sessionStorage.setItem(LOCALE_SWITCH_Y, String(window.scrollY));
      } catch {
        // Non-fatal: the switch still navigates, just without scroll restore.
      }
      router.replace(pathname, { locale: next, scroll: false });
    };
  }

  return (
    <span data-testid="language-switcher" className="flex items-center gap-2">
      <span className="sr-only">{t('language.label')}</span>
      {other.map((l) => (
        <NavIconLink
          key={l}
          href={pathname}
          locale={l}
          // Client-side locale transition (no document reload) that keeps
          // the reader's scroll position instead of jumping to the top.
          scroll={false}
          onClick={switchLocale(l)}
          label={l === 'ar' ? t('language.arabic') : t('language.english')}
          icon={<Languages size={18} aria-hidden="true" />}
          className="inline-flex"
        />
      ))}
    </span>
  );
}
