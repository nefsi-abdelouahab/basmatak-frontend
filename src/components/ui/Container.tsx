import type { ReactNode } from 'react';

// Shared page container — the ONLY place page-level horizontal containment
// lives (max-width + edge gutters). Every screen renders inside exactly one
// Container per full-bleed section so edge spacing is identical everywhere:
//
// - `default`: max-w-7xl (1280px), centered, px-4 (16px) on mobile, md:px-6
//   (24px) at >=768px. Standard responsive-container pattern.
// - `narrow`: max-w-md (448px) for single-column content — auth forms,
//   centered cards, confirmation/system screens. Same responsive gutters.
//
// Full-bleed sections (hero backgrounds, colored bands) keep their
// edge-to-edge background on the <section> and put a Container inside for
// the text/card content, so content aligns with the rest of the page.
//
// Pass vertical rhythm (py-*, flex layouts) via className — Container only
// owns horizontal containment. Inner text-measure widths (max-w-xl ledes,
// truncation, dialog cards) are typography, not layout, and stay per-page.
export type ContainerVariant = 'default' | 'narrow';

const VARIANT_CLASS: Record<ContainerVariant, string> = {
  default: 'max-w-7xl',
  narrow: 'max-w-md',
};

export interface ContainerProps {
  variant?: ContainerVariant;
  className?: string;
  testId?: string;
  id?: string;
  children: ReactNode;
}

export function Container({
  variant = 'default',
  className = '',
  testId,
  id,
  children,
}: ContainerProps) {
  return (
    <div
      id={id}
      data-testid={testId}
      className={`mx-auto w-full ${VARIANT_CLASS[variant]} px-4 md:px-6 ${className}`}
    >
      {children}
    </div>
  );
}
