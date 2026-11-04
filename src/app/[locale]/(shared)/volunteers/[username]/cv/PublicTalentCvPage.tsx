'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  hoursFromMinutes,
  localizedName,
  publicDisplayName,
  registryCode,
  resolvePublicProfileSections,
} from '@/lib/api/publicTalent';
import { usePublicTalentProfileQuery } from '@/hooks/usePublicTalent';
import { PublicMediaImage } from '../PublicMediaParts';

// Public volunteer CV (Task 10, D2 Option A). The browser prints this page to
// PDF, which keeps Arabic shaping/RTL perfect without a bundled font or a
// shaping library. Every section comes from the SAME public profile payload and
// `resolvePublicProfileSections()` gates as the profile page, so an opt-out can
// never leak here:
// - `firstName` only when `showBiography` released it; otherwise the username.
// - `fullName` is parsed by the API but never read on this page.
// - experiences are the backend's public-only set (the gate is `showExperiences`).
// - skills and stats render only while their own gate is open.

const PRINT_CSS = `
@media print {
  [data-testid="shell-navbar"],
  [data-testid="public-footer"],
  [data-testid="cv-toolbar"] {
    display: none !important;
  }
  body {
    background: #ffffff !important;
  }
  [data-testid="cv-page"] {
    max-width: none !important;
    padding: 0 !important;
  }
  [data-testid="cv-page"] article {
    border: 0 !important;
    padding: 0 !important;
  }
  @page {
    margin: 14mm;
  }
}
`;

