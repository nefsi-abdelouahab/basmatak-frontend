import type { ReactNode } from 'react';

export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Empty({ title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border-muted bg-surface px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
