'use client';

import type { TextareaHTMLAttributes } from 'react';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  className = '',
  ...rest
}: TextAreaFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        className={`w-full rounded-md border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:outline-none ${
          error ? 'border-status-error' : 'border-border focus:border-gold-strong'
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-status-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
