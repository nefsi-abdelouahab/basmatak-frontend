'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { useVolunteerHomeDashboardQuery } from '@/hooks/useFeed';
import type { LatestVerifiedExperience } from '@/lib/api/feed';
import { RequireVolunteer, SectionError } from '../components';

// OQ1: stat cards bind to whatever keys GET /volunteers/me/dashboard
// returns — no fixed design-set assumed. Primitive values render one card
// per key; non-primitives are skipped, never invented.
function formatStatKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatStatValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return null;
}

function StatsGrid({ stats }: { stats: Record<string, unknown> | null | undefined }) {
  const t = useTranslations('volunteerHome');
  const entries = Object.entries(stats ?? {}).filter(([, v]) => formatStatValue(v) !== null);
  if (entries.length === 0) return null;
  return (
    <Card title={t('dashboard.statsTitle')}>
      <dl data-testid="dashboard-stats" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-md border border-border-muted bg-surface-muted p-3">
            <dt className="text-xs text-ink-muted">{formatStatKey(key)}</dt>
            <dd data-testid={`dashboard-stat-${key}`} className="text-xl font-semibold text-ink">
              {formatStatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function LatestExperience({ experience, locale }: { experience: LatestVerifiedExperience | null | undefined; locale: string }) {
  const t = useTranslations('volunteerHome');
  if (!experience) {
    return (
      <Empty
        title={t('dashboard.latestEmptyTitle')}
        description={t('dashboard.latestEmptyBody')}
        action={
          <Link href={`/volunteer/opportunities`}>
            <Button type="button" variant="primary" size="sm">
              {t('dashboard.latestEmptyCta')}
            </Button>
          </Link>
        }
      />
    );
  }
  const date = experience.verifiedAt
    ? new Date(experience.verifiedAt).toLocaleDateString(locale)
    : null;
  return (
    <Card title={t('dashboard.latestTitle')}>
      <div data-testid="dashboard-latest" className="flex flex-col gap-1">
        {experience.organizationName ? (
          <p className="text-sm font-medium text-ink">
            {t('dashboard.verifiedBy', { org: experience.organizationName })}
          </p>
        ) : null}
        {date ? <p className="text-sm text-ink-muted">{t('dashboard.verifiedOn', { date })}</p> : null}
        {experience.verificationCode ? (
          <p className="text-sm text-ink-muted">{t('dashboard.codeLabel', { code: experience.verificationCode })}</p>
        ) : null}
        {experience.registryId ? (
          <p data-testid="dashboard-latest-ref" className="text-sm text-ink-muted">
            EXP-{experience.registryId}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function VolunteerDashboardPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerHome');
  const dashboardQuery = useVolunteerHomeDashboardQuery();
  return (
    <RequireVolunteer locale={locale} next={`/volunteer/dashboard`}>
      <div data-testid="volunteer-dashboard" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('dashboard.title')}</h1>
          <p className="text-sm text-ink-muted">{t('dashboard.subtitle')}</p>
        </div>
        {dashboardQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : dashboardQuery.isError ? (
          <SectionError testId="dashboard-error" message={t('shared.loadError')} />
        ) : (
          <>
            <Card title={t('dashboard.completionLabel')}>
              <p data-testid="dashboard-completion" className="text-2xl font-semibold text-ink">
                {t('dashboard.completionValue', { percent: dashboardQuery.data.completionPercent })}
              </p>
            </Card>
            <StatsGrid stats={dashboardQuery.data.stats} />
            <LatestExperience experience={dashboardQuery.data.latestVerifiedExperience} locale={locale} />
          </>
        )}
      </div>
    </RequireVolunteer>
  );
}
