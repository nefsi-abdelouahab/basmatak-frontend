'use client';

import { ArrowDown, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgentError } from '@/lib/api/aiAgent';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { SourceChips } from './SourceChips';
import { TypingIndicator, type TypingPhase } from './TypingIndicator';
import { errorMessageKey, retryAfterDescriptor } from './aiAgentUi';

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
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

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
  const isUser = message.role === 'user';
  const retryAfter = retryAfterDescriptor(error?.retryAfterSeconds);

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
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-primary text-white'
            : 'border border-border bg-surface-muted text-ink'
        }`}
      >
        {message.content.length > 0 ? (
          <div aria-hidden={message.status === 'streaming' ? true : undefined}>
            <p
              dir="auto"
              className="whitespace-pre-wrap break-words text-start text-body-md"
            >
              {message.content}
            </p>
          </div>
        ) : null}

        {message.status === 'streaming' ? (
          <div className={message.content.length > 0 ? 'mt-2' : ''}>
            <TypingIndicator phase={typingPhase} />
          </div>
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

      {!isUser && message.sources !== undefined ? (
        <div className="w-full max-w-[85%]">
          <SourceChips sources={message.sources} />
        </div>
      ) : null}
    </article>
  );
}
