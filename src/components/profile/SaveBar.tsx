'use client';

import { Button } from '@/components/ui/Button';

export interface SaveBarProps {
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  disabled?: boolean;
  hint?: string;
}

/**
 * Shared submit row. Success/failure feedback is owned by the global toast
 * layer, so no inline “Saved.” text is rendered here.
 */
export function SaveBar({
  saving,
  saveLabel,
  savingLabel,
  disabled = false,
  hint,
}: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={disabled || saving}>
        {saving ? savingLabel : saveLabel}
      </Button>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}
