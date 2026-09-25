'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: ReactNode;
}

export function Checkbox({ id, label, className = '', ...rest }: CheckboxProps) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" {...rest} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}
