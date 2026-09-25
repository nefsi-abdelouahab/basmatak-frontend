import type { ReactNode } from 'react';

export const primaryActionClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover';

export const secondaryActionClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted';

export interface SystemScreenProps {
  testId: string;
  code?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function SystemScreen({ testId, code, title, description, actions }: SystemScreenProps) {
  return (
    <section
      data-testid={testId}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-12 text-center"
    >
      {code ? <p className="text-sm font-semibold tracking-wide text-ink-muted">{code}</p> : null}
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="text-ink-muted">{description}</p>
      {actions ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      ) : null}
    </section>
  );
}
