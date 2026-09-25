import type { ReactNode } from 'react';

// Status discipline: success = verification only, pending = pending only.
export type PillTone = 'success' | 'pending' | 'error' | 'neutral';

const TONES: Record<PillTone, string> = {
  success: 'bg-status-success/10 text-status-success',
  pending: 'bg-status-pending/10 text-status-pending',
  error: 'bg-status-error/10 text-status-error',
  neutral: 'bg-surface-muted text-ink-muted',
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

export function Pill({ tone = 'neutral', children }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
