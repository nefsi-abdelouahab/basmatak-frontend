import type { ReactNode } from 'react';
import { FingerprintPattern } from './FingerprintPattern';

export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Adds the decorative fingerprint watermark. Reserved for the dedicated
   * no-applications / no-tasks / no-experiences empty states; never place it
   * behind tables, forms, long text or dashboard cards.
   */
  pattern?: boolean;
}

export function Empty({ title, description, action, pattern = false }: EmptyProps) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-lg border border-border-muted bg-surface px-6 py-10 text-center">
      {pattern ? <FingerprintPattern variant="corner" /> : null}
      <h3 className="relative text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="relative text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="relative">{action}</div> : null}
    </div>
  );
}
