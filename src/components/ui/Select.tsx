'use client';

import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  options: SelectOption[];
  error?: string;
}

export function Select({ id, label, options, error, className = '', ...rest }: SelectProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        className={`w-full rounded-md border bg-surface px-3 py-2 text-ink focus:outline-none ${error ? 'border-status-error' : 'border-border focus:border-gold-strong'} ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-sm text-status-error">{error}</p>
      ) : null}
    </div>
  );
}
