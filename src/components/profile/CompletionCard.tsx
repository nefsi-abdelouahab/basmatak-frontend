'use client';

import { CircleCheck } from 'lucide-react';

export interface CompletionField {
  key: string;
  label: string;
  href: string;
}

export interface CompletionCardProps {
  title: string;
  percent: number;
  complete: boolean;
  missingFields: string[];
  fields: readonly CompletionField[];
  missingLabel: string;
  completeLabel: string;
  testId?: string;
}

/**
 * Server-authoritative completion display. Percent comes straight from the
 * API; each missing key is mapped to a translated label + section anchor,
 * never rendered raw.
 */
export function CompletionCard({
  title,
  percent,
  complete,
  missingFields,
  fields,
  missingLabel,
  completeLabel,
  testId = 'profile-completion',
}: CompletionCardProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const missing = missingFields
    .map((key) => byKey.get(key))
    .filter((field): field is CompletionField => field !== undefined);

  return (
    <section
      data-testid={testId}
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
      aria-labelledby="profile-completion-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="profile-completion-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <span className="text-2xl font-semibold text-gold-strong">{clamped}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={title}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border-muted"
      >
        <div
          className={`h-full rounded-full transition-all ${
            complete ? 'bg-status-success' : 'bg-primary'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      {complete ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-status-success">
          <CircleCheck size={16} aria-hidden="true" />
          {completeLabel}
        </p>
      ) : missing.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm text-ink-muted">{missingLabel}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((field) => (
              <li key={field.key}>
                <a
                  href={field.href}
                  className="inline-flex rounded-full border border-border bg-surface-muted px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-gold-strong hover:text-gold-strong"
                >
                  {field.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
