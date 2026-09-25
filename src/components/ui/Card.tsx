import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}
