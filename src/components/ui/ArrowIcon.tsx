import { ArrowRight } from 'lucide-react';

// Unified directional arrow for links and CTA buttons (landing, public
// screens, reusable anywhere): ArrowRight in LTR, mirrored in RTL. On parent
// hover it slides a few pixels in the reading direction (150-200ms ease) —
// the parent must carry `group`. Color and size inherit from context via
// `currentColor` and the `size` prop; only the icon choice and the hover
// motion live here, never the color system. Motion is disabled under
// `prefers-reduced-motion`.
export function ArrowIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <ArrowRight
      aria-hidden="true"
      size={size}
      className={`shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-1 ${className}`}
    />
  );
}
