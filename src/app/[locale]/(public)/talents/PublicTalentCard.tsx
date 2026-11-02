'use client';

import { ArrowRight, BadgeCheck, Briefcase, Calendar, CheckCheck, Clock, MapPin, ShieldCheck, Tags } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { usePublicMediaQuery, usePublicTalentProfileQuery } from '@/hooks/usePublicTalent';
import {
  hoursFromMinutes,
  localizedName,
  publicDisplayName,
  type PublicExperience,
  type PublicTalentCard as PublicTalentCardData,
} from '@/lib/api/publicTalent';
import { useTranslations } from 'next-intl';

// Discover directory row (Public Discover Talents design). Thin card
// projection: name, bio, wilaya, skills, stats. The ONE embedded latest
// experience comes from the volunteer's public profile (`experiences[0]` is
// backend-ordered newest-first); a closed/empty experiences gate omits the
// sub-block entirely — never fabricated. No save affordance on public rows.

function RowAvatar({ mediaId, name }: { mediaId: string | null; name: string }) {
  const query = usePublicMediaQuery(mediaId ?? '');
  const url =
    (mediaId ? (query.data?.url ?? query.data?.media?.url ?? null) : null) ?? '/user.jpg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guest-resolved signed URL on a public page
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
      }}
      className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-gold-strong/30"
    />
  );
}

function monthYear(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function LatestExperience({
  experience,
  locale,
}: {
  experience: PublicExperience;
  locale: string;
}) {
  const t = useTranslations('publicTalent');
  const beneficiary = localizedName(experience.organization, locale);
  const date = monthYear(experience.verifiedAt, locale);
  const hours = hoursFromMinutes(experience.duration);
  return (
    <div
      data-testid="talent-latest-exp"
      className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-muted p-3.5 text-sm md:flex-row md:items-center"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-status-success" />
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-status-success">
            {t('discover.latestExperience')}
          </p>
          <p className="text-sm font-medium text-ink">{experience.title}</p>
          {beneficiary ? (
            <p className="text-sm text-ink-muted">
              {t('discover.beneficiary')}: <span className="text-ink">{beneficiary}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-2 text-sm text-ink-muted md:flex-col md:items-end md:border-t-0 md:pt-0">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <Calendar aria-hidden="true" size={14} className="text-ink-muted" />
          {date && hours ? t('discover.dateHours', { date, hours }) : (date ?? hours ?? '')}
        </span>
        {experience.review != null ? (
          <span className="flex items-center gap-1 text-xs text-status-success">
            <CheckCheck aria-hidden="true" size={14} />
            {t('discover.approvedByOrg')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function PublicTalentCard({
  item,
  locale,
  wilayaLabel,
}: {
  item: PublicTalentCardData;
  locale: string;
  wilayaLabel: string | null;
}) {
  const t = useTranslations('publicTalent');
  const name = publicDisplayName(item.firstName, item.username);
  const verifiedCount = item.stats?.verifiedExperiences ?? 0;
  const hours = item.stats?.volunteerHours ?? 0;
  const profileQuery = usePublicTalentProfileQuery(item.username);
  const latest = profileQuery.data?.experiences?.[0] ?? null;

  return (
    <article data-testid="public-talent-card" className="p-6 transition-colors hover:bg-surface-muted/50">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <RowAvatar mediaId={item.avatar ?? null} name={name} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                <Link href={`/volunteers/${item.username}`} className="transition-colors hover:text-gold-strong">
                  {name}
                </Link>
              </h2>
              {verifiedCount > 0 ? (
                <span
                  data-testid="talent-verified-badge"
                  className="inline-flex items-center gap-1 text-xs font-medium text-status-success"
                >
                  <BadgeCheck aria-hidden="true" size={14} />
                  {t('discover.verifiedBadge')}
                </span>
              ) : null}
            </div>
            {item.bio ? <p className="text-sm leading-snug text-ink">{item.bio}</p> : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-sm text-ink-muted">
              {wilayaLabel ? (
                <span className="inline-flex items-center gap-1 font-medium text-ink">
                  <MapPin aria-hidden="true" size={16} className="text-ink-muted" />
                  {wilayaLabel}
                </span>
              ) : null}
              {(item.skills ?? []).map((skill, index) => (
                <span key={skill.skillId} className="inline-flex items-center gap-2">
                  {index === 0 ? (
                    <Tags aria-hidden="true" size={14} className="text-ink-muted" />
                  ) : (
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                  )}
                  <span>{locale === 'ar' ? skill.nameAr : skill.nameFr}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-end justify-between gap-3 pt-2 lg:flex-col lg:items-end lg:justify-start lg:pt-0">
          <div className="text-end">
            <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-ink">
              <Briefcase aria-hidden="true" size={14} className="text-ink-muted" />
              {t('discover.experiencesCount', { count: verifiedCount })}
            </p>
            <p className="flex items-center justify-end gap-1.5 text-sm text-ink-muted">
              <Clock aria-hidden="true" size={14} />
              {t('discover.hoursLogged', { hours })}
            </p>
          </div>
          <Link
            href={`/volunteers/${item.username}`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            {t('discover.viewProfile')}
            <ArrowRight aria-hidden="true" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
      {latest ? <LatestExperience experience={latest} locale={locale} /> : null}
    </article>
  );
}
