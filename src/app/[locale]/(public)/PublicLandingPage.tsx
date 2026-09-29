'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Archive,
  BadgeCheck,
  CircleCheck,
  ClipboardCheck,
  Compass,
  FileText,
  Gavel,
  IdCard,
  Landmark,
  ListChecks,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { backendMessageOf, mapToApiError } from '@/lib/api/errors';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  expDisplayCode,
  hoursFromMinutes,
  labelFor,
  mediaUrlOf,
  oppDisplayCode,
  oppLocationOf,
  oppSkillLabels,
  oppSlugOf,
  openSeatsOf,
  orgDisplayName,
  orgSlugOf,

  talentWilayaCodeOf,
  verifiedExperiencesOf,
  type PublicExperienceSummary,
  type PublicOppCard,
  type TalentSample,
} from '@/lib/api/publicOrgs';
import {
  usePublicMediaQuery,
  usePublicOppsQuery,
  usePublicWilayasQuery,
  useTalentExperiencesQuery,
  useTalentSamplesQuery,
} from '@/hooks/usePublicOrgs';

// Public landing. Section order mirrors design/...Public Landing Page/code.html
// (hero, philosophy, how-it-works, opportunities rows, verification showcase,
// talents, org CTA, trust, final CTA). Every value comes from the backend or a
// catalog fallback: missing text -> i18n message, missing number -> 0, missing
// image -> neutral initial-letter block, missing optional field -> omitted.
//
// Image map (files in public/landing, used directly — no placeholders):
// - hero section → /landing/Landing-1.png
// - organization CTA section → /landing/Landing-02.png
// Talent avatars resolve the real public media URL when present.
//
// Icon map (code.html Material Symbol -> lucide-react, sizes copied over):
// search -> Search, arrow_forward -> ArrowIcon (shared ui, hover-slide), verified_user -> ShieldCheck,
// explore -> Compass, location_on -> MapPin, fact_check -> ClipboardCheck,
// inventory_2 -> Archive, verified -> BadgeCheck, gavel -> Gavel,
// check_circle -> CircleCheck, badge -> IdCard, account_balance -> Landmark,
// task_alt -> ListChecks, description -> FileText.

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function SectionError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm text-status-error">
        {message}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-label-xs font-medium uppercase tracking-widest text-ink-muted">{children}</p>
  );
}

