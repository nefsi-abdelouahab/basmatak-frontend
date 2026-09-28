'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Generic accessible modal shell. Overlay click, Escape, and the X button all
// close; background scroll locks while open; the panel scrolls internally.
// Styling mirrors the admin confirm dialogs (token colors, rounded-lg).
export function Modal({
  testId,
  label,
  onClose,
  children,
}: {
  testId: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="animate-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
    >
      <div className="animate-modal-panel relative my-8 w-full max-w-2xl rounded-lg border border-border bg-surface shadow-modal">
        <button
          type="button"
          data-testid={`${testId}-close`}
          onClick={onClose}
          aria-label={label}
          autoFocus
          className="absolute end-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X aria-hidden="true" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
