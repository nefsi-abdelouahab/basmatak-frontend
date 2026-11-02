'use client';

import { useTranslations } from 'next-intl';
import type { AiAgentStatusState } from '@/lib/api/aiAgent';

export type TypingPhase = 'connecting' | AiAgentStatusState | 'default';

export interface TypingIndicatorProps {
  phase: TypingPhase;
}

/**
 * Three-dot waiting state. The visible motion is decorative; the localized
 * label is exposed to assistive technology without streaming token text.
 */
export function TypingIndicator({ phase }: TypingIndicatorProps) {
  const t = useTranslations('aiAgent');
  const label = t(`message.typing.${phase}`);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="inline-flex items-center gap-1 py-1"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-ink-muted motion-safe:animate-bounce"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
