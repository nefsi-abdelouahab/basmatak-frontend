'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

// Shared auth-route primitives (F1-owned). Built only from F0 ui primitives
// and theme tokens — no hardcoded values, logical layout only.
export function AuthShell({
  testId,
  title,
  subtitle,
  children,
}: {
  testId: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <div data-testid={testId}>
        <h1 className="mb-1 text-2xl font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mb-4 text-ink-muted">{subtitle}</p> : null}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </Card>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      data-testid="auth-error"
      className="rounded-md border border-status-error bg-surface px-3 py-2 text-sm text-status-error"
    >
      {message}
    </p>
  );
}

export function AuthSuccess({ title, description }: { title: string; description: string }) {
  return (
    <div data-testid="auth-success" className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-ink-muted">{description}</p>
    </div>
  );
}
