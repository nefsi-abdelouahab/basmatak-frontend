'use client';

import { useTranslations } from 'next-intl';
import type { AiAgentStatusState } from '@/lib/api/aiAgent';

export type TypingPhase = 'connecting' | AiAgentStatusState | 'default';

export interface TypingIndicatorProps {
  phase: TypingPhase;
}

/**
 * Visual typing feedback. The visible label is the only text exposed here;
 * token-level output is never announced by this component.
 */
export function TypingIndicator({ phase }: TypingIndicatorProps) {
  const t = useTranslations('aiAgent');
  const label = t(`message.typing.${phase}`);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="inline-flex items-center gap-2 text-body-sm text-ink-muted"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-ink-muted/60 motion-safe:animate-pulse"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
