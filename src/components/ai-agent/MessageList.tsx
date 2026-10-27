'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  AiAgentError,
  AiAgentStatusEvent,
} from '@/lib/api/aiAgent';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { MessageBubble } from './MessageBubble';
import type { TypingPhase } from './TypingIndicator';

export interface MessageListProps {
  messages: AiChatMessage[];
  status: AiAgentStatusEvent | null;
  error: AiAgentError | null;
  isStreaming: boolean;
  canChat: boolean;
  canRetry: boolean;
  canContinue: boolean;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
  onContinue: () => void;
}

const SUGGESTION_KEYS = [
  'suggestion1',
  'suggestion2',
  'suggestion3',
  'suggestion4',
] as const;

export function MessageList({
  messages,
  status,
  error,
  isStreaming,
  canChat,
  canRetry,
  canContinue,
  onSuggestion,
  onRetry,
  onContinue,
}: MessageListProps) {
  const t = useTranslations('aiAgent');
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<AiChatMessage[] | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const container = scrollRef.current;
    if (container === null) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const previous = previousMessagesRef.current;
    previousMessagesRef.current = messages;

    if (messages.length === 0) {
      setAnnouncement('');
      return;
    }
    // The first render is a baseline, not an event: it prevents a hydrated or
    // newly mounted transcript from being announced as if it just finished.
    if (previous === null) return;

    const last = messages[messages.length - 1];
    if (last === undefined || last.role !== 'assistant') return;

    const previousLast = previous[previous.length - 1];
    if (
      previousLast !== undefined &&
      previousLast.id === last.id &&
      previousLast.status === last.status
    ) {
      return;
    }

    if (last.status === 'complete') {
      setAnnouncement(t('message.liveReady'));
    } else if (last.status === 'error') {
      setAnnouncement(t('message.liveError'));
    } else if (last.status === 'aborted') {
      setAnnouncement(t('message.liveStopped'));
    }
  }, [messages, t]);

  const typingPhase: TypingPhase =
    status?.state ?? (isStreaming ? 'connecting' : 'default');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-4 px-4 py-6">
          <div className="space-y-1 text-center">
            <p className="text-title-sm font-semibold text-ink">
              {t('empty.title')}
            </p>
            <p className="text-body-sm text-ink-muted">{t('empty.body')}</p>
          </div>
          <ul
            aria-label={t('empty.suggestionsLabel')}
            className="grid gap-2"
          >
            {SUGGESTION_KEYS.map((key) => {
              const suggestion = t(`empty.${key}`);
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={!canChat}
                    onClick={() => onSuggestion(suggestion)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-start text-body-sm text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={t('panel.messagesLabel')}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                error={isLast ? error : null}
                canRetry={isLast && canRetry}
                canContinue={isLast && canContinue}
                typingPhase={typingPhase}
                onRetry={onRetry}
                onContinue={onContinue}
              />
            );
          })}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={t('message.liveLabel')}
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
}
