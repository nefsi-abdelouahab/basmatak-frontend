'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { SettingsCard } from './settings-ui';

// Design Language section, wired to the real locale routing (same
// client-side transition as the shell language switcher, no reload).
export function LanguageSection() {
  const t = useTranslations('volunteerAccount');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: Locale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  const stamp = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  return (
    <SettingsCard
      id="section-language"
      title={t('settings.languageTitle')}
      hint={t('settings.languageHint')}
    >
      <div data-testid="settings-language" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-label-sm font-semibold text-ink">
            {t('settings.interfaceLanguageLabel')}
          </span>
          <div role="radiogroup" aria-label={t('settings.interfaceLanguageLabel')} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {routing.locales.map((code) => {
              const selected = locale === code;
              const name =
                code === 'ar' ? t('settings.languageArabic') : t('settings.languageEnglish');
              const hint =
                code === 'ar'
                  ? t('settings.languageArabicHint')
                  : t('settings.languageEnglishHint');
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`language-option-${code}`}
                  onClick={() => switchLocale(code)}
                  className={`flex items-start gap-3 rounded-lg p-3.5 text-start transition-colors ${
                    selected
                      ? 'bg-gold-soft text-gold-strong'
                      : 'bg-surface-muted text-ink hover:bg-border-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? 'border-gold-strong' : 'border-border'
                    }`}
                  >
                    {selected ? <Check size={12} className="text-gold-strong" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="inline-flex flex-wrap items-center gap-2 text-label-md font-semibold text-ink">
                      {name}
                      {selected ? (
                        <span className="rounded bg-surface px-2 py-0.5 text-label-xs font-medium text-gold-strong">
                          {t('settings.languageActive')}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-body-sm text-ink-muted">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-2 rounded-lg bg-surface-muted p-3.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col">
            <span className="text-label-sm font-semibold text-ink">{t('settings.timestampTitle')}</span>
            <span className="text-body-sm text-ink-muted">{t('settings.timestampHint')}</span>
          </div>
          <span className="shrink-0 rounded bg-surface px-2 py-1 font-mono text-label-xs text-ink-muted">
            {stamp} {t('settings.timestampSuffix')}
          </span>
        </div>
      </div>
    </SettingsCard>
  );
}
