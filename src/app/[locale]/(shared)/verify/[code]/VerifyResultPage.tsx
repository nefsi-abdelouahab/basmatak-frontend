'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import {
  hoursFromMinutes,
  humanExperienceSkillLabels,
  localizedName,
  publicDisplayName,
  registryCode,
} from '@/lib/api/publicTalent';
import { usePublicTalentSkillsQuery } from '@/hooks/usePublicTalent';
import { useVerifyQuery } from '@/hooks/useVerify';

// Public certificate result. Reads only the public proof payload: no private
// fields, no `fullName` (never sent), and `firstName` only when the backend's
// `showBiography` gate released it. Skill ids resolve through the public skills
// catalog; unresolvable ids are dropped rather than printed.

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

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export function VerifyResultPage({ locale, code }: { locale: string; code: string }) {
  const t = useTranslations('verify');
  const proofQuery = useVerifyQuery(code);
  const skillsQuery = usePublicTalentSkillsQuery();

  const skillNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const skill of skillsQuery.data ?? []) {
      const id = skill.skillId ?? skill.id ?? skill._id;
      const name =
        locale === 'ar'
          ? (skill.nameAr ?? skill.nameFr ?? skill.name)
          : (skill.nameFr ?? skill.nameAr ?? skill.name);
      if (id && name) map.set(id, name);
    }
    return map;
  }, [skillsQuery.data, locale]);

  if (proofQuery.isPending) return <Loader label={t('result.title')} />;

  if (proofQuery.isError) {
    const error = mapToApiError(proofQuery.error);
    if (error.statusCode === 404) {
      return (
        <Container testId="verify-not-found" className="py-10">
          <Empty
            title={t('result.notFoundTitle')}
            description={t('result.notFoundBody')}
            action={
              <Link
                href="/verify"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-strong"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {t('result.backToForm')}
              </Link>
            }
          />
        </Container>
      );
    }
    return (
      <Container testId="verify-error" className="flex flex-col items-start gap-4 py-10">
        <p role="alert" className="text-sm text-status-error">
          {t('result.loadError')}
        </p>
        <Button variant="secondary" onClick={() => proofQuery.refetch()}>
          {t('result.retry')}
        </Button>
      </Container>
    );
  }

  const proof = proofQuery.data;
  const organizationName = localizedName(proof.organization, locale);
  const organizationSlug = proof.organization?.slug;
  const handle = proof.volunteer?.handle;
  const volunteerName = handle
    ? publicDisplayName(proof.volunteer?.firstName, handle)
    : null;
  const verifiedOn = formatDate(proof.verifiedAt, locale);
  const hours = hoursFromMinutes(proof.duration);
  const expCode = registryCode(proof.registryId, 'EXP');
  const skills = humanExperienceSkillLabels(proof.skills, skillNames);
  const evidence = proof.evidence ?? [];
  const review = proof.review;

  return (
    <Container testId="verify-result" className="flex flex-col gap-5 py-8">
      <Link
        href="/verify"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ShieldCheck size={16} aria-hidden="true" />
        {t('result.backToForm')}
      </Link>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="success">
              <BadgeCheck size={14} className="me-1" aria-hidden="true" />
              {t('result.badge')}
            </Pill>
            <span
              data-testid="verify-code"
              className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs tracking-widest text-ink-muted"
            >
              {proof.verificationCode}
            </span>
          </div>
          <h1 data-testid="verify-title" className="text-2xl font-bold text-ink">
            {proof.title ?? t('result.title')}
          </h1>
          {proof.description ? (
            <p className="text-sm leading-relaxed text-ink-muted">{proof.description}</p>
          ) : null}

          <dl className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <MetaRow label={t('result.organization')}>
              {organizationName ? (
                organizationSlug ? (
                  <Link
                    href={`/orgs/${organizationSlug}`}
                    data-testid="verify-org"
                    className="font-medium text-gold-strong hover:underline"
                  >
                    {organizationName}
                  </Link>
                ) : (
                  <span data-testid="verify-org">{organizationName}</span>
                )
              ) : (
                <span className="text-ink-muted">{t('result.notPublished')}</span>
              )}
            </MetaRow>
            <MetaRow label={t('result.volunteer')}>
              {volunteerName && handle ? (
                <Link
                  href={`/volunteers/${handle}`}
                  data-testid="verify-volunteer"
                  className="font-medium text-gold-strong hover:underline"
                >
                  {volunteerName}
                </Link>
              ) : (
                <span className="text-ink-muted">{t('result.notPublished')}</span>
              )}
            </MetaRow>
            <MetaRow label={t('result.verifiedOn')}>
              {verifiedOn ?? <span className="text-ink-muted">{t('result.notPublished')}</span>}
            </MetaRow>
            <MetaRow label={t('result.duration')}>
              {hours ? (
                <span data-testid="verify-duration">{t('result.hours', { hours })}</span>
              ) : (
                <span className="text-ink-muted">{t('result.notPublished')}</span>
              )}
            </MetaRow>
            {expCode ? (
              <MetaRow label={t('result.registryCode')}>
                <span data-testid="verify-registry">{expCode}</span>
              </MetaRow>
            ) : null}
          </dl>
        </div>
      </Card>

      {skills.length > 0 ? (
        <Card title={t('result.skills')}>
          <ul data-testid="verify-skills" className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill}>
                <Pill>{skill}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {review ? (
        <Card title={t('result.review')}>
          <div data-testid="verify-review" className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink">
              {t('result.rating', { rating: review.rating })}
            </p>
            {review.notes ? (
              <p className="text-sm leading-relaxed text-ink-muted">{review.notes}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {evidence.length > 0 ? (
        <Card title={t('result.evidence')}>
          <ul data-testid="verify-evidence" className="flex flex-col gap-2">
            {evidence.map((item) => (
              <li key={item.mediaId} className="flex items-center gap-2 text-sm">
                <FileText size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
                {item.type === 'link' && item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-gold-strong hover:underline"
                  >
                    {t('result.evidenceLink')}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-ink">
                    {item.filename ?? t('result.evidenceFile')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </Container>
  );
}
