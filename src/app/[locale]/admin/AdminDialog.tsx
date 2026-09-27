'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// F15-owned modal shell shared by the four admin routes (confirm dialogs
// for status changes, assignment, approve/reject, and notices). Renders as
// a fixed overlay with role=dialog; the caller owns the action buttons and
// posts only on confirm.
export function AdminDialog({
  testId,
  title,
  onClose,
  children,
}: {
  testId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('adminManage');
  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-md">
        <Card title={title}>
          {children}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t('shared.cancel')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
