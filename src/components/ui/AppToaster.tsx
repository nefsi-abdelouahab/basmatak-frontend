'use client';

import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { Toaster } from 'sonner';
import { configureNotify } from '@/lib/notify';

// One global toast surface for the whole locale layout. It sits above modals
// (z-[60]) and the AI launcher, uses only theme tokens, follows the locale
// direction, and stays clear of the sticky header on every breakpoint.
const HEADER_OFFSET =
  'calc(var(--header-height) + 0.5rem + env(safe-area-inset-top))';

export function AppToaster() {
  const locale = useLocale();
  const t = useTranslations('toast');
  const announcerRef = useRef<HTMLDivElement>(null);

  // Sonner's own container is aria-live="polite". Errors also need assertive
  // announcement, so notify pushes the message into this hidden region.
  const announceError = useCallback((message: string) => {
    const node = announcerRef.current;
    if (!node) return;
    node.textContent = '';
    window.setTimeout(() => {
      node.textContent = message;
    }, 30);
  }, []);

  useEffect(
    () =>
      configureNotify({
        t: (key, values) => t(key, values),
        announceError,
      }),
    [t, announceError],
  );

  return (
    <>
      <Toaster
        position="top-center"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        theme="light"
        richColors={false}
        visibleToasts={3}
        expand={false}
        closeButton={false}
        offset={{ top: HEADER_OFFSET }}
        mobileOffset={{ left: '0.75rem', right: '0.75rem', top: HEADER_OFFSET }}
        style={{ '--width': 'min(420px, calc(100vw - 1.5rem))' } as CSSProperties}
        icons={{
          success: <CircleCheck className="size-4 text-status-success" aria-hidden />,
          error: <CircleAlert className="size-4 text-status-error-warm" aria-hidden />,
          info: <Info className="size-4 text-ink-muted" aria-hidden />,
        }}
        toastOptions={{
          closeButtonAriaLabel: t('dismiss'),
          classNames: {
            toast:
              `!bg-surface !text-ink !border !border-border !shadow-sm !rounded-lg !text-sm ${
                locale === 'ar' ? '!font-arabic' : '!font-sans'
              }`,
            title: '!text-ink !font-medium',
            description: '!text-ink-muted',
            success: '!border-status-success/40',
            error: '!border-status-error-warm/50',
            info: '!border-border',
            closeButton:
              '!bg-surface !text-ink-muted !border-border hover:!bg-surface-muted hover:!text-ink',
          },
        }}
      />
      <div
        ref={announcerRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="toast-announcer"
        className="sr-only"
      />
    </>
  );
}
