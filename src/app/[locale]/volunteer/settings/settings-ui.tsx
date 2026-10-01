'use client';

import type { ReactNode } from 'react';

// Settings-local presentational shell. Business logic lives in the section
// components; this only maps the Volunteer Settings design (rounded-xl card,
// title + hint header) onto the shared token classes.
export function SettingsCard({
  id,
  title,
  hint,
  badge,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-1 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title-lg text-ink">{title}</h2>
          {badge}
        </div>
        {hint ? <p className="text-body-sm text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