function formatDate(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PublicTalentCvPage({
  locale,
  username,
  autoPrint = false,
}: {
  locale: string;
  username: string;
  autoPrint?: boolean;
}) {
  const t = useTranslations('publicTalent');
  const profileQuery = usePublicTalentProfileQuery(username);
  const profile = profileQuery.data ?? null;
  const sections = useMemo(
    () => (profile ? resolvePublicProfileSections(profile) : null),
    [profile],
  );
  const [origin, setOrigin] = useState('');
  const printed = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // The profile's "Download CV" action opens `?print=1`; open the browser print
  // dialog once the real profile has rendered. The manual toolbar button stays
  // available when the parameter is absent.
  useEffect(() => {
    if (!autoPrint || !profileQuery.isSuccess || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(timer);
  }, [autoPrint, profileQuery.isSuccess]);

  const organizations = useMemo(() => {
    if (!sections?.experiences.open) return [];
    const seen = new Set<string>();
    const out: { key: string; name: string }[] = [];
    for (const experience of sections.experiences.data) {
      const name = localizedName(experience.organization, locale);
      if (name === '') continue;
      const key = experience.organization?.slug ?? name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, name });
    }
    return out;
  }, [sections, locale]);

  const totalHours = useMemo(() => {
    if (!sections) return null;
    // Prefer the listed public rows so the total matches the visible list; fall
    // back to the converted stat when only `showStats` is open.
    if (sections.experiences.open && sections.experiences.data.length > 0) {
      const minutes = sections.experiences.data.reduce(
        (sum, experience) => sum + experience.duration,
        0,
      );
      return hoursFromMinutes(minutes) ?? '0';
    }
    if (sections.stats.open && sections.stats.data) {
      return hoursFromMinutes(sections.stats.data.volunteerHours) ?? '0';
    }
    return null;
  }, [sections]);

  if (profileQuery.isPending) return <Loader label={t('shared.loading')} />;

  if (profileQuery.isError) {
    const error = mapToApiError(profileQuery.error);
    if (error.statusCode === 404) {
      return (
        <Container testId="cv-page" className="flex flex-col gap-6 py-4">
          <Empty
            title={t('profile.notFoundTitle')}
            description={t('profile.notFoundBody')}
          />
        </Container>
      );
    }
    return (
      <Container testId="cv-page" className="flex flex-col items-start gap-4 py-4">
        <p role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <Button variant="secondary" onClick={() => profileQuery.refetch()}>
          {t('shared.retry')}
        </Button>
      </Container>
    );
  }

  if (!profile || !sections) return <Loader label={t('shared.loading')} />;

  const displayName = publicDisplayName(sections.bio.data.firstName, profile.username);
  const code = registryCode(profile.registryId, 'VOL');
  const headline = sections.bio.open ? sections.bio.data.headline : null;
  const bio = sections.bio.open ? sections.bio.data.bio : null;
  const skills = sections.skills.open ? sections.skills.data : [];
  const experiences = sections.experiences.open ? sections.experiences.data : [];
  const completedTasks =
    sections.stats.open && sections.stats.data
      ? sections.stats.data.completedTasks
      : null;
  const profilePath = `/${locale}/volunteers/${encodeURIComponent(profile.username)}`;
  const profileUrl = origin ? `${origin}${profilePath}` : profilePath;

  return (
    <Container testId="cv-page" className="flex flex-col gap-6 py-6 print:py-0">
      <style>{PRINT_CSS}</style>

      <div
        data-testid="cv-toolbar"
        className="flex flex-wrap items-center justify-between gap-3 print:hidden"
      >
        <Link
          href={`/volunteers/${profile.username}`}
          className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t('cv.backToProfile')}
        </Link>
        <Button onClick={() => window.print()}>{t('cv.print')}</Button>
      </div>

      <article className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 print:border-0 print:p-0">
        <header
          data-testid="cv-header"
          className="flex items-start gap-4 border-b border-border pb-4"
        >
          {sections.avatar.open && profile.avatar ? (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface-muted">
              <PublicMediaImage media={{ mediaId: profile.avatar }} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {t('cv.title')}
            </p>
            <h1 data-testid="cv-name" className="text-2xl font-bold text-ink">
              {displayName}
            </h1>
            {headline ? <p className="text-sm text-ink-muted">{headline}</p> : null}
            {code ? (
              <p className="text-xs text-ink-muted">
                {t('profile.registryCode')}: {code}
              </p>
            ) : null}
          </div>
        </header>

        {bio ? (
          <section data-testid="cv-about" className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-ink">{t('cv.about')}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{bio}</p>
          </section>
        ) : null}

        {skills.length > 0 ? (
          <section data-testid="cv-skills" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{t('cv.skills')}</h2>
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => {
                const name = localizedName(skill, locale);
                if (name === '') return null;
                return (
                  <li
                    key={skill.skillId}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <span className="font-medium text-ink">{name}</span>
                    {typeof skill.level === 'number' ? (
                      <span className="text-ink-muted">
                        {' '}
                        · {t('cv.skillLevel', { level: skill.level })}
                      </span>
                    ) : null}
                    {skill.isPrimary ? (
                      <span className="font-medium text-gold-strong">
                        {' '}
                        · {t('cv.skillPrimary')}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {experiences.length > 0 ? (
          <section data-testid="cv-experiences" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{t('cv.experiences')}</h2>
            <ul className="flex flex-col gap-3">
              {experiences.map((experience) => {
                const organization = localizedName(experience.organization, locale);
                const date = formatDate(experience.verifiedAt, locale);
                const hours = hoursFromMinutes(experience.duration);
                return (
                  <li
                    key={experience.id}
                    data-testid="cv-experience"
                    className="rounded-md border border-border p-3"
                  >
                    <p className="font-semibold text-ink">{experience.title}</p>
                    <p className="text-sm text-ink-muted">
                      {organization}
                      {date ? ` · ${t('cv.verifiedOn', { date })}` : ''}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-ink">
                      {hours ? <span>{t('cv.experienceHours', { hours })}</span> : null}
                      {experience.verificationCode ? (
                        <span data-testid="cv-experience-code">
                          {t('cv.experienceCode', { code: experience.verificationCode })}
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {totalHours !== null || completedTasks !== null ? (
          <section data-testid="cv-summary" className="grid grid-cols-2 gap-3">
            {totalHours !== null ? (
              <div data-testid="cv-total-hours" className="rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('cv.totalHours')}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {t('cv.experienceHours', { hours: totalHours })}
                </p>
              </div>
            ) : null}
            {completedTasks !== null ? (
              <div data-testid="cv-completed-tasks" className="rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('cv.completedTasks')}
                </p>
                <p className="text-lg font-semibold text-ink">{completedTasks}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {organizations.length > 0 ? (
          <section data-testid="cv-organizations" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{t('cv.organizations')}</h2>
            <ul className="flex flex-wrap gap-2">
              {organizations.map((organization) => (
                <li
                  key={organization.key}
                  className="rounded-md bg-surface-muted px-2 py-1 text-sm text-ink"
                >
                  {organization.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer
          data-testid="cv-footer"
          className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-ink-muted"
        >
          <p>
            {t('cv.profileUrl')}:{' '}
            <a href={profileUrl} className="font-medium text-gold-strong hover:underline">
              {profileUrl}
            </a>
          </p>
          <p>
            {t('cv.verifyNote')}{' '}
            <Link href="/verify" className="font-medium text-gold-strong hover:underline">
              {t('cv.verifyLink')}
            </Link>
            .
          </p>
          <p>{t('cv.footerNote')}</p>
        </footer>
      </article>
    </Container>
  );
}
