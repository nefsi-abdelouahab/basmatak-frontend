'use client';

import { ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import type { AiAgentOrganizationCard } from '@/lib/api/aiAgent';
import {
  cardNameFor,
  safeChatHref,
  stripChatLocalePrefix,
} from '../aiAgentUi';

export interface OrganizationChatCardProps {
  card: AiAgentOrganizationCard;
}

/** A compact organization summary inside the chat. */
export function OrganizationChatCard({ card }: OrganizationChatCardProps) {
  const t = useTranslations('aiAgent');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const href = safeChatHref(card.href, locale);
  const name =
    cardNameFor({ ar: card.nameAr, fr: card.nameFr }, locale) ?? card.slug;
  const wilaya = cardNameFor(card.wilayaName, locale);
  const type =
    card.type === undefined || card.type.trim() === ''
      ? undefined
      : card.type.trim();

  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label-xs font-medium text-ink-muted">
              {t('cards.organization')}
            </p>
            <p
              dir="auto"
              className="mt-0.5 break-words text-body-sm font-semibold text-ink"
            >
              {name}
            </p>
            {wilaya !== undefined ? (
              <p dir="auto" className="text-label-xs text-ink-muted">
                {wilaya}
              </p>
            ) : null}
          </div>
          {type !== undefined ? <Pill tone="neutral">{type}</Pill> : null}
        </div>

        {card.foundedYear !== undefined ? (
          <p className="text-label-xs text-ink-muted">
            {t('cards.foundedYear', { year: card.foundedYear })}
          </p>
        ) : null}

        {href !== null ? (
          <Link
            href={stripChatLocalePrefix(href)}
            className="inline-flex min-h-9 items-center gap-1 text-label-sm font-medium text-gold-strong underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {t('cards.viewOrganization')}
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
