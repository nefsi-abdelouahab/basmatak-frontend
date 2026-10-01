'use client';

import type { MouseEvent, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

// Compact navbar icon control with a custom hover/focus label. The visible
// text lives in an aria-hidden tooltip (position + opacity transition, no
// layout shift); the accessible name comes from aria-label so keyboard and
// screen-reader users get the same information. No pill shapes, gradients,
// or shadows — plain rounded-md box consistent with the navbar inputs.
//
// RTL centering: the tooltip anchors at `start-1/2` (logical), but X
// translate is physical, so RTL needs the mirrored `rtl:translate-x-1/2`.
// Without it the tooltip sits a full tooltip-width off-center and spills past
// the viewport edge on RTL (page-level horizontal overflow at ~lg widths).
const TOOLTIP_CLASS =
  'pointer-events-none absolute start-1/2 top-full z-50 mt-1.5 -translate-x-1/2 translate-y-0.5 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs font-medium text-surface opacity-0 transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none rtl:translate-x-1/2';

export function NavIconLink({
  href,
  locale,
  label,
  icon,
  tone = 'muted',
  className = '',
  scroll,
  onClick,
}: {
  href: string;
  locale?: Locale;
  label: string;
  icon: ReactNode;
  tone?: 'muted' | 'primary';
  className?: string;
  scroll?: boolean;
  onClick?: (event: MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      locale={locale}
      scroll={scroll}
      onClick={onClick}
      aria-label={label}
      className={`group relative h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        tone === 'primary'
          ? 'text-primary hover:bg-surface-muted'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
      } ${className}`}
    >
      {icon}
      <span aria-hidden="true" className={TOOLTIP_CLASS}>
        {label}
      </span>
    </Link>
  );
}
