'use client';

import { ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import type { AiAgentOpportunityCard } from '@/lib/api/aiAgent';
import {
  cardModeKey,
  cardNameFor,
  formatCardDate,
  safeChatHref,
  stripChatLocalePrefix,
} from '../aiAgentUi';

export interface OpportunityChatCardProps {
  card: AiAgentOpportunityCard;
}

/**
 * A compact opportunity summary inside the chat. Every field comes from the
 * sanitized tool result; the link is revalidated here so an unsafe href can
 * never become an app-router link.
 */
export function OpportunityChatCard({ card }: OpportunityChatCardProps) {
  const t = useTranslations('aiAgent');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const href = safeChatHref(card.href, locale);
  const organization = cardNameFor(card.organizationName, locale);
  const wilaya = cardNameFor(card.wilayaName, locale);
  const startDate = formatCardDate(card.startDate, locale);
  const deadline = formatCardDate(card.applicationDeadline, locale);
  const modeKey = cardModeKey(card.mode);

  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label-xs font-medium text-ink-muted">
              {t('cards.opportunity')}
            </p>
            <p
              dir="auto"
              className="mt-0.5 break-words text-body-sm font-semibold text-ink"
            >
              {card.title}
            </p>
            {organization !== undefined ? (
              <p dir="auto" className="text-label-xs text-ink-muted">
                {organization}
              </p>
            ) : null}
          </div>
          {modeKey !== null ? (
            <Pill tone="neutral">{t(`cards.modes.${modeKey}`)}</Pill>
          ) : null}
        </div>

        <ul className="space-y-1 text-label-xs text-ink-muted">
          {wilaya !== undefined ? (
            <li dir="auto">{wilaya}</li>
          ) : null}
          {startDate !== null ? (
            <li>{t('cards.startsOn', { date: startDate })}</li>
          ) : null}
          {deadline !== null ? (
            <li>{t('cards.applyBy', { date: deadline })}</li>
          ) : null}
          {card.openPositions !== undefined ? (
            <li>
              {t('cards.openPositions', { count: card.openPositions })}
            </li>
          ) : null}
        </ul>

        {href !== null ? (
          <Link
            href={stripChatLocalePrefix(href)}
            className="inline-flex min-h-9 items-center gap-1 text-label-sm font-medium text-gold-strong underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {t('cards.viewOpportunity')}
            <ArrowUpRight
              aria-hidden="true"
              size={14}
              className="shrink-0 rtl:-scale-x-100"
            />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
