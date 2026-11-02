'use client';

import type { ReactNode } from 'react';

export interface SectionCardProps {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}

/**
 * Consistent profile section shell. Every editable section carries an `id`
 * so completion checklists can deep-link/scroll straight to it.
 */
export function SectionCard({
  id,
  title,
  description,
  action,
  children,
  testId,
  className = '',
}: SectionCardProps) {
  return (
    <section
      id={id}
      data-testid={testId}
      className={`scroll-mt-24 rounded-lg border border-border bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
