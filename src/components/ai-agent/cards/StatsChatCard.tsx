'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { AiAgentStatsCard } from '@/lib/api/aiAgent';

export interface StatsChatCardProps {
  card: AiAgentStatsCard;
}

const STAT_KEYS = [
  'publishedOpportunities',
  'verifiedOrganizations',
  'activeSkills',
  'wilayas',
  'municipalities',
] as const;

/** The five public platform counts, rendered as a compact labelled grid. */
export function StatsChatCard({ card }: StatsChatCardProps) {
  const t = useTranslations('aiAgent');

  return (
    <Card>
      <p className="text-label-xs font-medium text-ink-muted">
        {t('cards.stats')}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
        {STAT_KEYS.map((key) => (
          <div key={key} className="min-w-0">
            <dt className="text-label-xs text-ink-muted">
              {t(`cards.${key}`)}
            </dt>
            <dd className="text-body-sm font-semibold text-ink">
              {card[key].toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
