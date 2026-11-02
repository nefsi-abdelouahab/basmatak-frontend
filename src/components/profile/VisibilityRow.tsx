'use client';

export interface VisibilityRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

export function VisibilityRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  testId,
}: VisibilityRowProps) {
  return (
    <li
      data-testid={testId ? `${testId}-row` : undefined}
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
    >
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
        </p>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        data-testid={testId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-strong disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-surface shadow transition-transform ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'
          }`}
        />
      </button>
    </li>
  );
}
