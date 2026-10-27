'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AiAgentSourcesEvent } from '@/lib/api/aiAgent';
import { safeSourceHref } from './aiAgentUi';

export interface SourceChipsProps {
  sources: AiAgentSourcesEvent;
}

interface ChipItem {
  key: string;
  typeLabel: string;
  title: string;
  href: string | null;
}

export function SourceChips({ sources }: SourceChipsProps) {
  const t = useTranslations('aiAgent');

  const items: ChipItem[] = [
    ...sources.knowledge.map((source) => ({
      key: `knowledge-${source.id}`,
      typeLabel: t('sources.knowledge'),
      title: source.title,
      href: null,
    })),
    ...sources.data.map((source) => ({
      key: `data-${source.id}`,
      typeLabel: t(`sources.${source.type}`),
      title: source.title,
      href: safeSourceHref(source.path),
    })),
  ];

  if (items.length === 0) return null;

  return (
    <section className="mt-2 space-y-1.5">
      <p className="text-label-xs font-medium text-ink-muted">
        {t('sources.title')}
      </p>
      <ul
        aria-label={t('sources.listLabel')}
        className="flex flex-wrap gap-1.5"
      >
        {items.map((item) => {
          const content = (
            <>
              <span className="shrink-0 text-label-xs text-ink-muted">
                {item.typeLabel}
              </span>
              <span dir="auto" className="min-w-0 break-words">
                {item.title}
              </span>
            </>
          );

          return (
            <li key={item.key} className="max-w-full">
              {item.href === null ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-body-sm text-ink">
                  {content}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-body-sm text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
