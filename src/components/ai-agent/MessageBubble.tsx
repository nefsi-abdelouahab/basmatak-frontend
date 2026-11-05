'use client';

import { Fragment } from 'react';
import { ArrowDown, ArrowUpRight, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AiAgentError } from '@/lib/api/aiAgent';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { TypingIndicator, type TypingPhase } from './TypingIndicator';
import {
  OrganizationChatCard,
  OpportunityChatCard,
  StatsChatCard,
} from './cards';
import {
  detectTextDirection,
  errorMessageKey,
  parseChatContent,
  retryAfterDescriptor,
  stripChatLocalePrefix,
} from './aiAgentUi';

export interface MessageBubbleProps {
  message: AiChatMessage;
  error?: AiAgentError | null;
  canRetry?: boolean;
  canContinue?: boolean;
  typingPhase?: TypingPhase;
  onRetry?: () => void;
  onContinue?: () => void;
}

const ACTION_CLASSES =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const LINK_CLASSES =
  'text-gold-strong underline underline-offset-2 hover:text-gold-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const USER_LINK_CLASSES =
  'underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

const CARD_LINK_CLASSES =
  'my-1 inline-flex max-w-full items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 text-start text-body-sm font-medium text-gold-strong transition-colors hover:border-gold-strong/40 hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

export function MessageBubble({
  message,
  error = null,
  canRetry = false,
  canContinue = false,
  typingPhase = 'default',
  onRetry,
  onContinue,
}: MessageBubbleProps) {
  const t = useTranslations('aiAgent');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const isUser = message.role === 'user';
  const retryAfter = retryAfterDescriptor(error?.retryAfterSeconds);
  const segments = parseChatContent(message.content, locale);
  const direction = detectTextDirection(message.content);
  const waitingForFirstToken =
    message.status === 'streaming' && message.content.length === 0;

  const cards = isUser ? [] : (message.cards?.cards ?? []);
  const structuredCardHrefs = new Set(
    cards
      .filter((card) => card.kind !== 'stats')
      .map((card) => stripChatLocalePrefix(card.href)),
  );
  const renderedCards: typeof cards = [];
  const seenCardHrefs = new Set<string>();
  for (const card of cards) {
    if (card.kind === 'stats') {
      renderedCards.push(card);
      continue;
    }
    const href = stripChatLocalePrefix(card.href);
    if (seenCardHrefs.has(href)) continue;
    seenCardHrefs.add(href);
    renderedCards.push(card);
  }

  return (
    <article
      data-testid="ai-agent-message"
      data-role={message.role}
      className={`flex w-full flex-col ${isUser ? 'items-end' : 'items-start'}`}
    >
      <span className="sr-only">
        {isUser ? t('message.you') : t('message.assistant')}
      </span>

      <div
        className={`max-w-[85%] rounded-[16px] px-3.5 py-2.5 ${
          isUser
            ? 'rounded-ee-[6px] bg-primary text-on-primary'
            : 'rounded-es-[6px] border border-border bg-surface text-ink'
        }`}
      >
        {message.content.length > 0 ? (
          <div aria-hidden={message.status === 'streaming' ? true : undefined}>
            <p
              dir={direction}
              className="whitespace-pre-wrap break-words text-start text-body-md"
            >
              {segments.map((segment, index) =>
                segment.type === 'link' ? (
                  isUser ||
                  segment.kind === 'inline' ||
                  structuredCardHrefs.has(
                    stripChatLocalePrefix(segment.href),
                  ) ? (
                    <Link
                      key={`${segment.href}-${index}`}
                      href={stripChatLocalePrefix(segment.href)}
                      className={
                        isUser ? USER_LINK_CLASSES : LINK_CLASSES
                      }
                    >
                      {segment.text}
                    </Link>
                  ) : (
                    <Link
                      key={`${segment.href}-${index}`}
                      href={stripChatLocalePrefix(segment.href)}
                      data-link-card="true"
                      className={CARD_LINK_CLASSES}
                    >
                      <span
                        dir="auto"
                        className="min-w-0 flex-1 break-words"
                      >
                        {segment.text}
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        size={14}
                        className="shrink-0 text-ink-muted rtl:-scale-x-100"
                      />
                    </Link>
                  )
                ) : (
                  <Fragment key={`text-${index}`}>{segment.text}</Fragment>
                ),
              )}
            </p>
          </div>
        ) : null}

        {waitingForFirstToken ? (
          <TypingIndicator phase={typingPhase} />
        ) : null}

        {message.status === 'aborted' ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-label-sm text-ink-muted">
            <span>{t('message.stopped')}</span>
            {canRetry && onRetry !== undefined ? (
              <button type="button" className={ACTION_CLASSES} onClick={onRetry}>
                <RotateCcw aria-hidden="true" size={14} />
                {t('message.retry')}
              </button>
            ) : null}
          </div>
        ) : null}

        {message.status === 'error' ? (
          <div className="mt-2 space-y-2 border-t border-status-error/30 pt-2">
            <p className="text-label-sm font-medium text-status-error">
              {t('message.errorTitle')}
            </p>
            <p dir="auto" className="text-body-sm text-ink">
              {t(`errors.${errorMessageKey(error?.code)}`)}
            </p>
            {retryAfter !== null ? (
              <p className="text-label-sm text-ink-muted">
                {t(`errors.retryIn${retryAfter.unit === 'seconds' ? 'Seconds' : retryAfter.unit === 'minutes' ? 'Minutes' : 'Hours'}`, {
                  count: retryAfter.count,
                })}
              </p>
            ) : null}
            {canRetry && onRetry !== undefined ? (
              <button type="button" className={ACTION_CLASSES} onClick={onRetry}>
                <RotateCcw aria-hidden="true" size={14} />
                {t('message.retry')}
              </button>
            ) : null}
          </div>
        ) : null}

        {message.status === 'complete' && message.truncated === true ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-label-sm text-ink-muted">
            <span>{t('message.shortened')}</span>
            {canContinue && onContinue !== undefined ? (
              <button
                type="button"
                className={ACTION_CLASSES}
                onClick={onContinue}
              >
                <ArrowDown aria-hidden="true" size={14} />
                {t('message.continue')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {renderedCards.length > 0 ? (
        <div
          data-testid="ai-agent-cards"
          className="mt-2 w-full max-w-[85%] space-y-2"
        >
          {renderedCards.map((card) => {
            if (card.kind === 'opportunity') {
              return (
                <OpportunityChatCard
                  key={`opportunity-${card.href}`}
                  card={card}
                />
              );
            }
            if (card.kind === 'organization') {
              return (
                <OrganizationChatCard
                  key={`organization-${card.href}`}
                  card={card}
                />
              );
            }
            return <StatsChatCard key="stats" card={card} />;
          })}
        </div>
      ) : null}
    </article>
  );
}
