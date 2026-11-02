'use client';

export interface TimeRangeRowProps {
  idPrefix: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  removeLabel: string;
  onChange: (field: 'from' | 'to', value: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function TimeRangeRow({
  idPrefix,
  from,
  to,
  fromLabel,
  toLabel,
  removeLabel,
  onChange,
  onRemove,
  disabled = false,
}: TimeRangeRowProps) {
  const inputClass =
    'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:border-gold-strong focus:outline-none disabled:opacity-60';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
      <label htmlFor={`${idPrefix}-from`} className="sr-only">
        {fromLabel}
      </label>
      <input
        id={`${idPrefix}-from`}
        type="time"
        value={from}
        aria-label={fromLabel}
        disabled={disabled}
        onChange={(event) => onChange('from', event.target.value)}
        className={inputClass}
      />
      <label htmlFor={`${idPrefix}-to`} className="sr-only">
        {toLabel}
      </label>
      <input
        id={`${idPrefix}-to`}
        type="time"
        value={to}
        aria-label={toLabel}
        disabled={disabled}
        onChange={(event) => onChange('to', event.target.value)}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="px-1 text-sm font-medium text-status-error hover:underline disabled:opacity-50"
      >
        {removeLabel}
      </button>
    </div>
  );
}