function OppRow({
  locale,
  card,
  next,
}: {
  locale: string;
  card: PublicOppCard;
  next: string;
}) {
  const t = useTranslations('publicOrgs');
  const session = useSessionQuery();

  const orgName = orgDisplayName(card.organization, locale);
  const verified = card.organization?.verificationStatus === 'verified';
  const ref = oppDisplayCode(card.registryId);
  const category = labelFor(card.categoryName, locale);
  const location = oppLocationOf(card, locale);
  const deadline = formatDate(card.applicationDeadline, locale);
  const tags = oppSkillLabels(card, locale).slice(0, 3);
  const seats = openSeatsOf(card);
  const idOrSlug = oppSlugOf(card);
  const orgSlug = orgSlugOf(card.organization);
  const applyHref = session.data ? `/volunteer/opportunities/${idOrSlug}` : getLoginHref(next);

  return (
    <div data-testid="opp-card" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {category ? (
              <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-label-xs font-medium text-primary">
                {category}
              </span>
            ) : null}
            {location ? <span className="text-body-sm text-ink-muted">{location}</span> : null}
            {location && deadline ? <span aria-hidden="true" className="text-ink-muted">•</span> : null}
            {deadline ? (
              <span className="text-body-sm text-ink-muted">
                {t('opps.deadline', { date: deadline })}
              </span>
            ) : null}
          </div>
          <h3 className="text-title-md font-semibold text-ink">{card.title ?? ''}</h3>
          {orgName ? (
            <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink-muted">
              {orgSlug ? (
                <Link href={`/orgs/${orgSlug}`} className="font-medium text-primary">
                  {orgName}
                </Link>
              ) : (
                <span>{orgName}</span>
              )}
              {verified ? (
                <span className="inline-flex items-center gap-1 font-medium text-status-success">
                  <BadgeCheck aria-hidden="true" size={16} />
                  <span>{t('landing.verifiedBadge')}</span>
                </span>
              ) : null}
            </p>
          ) : null}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Pill key={tag} tone="neutral">
                  {tag}
                </Pill>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-xs text-ink-muted">
            {seats ? <span>{t('opps.seats', { open: seats.open, total: seats.total })}</span> : null}
            {ref ? <span data-testid="opp-ref">{t('landing.ref', { ref })}</span> : null}
          </div>
        </div>
        <div className="shrink-0 lg:self-center">
          <Link
            href={applyHref}
            data-testid="apply-cta"
            className="group inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-tint px-4 text-label-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          >
            {t('landing.apply')}
            <ArrowIcon size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TalentAvatar({
  avatar,
  name,
}: {
  avatar: string | null | undefined;
  name: string;
}) {
  const isUrl = typeof avatar === 'string' && /^https?:\/\//i.test(avatar);
  const mediaQuery = usePublicMediaQuery(!isUrl ? (avatar ?? null) : null);
  const url = isUrl ? (avatar as string) : mediaUrlOf(mediaQuery.data ?? undefined);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- guest-resolved public media URL
      <img
        data-testid="talent-avatar"
        src={url}
        alt={name}
        loading="lazy"
        onError={(event) => {
          if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
        }}
        className="h-14 w-14 shrink-0 rounded-full bg-surface-muted object-cover"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local fallback portrait
    <img
      data-testid="talent-avatar-fallback"
      src="/user.jpg"
      alt=""
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-full bg-surface-muted object-cover"
    />
  );
}

function skillKeyOf(skill: unknown, index: number): string {
  if (skill !== null && typeof skill === 'object') {
    const id = (skill as { skillId?: unknown }).skillId;
    if (typeof id === 'string' && id !== '') return id;
  }
  return `skill-${index}`;
}

function skillLabelOf(skill: unknown, locale: string): string | null {
  if (typeof skill === 'string') return skill;
  if (skill !== null && typeof skill === 'object') {
    const label = labelFor(
      skill as { nameAr?: string | null; nameFr?: string | null },
      locale,
    );
    return label !== '' ? label : null;
  }
  return null;
}

function TalentCard({
  locale,
  sample,
  wilayaName,
}: {
  locale: string;
  sample: TalentSample;
  wilayaName: string | null;
}) {
  const t = useTranslations('publicOrgs');
  const name = sample.firstName ?? sample.username;
  const headline = sample.headline ?? sample.bio;
  const skills = Array.isArray(sample.skills) ? sample.skills : [];
  const expCount = verifiedExperiencesOf(sample);

  return (
    <div data-testid="sample-card" className="flex flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div>
        <div className="flex items-center gap-4">
          <TalentAvatar avatar={sample.avatar} name={name} />
          <div>
            <h3 className="text-title-md font-semibold text-ink">
              <Link href={`/volunteers/${sample.username}`} className="hover:text-primary">
                {name}
              </Link>
            </h3>
            {wilayaName ? <p className="text-body-sm text-ink-muted">{wilayaName}</p> : null}
          </div>
        </div>
        {headline ? <p className="mt-4 text-body-sm font-medium text-ink-muted">{headline}</p> : null}
        {skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.map((skill, index) => {
              const label = skillLabelOf(skill, locale);
              return label ? (
                <Pill key={skillKeyOf(skill, index)} tone="neutral">
                  {label}
                </Pill>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border-muted pt-4">
        <span className="inline-flex items-center gap-1 text-label-xs font-medium text-primary">
          <BadgeCheck aria-hidden="true" size={16} />
          <span>{t('talents.expCount', { count: expCount })}</span>
        </span>
        <Link href={`/volunteers/${sample.username}`} className="group inline-flex items-center gap-1 text-label-xs text-ink-muted hover:text-ink">
          <span>{t('talents.viewRecord')}</span>
          <ArrowIcon size={14} />
        </Link>
      </div>
    </div>
  );
}

function RecordCard({
  locale,
  record,
}: {
  locale: string;
  record: PublicExperienceSummary;
}) {
  const t = useTranslations('publicOrgs');
  const orgName = orgDisplayName(record.organization, locale);
  const orgSlug = orgSlugOf(record.organization);
  const date = formatDate(record.verifiedAt, locale);
  const hours = hoursFromMinutes(typeof record.duration === 'number' ? record.duration : null);
  const code = expDisplayCode(record.registryId) ?? record.verificationCode ?? '';
  const skills = Array.isArray(record.skills) ? record.skills.filter((s) => s !== '') : [];

  return (
    <div data-testid="sample-record-card" className="rounded-lg bg-surface-muted p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between border-b border-border-muted pb-4">
        <p className="flex items-center gap-2 text-label-sm font-semibold text-ink">
          <IdCard aria-hidden="true" size={20} className="text-primary" />
          <span>{t('showcase.recordTitle')}</span>
        </p>
        {code !== '' ? (
          <span className="font-mono text-label-xs text-ink-muted">{code}</span>
        ) : null}
      </div>
      <dl className="mt-6 space-y-4">
        <div className="rounded-md bg-surface p-3.5">
          <dt className="text-label-xs text-ink-muted">{t('showcase.roleLabel')}</dt>
          <dd className="mt-0.5 text-title-lg font-semibold text-ink">{record.title}</dd>
        </div>
        {orgName ? (
          <div className="rounded-md bg-surface p-3.5">
            <dt className="text-label-xs text-ink-muted">{t('showcase.orgLabel')}</dt>
            <dd className="mt-0.5 text-title-sm font-medium text-ink">
              {orgSlug ? (
                <Link href={`/orgs/${orgSlug}`} className="text-primary hover:text-primary-hover">
                  {orgName}
                </Link>
              ) : (
                orgName
              )}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {date !== '' ? (
            <div className="rounded-md bg-surface p-3.5">
              <dt className="text-label-xs text-ink-muted">{t('showcase.dateLabel')}</dt>
              <dd className="mt-0.5 text-title-sm font-medium text-ink">{date}</dd>
            </div>
          ) : null}
          {hours !== null ? (
            <div className="rounded-md bg-surface p-3.5">
              <dt className="text-label-xs text-ink-muted">{t('oppDetails.duration')}</dt>
              <dd className="mt-0.5 text-title-sm font-medium text-ink">
                {t('landing.hours', { hours })}
              </dd>
            </div>
          ) : null}
        </div>
        {skills.length > 0 ? (
          <div className="rounded-md bg-surface p-3.5">
            <dt className="text-label-xs text-ink-muted">{t('oppDetails.skills')}</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Pill key={skill} tone="neutral">
                  {skill}
                </Pill>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex items-center justify-between rounded-md bg-primary-tint p-3">
        <p className="flex items-center gap-2 text-label-sm font-medium text-ink">
          <BadgeCheck aria-hidden="true" size={18} className="text-primary" />
          <span>{t('landing.verified')}</span>
        </p>
        {code !== '' ? (
          <span className="text-label-xs text-ink-muted">{t('landing.code', { code })}</span>
        ) : null}
      </div>
    </div>
  );
}

const PHILOSOPHY_CARDS = [
  { icon: Compass, titleKey: 'c1Title', bodyKey: 'c1Body', metaIcon: MapPin, metaKey: 'c1Meta' },
  { icon: ClipboardCheck, titleKey: 'c2Title', bodyKey: 'c2Body', metaIcon: Archive, metaKey: 'c2Meta' },
  { icon: BadgeCheck, titleKey: 'c3Title', bodyKey: 'c3Body', metaIcon: Gavel, metaKey: 'c3Meta' },
] as const;

const HOW_STEPS = [
  { num: '01', titleKey: 's1Title', bodyKey: 's1Body' },
  { num: '02', titleKey: 's2Title', bodyKey: 's2Body' },
  { num: '03', titleKey: 's3Title', bodyKey: 's3Body' },
  { num: '04', titleKey: 's4Title', bodyKey: 's4Body' },
  { num: '05', titleKey: 's5Title', bodyKey: 's5Body' },
] as const;

const TRUST_CARDS = [
  { num: '1', titleKey: 't1Title', bodyKey: 't1Body' },
  { num: '2', titleKey: 't2Title', bodyKey: 't2Body' },
  { num: '3', titleKey: 't3Title', bodyKey: 't3Body' },
  { num: '4', titleKey: 't4Title', bodyKey: 't4Body' },
  { num: '5', titleKey: 't5Title', bodyKey: 't5Body' },
] as const;

const ORG_MINIS = [
  { icon: Landmark, titleKey: 'm1Title', bodyKey: 'm1Body' },
  { icon: ListChecks, titleKey: 'm2Title', bodyKey: 'm2Body' },
  { icon: FileText, titleKey: 'm3Title', bodyKey: 'm3Body' },
] as const;

export function PublicLandingPage({ locale }: { locale: string }) {
  const t = useTranslations('publicOrgs');
  const pathname = usePathname();

  const next = pathname || `/`;
  // Newest first, three rows — the design shows a fixed preview, not a search.
  const oppsQuery = usePublicOppsQuery(
    useMemo(() => ({ sort: 'newest', limit: 3 }), []),
  );
  const samplesQuery = useTalentSamplesQuery(3);
  const wilayasQuery = usePublicWilayasQuery();

  const oppItems = oppsQuery.data?.items ?? [];
  const sampleItems = samplesQuery.data?.items ?? [];

  const wilayaNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const wilaya of wilayasQuery.data ?? []) {
      const label =
        locale === 'ar'
          ? (wilaya.nameAr ?? wilaya.nameFr ?? '')
          : (wilaya.nameFr ?? wilaya.nameAr ?? '');
      for (const key of [wilaya._id, wilaya.id, wilaya.code]) {
        if (typeof key === 'string' && key !== '') map.set(key, label);
      }
    }
    return map;
  }, [wilayasQuery.data, locale]);

  const firstTalent = sampleItems[0]?.username ?? null;
  const recordQuery = useTalentExperiencesQuery(firstTalent);
  const recordNotFound =
    recordQuery.isError && mapToApiError(recordQuery.error).statusCode === 404;
  const record: PublicExperienceSummary | null =
    recordQuery.isSuccess ? (recordQuery.data.items[0] ?? null) : null;

  return (
    <div data-testid="public-landing">
      {/* 1. Hero */}
      <section data-section="hero" className="w-full bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-12 lg:gap-16 lg:py-20">
          <div className="flex flex-col items-start lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-label-xs text-ink-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{t('hero.eyebrow')}</span>
            </p>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tight text-ink">
              {t('landing.title')}
            </h1>
            <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-ink-muted">
              {t('landing.subtitle')}
            </p>
            <div className="mt-8 flex w-full flex-wrap items-center gap-4 sm:w-auto">
              <Link
                href="/volunteer/opportunities"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-label-md font-medium text-white transition-colors hover:bg-primary-hover"
              >
                <span>{t('hero.ctaPrimary')}</span>
                <ArrowIcon size={18} />
              </Link>
              <Link
                href="/create-account"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-6 text-label-md font-medium text-ink shadow-sm transition-colors hover:bg-surface-muted"
              >
                {t('hero.ctaSecondary')}
              </Link>
            </div>
            <p className="mt-10 flex items-center gap-2 border-t border-border-muted pt-6 text-label-sm text-ink-muted">
              <ShieldCheck aria-hidden="true" size={18} className="shrink-0 text-primary" />
              <span>{t('hero.note')}</span>
            </p>
          </div>
          <div className="flex flex-col lg:col-span-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted shadow-sm">
              <Image
                src="/landing/Landing-1.png"
                alt={t('hero.imageAlt')}
                width={1376}
                height={768}
                priority
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-md bg-surface/90 px-3 py-1.5 backdrop-blur-sm">
                <span className="text-label-xs font-medium text-ink">{t('hero.captionTitle')}</span>
                <span className="text-label-xs text-ink-muted">{t('hero.captionMeta')}</span>
              </div>
            </div>
            <p className="mt-3 text-body-sm italic text-ink-muted">{t('hero.captionNote')}</p>
          </div>
        </div>
      </section>

      {/* 2. Philosophy */}
      <section data-section="philosophy" className="w-full bg-surface-muted py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <Eyebrow>{t('philosophy.eyebrow')}</Eyebrow>
            <h2 className="mt-2 text-headline-lg font-semibold text-ink">{t('philosophy.title')}</h2>
            <p className="mt-2 text-body-lg text-ink-muted">{t('philosophy.lede')}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PHILOSOPHY_CARDS.map((card) => (
              <div key={card.titleKey} className="flex flex-col justify-between rounded-lg bg-surface p-8 shadow-sm">
                <div>
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-primary">
                    <card.icon aria-hidden="true" size={22} />
                  </div>
                  <h3 className="text-title-lg font-semibold text-ink">{t(`philosophy.${card.titleKey}`)}</h3>
                  <p className="mt-3 text-body-md leading-relaxed text-ink-muted">
                    {t(`philosophy.${card.bodyKey}`)}
                  </p>
                </div>
                <p className="mt-6 flex items-center gap-1.5 border-t border-border-muted pt-4 text-label-xs text-ink-muted">
                  <card.metaIcon aria-hidden="true" size={16} />
                  <span>{t(`philosophy.${card.metaKey}`)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section data-section="how" className="w-full bg-surface py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col justify-between gap-6 pb-12 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('how.eyebrow')}</Eyebrow>
              <h2 className="mt-2 text-headline-lg font-semibold text-ink">{t('how.title')}</h2>
            </div>
            <p className="max-w-md text-body-sm text-ink-muted">{t('how.lede')}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            {HOW_STEPS.map((step, index) => (
              <div
                key={step.num}
                className={`flex h-full flex-col justify-between rounded-md p-5 ${
                  index === HOW_STEPS.length - 1 ? 'bg-primary-tint' : 'bg-surface-muted'
                }`}
              >
                <div>
                  <span className="text-label-sm font-semibold text-primary">{step.num}</span>
                  <h4 className="mt-2 text-title-sm font-semibold text-ink">
                    {t(`how.${step.titleKey}`)}
                  </h4>
                  <p className="mt-2 text-body-sm text-ink-muted">{t(`how.${step.bodyKey}`)}</p>
                </div>
                <span className="mt-6 text-label-xs text-ink-muted">
                  {index === HOW_STEPS.length - 1
                    ? t('how.keptTag')
                    : t('how.stepOf', { n: index + 1 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Opportunities preview */}
      <section data-section="opportunities" className="w-full bg-surface-muted py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('opps.eyebrow')}</Eyebrow>
              <h2 className="mt-2 text-headline-lg font-semibold text-ink">{t('opps.title')}</h2>
              <p className="mt-1 text-body-md text-ink-muted">{t('opps.lede')}</p>
            </div>
            <Link
              href="/opportunities"
              className="group inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-hover"
            >
              <span>{t('opps.viewAll')}</span>
              <ArrowIcon size={18} />
            </Link>
          </div>
          <div data-testid="opp-feed" className="flex flex-col gap-3">
            {oppsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
            {oppsQuery.isError ? (
              <SectionError
                message={backendMessageOf(oppsQuery.error) ?? t('shared.loadError')}
                retryLabel={t('shared.retry')}
                onRetry={() => oppsQuery.refetch()}
              />
            ) : null}
            {oppsQuery.isSuccess ? (
              <>
                <p data-testid="feed-count" className="text-sm text-ink-muted">
                  {t('landing.feedCount', { total: oppsQuery.data.total })}
                </p>
                {oppItems.length === 0 ? (
                  <Empty title={t('landing.feedEmptyTitle')} description={t('landing.feedEmptyBody')} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {oppItems.map((card, index) => (
                      <OppRow
                        key={card._id ?? card.id ?? index}
                        locale={locale}
                        card={card}
                        next={next}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* 5. Verification showcase */}
      <section data-section="showcase" className="w-full bg-surface py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <Eyebrow>{t('showcase.eyebrow')}</Eyebrow>
            <h2 className="text-headline-lg font-semibold text-ink">{t('showcase.title')}</h2>
            <p className="text-body-md leading-relaxed text-ink-muted">{t('showcase.lede')}</p>
            <ul className="space-y-3 pt-4 text-body-sm text-ink">
              {[t('showcase.b1'), t('showcase.b2'), t('showcase.b3')].map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <CircleCheck aria-hidden="true" size={20} className="shrink-0 text-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            {samplesQuery.isPending ||
            (recordQuery.fetchStatus !== 'idle' && recordQuery.isPending) ? (
              <Loader label={t('shared.loading')} />
            ) : null}
            {samplesQuery.isError ? (
              <SectionError
                message={t('shared.loadError')}
                retryLabel={t('shared.retry')}
                onRetry={() => samplesQuery.refetch()}
              />
            ) : null}
            {samplesQuery.isSuccess &&
            (firstTalent === null ||
              recordNotFound ||
              (recordQuery.isSuccess && record === null)) ? (
              <div data-testid="sample-record-card">
                <Empty title={t('showcase.emptyTitle')} description={t('showcase.emptyBody')} />
              </div>
            ) : null}
            {recordQuery.isError && !recordNotFound ? (
              <SectionError
                message={backendMessageOf(recordQuery.error) ?? t('shared.loadError')}
                retryLabel={t('shared.retry')}
                onRetry={() => recordQuery.refetch()}
              />
            ) : null}
            {record ? <RecordCard locale={locale} record={record} /> : null}
          </div>
        </div>
      </section>

      {/* 6. Talents */}
      <section data-section="talents" className="w-full bg-surface-muted py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('talents.eyebrow')}</Eyebrow>
              <h2 className="mt-2 text-headline-lg font-semibold text-ink">{t('talents.title')}</h2>
              <p className="mt-1 text-body-md text-ink-muted">{t('talents.lede')}</p>
            </div>
            <Link
              href="/talents"
              className="group inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-hover"
            >
              <span>{t('talents.discover')}</span>
              <ArrowIcon size={18} />
            </Link>
          </div>
          <div data-testid="talent-samples" className="flex flex-col gap-3">
            {samplesQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
            {samplesQuery.isError ? (
              <SectionError
                message={t('shared.loadError')}
                retryLabel={t('shared.retry')}
                onRetry={() => samplesQuery.refetch()}
              />
            ) : null}
            {samplesQuery.isSuccess && sampleItems.length === 0 ? (
              <Empty title={t('landing.samplesTitle')} description={t('landing.samplesEmpty')} />
            ) : null}
            {samplesQuery.isSuccess && sampleItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {sampleItems.map((sample) => (
                  <TalentCard
                    key={sample.username}
                    locale={locale}
                    sample={sample}
                    wilayaName={
                      wilayaNames.get(talentWilayaCodeOf(sample) ?? '') ?? null
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
          <p className="mt-8 text-center text-body-sm text-ink-muted">{t('talents.browseNote')}</p>
        </div>
      </section>

      {/* 7. Organization CTA */}
      <section data-section="org-cta" className="w-full bg-surface py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted shadow-sm">
              <Image
                src="/landing/Landing-02.png"
                alt={t('orgCta.imageAlt')}
                width={1376}
                height={768}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 space-y-5 lg:order-2 lg:col-span-7">
            <Eyebrow>{t('orgCta.eyebrow')}</Eyebrow>
            <h2 className="text-headline-lg font-semibold text-ink">{t('orgCta.title')}</h2>
            <p className="text-body-lg leading-relaxed text-ink-muted">{t('orgCta.lede')}</p>
            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
              {ORG_MINIS.map((mini) => (
                <div key={mini.titleKey} className="rounded-md bg-surface-muted p-4">
                  <mini.icon aria-hidden="true" size={20} className="text-primary" />
                  <h4 className="mt-2 text-title-sm font-semibold text-ink">
                    {t(`orgCta.${mini.titleKey}`)}
                  </h4>
                  <p className="mt-1 text-body-sm text-ink-muted">{t(`orgCta.${mini.bodyKey}`)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/create-account?type=organization"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-label-md font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {t('orgCta.registerCta')}
              </Link>
              <Link
                href="/volunteer/opportunities"
                className="inline-flex h-11 items-center justify-center rounded-md bg-surface-muted px-6 text-label-md font-medium text-ink transition-colors hover:bg-border-muted"
              >
                {t('orgCta.exploreCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Trust */}
      <section data-section="trust" className="w-full bg-surface-muted py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>{t('trust.eyebrow')}</Eyebrow>
            <h2 className="mt-2 text-headline-lg font-semibold text-ink">{t('trust.title')}</h2>
            <p className="mt-2 text-body-md text-ink-muted">{t('trust.lede')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {TRUST_CARDS.map((card) => (
              <div key={card.num} className="space-y-2 rounded-lg bg-surface p-6 shadow-sm">
                <p
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-label-sm font-semibold text-primary"
                >
                  {card.num}
                </p>
                <h3 className="text-title-sm font-semibold text-ink">{t(`trust.${card.titleKey}`)}</h3>
                <p className="text-body-sm text-ink-muted">{t(`trust.${card.bodyKey}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section data-section="cta" className="w-full bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-headline-lg font-semibold text-ink">{t('cta.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-muted">{t('cta.lede')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/volunteer/opportunities"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-label-md font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {t('cta.exploreCta')}
            </Link>
            <Link
              href="/create-account"
              className="inline-flex h-11 items-center justify-center rounded-md bg-surface-muted px-6 text-label-md font-medium text-ink transition-colors hover:bg-border-muted"
            >
              {t('cta.accountCta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
