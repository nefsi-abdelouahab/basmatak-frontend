'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Languages,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { RequireVolunteer } from '../components';
import { ContactSection } from './ContactSection';
import { PasswordSection } from './PasswordSection';
import { SessionsSection } from './SessionsSection';
import { PrivacySection } from './PrivacySection';
import { NotificationsSection } from './NotificationsSection';
import { AvailabilitySection } from './AvailabilitySection';
import { LanguageSection } from './LanguageSection';
import { DangerSection } from './DangerSection';

const NAV_ITEMS: { id: string; labelKey: string; Icon: LucideIcon; danger?: boolean }[] = [
  { id: 'section-account', labelKey: 'navAccount', Icon: ShieldCheck },
  { id: 'section-privacy', labelKey: 'navPrivacy', Icon: Eye },
  { id: 'section-notifications', labelKey: 'navNotifications', Icon: Bell },
  { id: 'section-availability', labelKey: 'navAvailability', Icon: CalendarCheck },
  { id: 'section-language', labelKey: 'navLanguage', Icon: Languages },
  { id: 'section-danger', labelKey: 'navDanger', Icon: AlertTriangle, danger: true },
];

export function VolunteerSettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
  const activeLocale = useLocale();
  const [active, setActive] = useState('section-account');
  const Caret = activeLocale === 'ar' ? ChevronLeft : ChevronRight;

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  function onNavClick(id: string) {
    return (event: MouseEvent) => {
      event.preventDefault();
      setActive(id);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  return (
    <RequireVolunteer locale={locale} next={`/volunteer/settings`}>
      <div data-testid="volunteer-settings" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <nav aria-label={t('settings.breadcrumbHome')} className="flex items-center gap-2">
            <Link
              href="/volunteer/dashboard"
              className="text-label-sm text-ink-muted transition-colors hover:text-ink"
            >
              {t('settings.breadcrumbHome')}
            </Link>
            <Caret size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
            <span aria-current="page" className="text-label-sm font-medium text-ink">
              {t('settings.title')}
            </span>
          </nav>
          <h1 className="pt-1 text-headline-lg text-ink">{t('settings.title')}</h1>
          <p className="text-body-md text-ink-muted">{t('settings.pageDescription')}</p>
        </div>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
            <nav
              aria-label={t('settings.sectionsNav')}
              className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-sm lg:flex-col"
            >
              {NAV_ITEMS.map(({ id, labelKey, Icon, danger }) => {
                const selected = active === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={onNavClick(id)}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-label-md transition-colors ${
                      selected
                        ? danger
                          ? 'bg-status-error/10 font-medium text-status-error'
                          : 'bg-gold-soft font-medium text-gold-strong'
                        : danger
                          ? 'text-status-error hover:bg-status-error/10'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" className="shrink-0" />
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      {t(`settings.${labelKey}`)}
                    </span>
                  </a>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2 rounded-xl border border-border-muted bg-surface-muted p-4">
              <div className="flex items-center gap-1.5 text-ink">
                <Scale size={16} aria-hidden="true" className="shrink-0 text-gold-strong" />
                <span className="text-label-sm font-semibold">{t('settings.civicNoticeTitle')}</span>
              </div>
              <p className="text-label-xs leading-relaxed text-ink-muted">
                {t('settings.civicNoticeBody')}
              </p>
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-6">
            <section
              id="section-account"
              aria-label={t('settings.accountTitle')}
              className="scroll-mt-24 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-1 pb-4">
                <h2 className="text-title-lg text-ink">{t('settings.accountTitle')}</h2>
                <p className="text-body-sm text-ink-muted">{t('settings.accountHint')}</p>
              </div>
              <div className="flex flex-col gap-4">
                <ContactSection />
                <PasswordSection />
                <SessionsSection />
              </div>
            </section>
            <PrivacySection />
            <NotificationsSection />
            <AvailabilitySection />
            <LanguageSection />
            <DangerSection />
          </div>
        </div>
      </div>
    </RequireVolunteer>
  );
}
