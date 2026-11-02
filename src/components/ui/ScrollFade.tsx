'use client';

import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export type ScrollFadeTone = 'surface' | 'background';

export type ScrollFadeProps = {
  children: ReactNode;
  /** Semantics for the positioning wrapper (the viewport stays a div). */
  as?: 'div' | 'section' | 'aside';
  /** Classes for the positioning wrapper. */
  className?: string;
  /** Classes for the actual scroll viewport. */
  viewportClassName?: string;
  /** Theme token the clipped-edge fade blends into. */
  tone?: ScrollFadeTone;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

type Edges = {
  top: boolean;
  bottom: boolean;
  scrollable: boolean;
};

const NO_EDGES: Edges = { top: false, bottom: false, scrollable: false };

// One scroll viewport with token-colored fade hints at clipped vertical edges.
// The scrollbar itself is hidden globally; these hints only appear while the
// content actually continues past the top or bottom edge. The wrapper never
// touches overflow, so wheel/touch/keyboard scrolling and scrollIntoView keep
// working exactly as before.
export const ScrollFade = forwardRef<HTMLDivElement, ScrollFadeProps>(
  function ScrollFade(
    {
      children,
      as = 'div',
      className = '',
      viewportClassName = '',
      tone = 'surface',
      onScroll,
      tabIndex,
      ...viewportProps
    },
    forwardedRef,
  ) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const edgesRef = useRef<Edges>(NO_EDGES);
    const [edges, setEdges] = useState<Edges>(NO_EDGES);

    const setViewportRef = useCallback(
      (node: HTMLDivElement | null) => {
        viewportRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const measure = useCallback(() => {
      const node = viewportRef.current;
      if (!node) return;

      const verticalMax = node.scrollHeight - node.clientHeight;
      const horizontalMax = node.scrollWidth - node.clientWidth;
      const next: Edges = {
        top: node.scrollTop > 1,
        bottom: verticalMax > 1 && node.scrollTop < verticalMax - 1,
        scrollable: verticalMax > 1 || horizontalMax > 1,
      };

      const previous = edgesRef.current;
      if (
        previous.top === next.top &&
        previous.bottom === next.bottom &&
        previous.scrollable === next.scrollable
      ) {
        return;
      }
      edgesRef.current = next;
      setEdges(next);
    }, []);

    useEffect(() => {
      const node = viewportRef.current;
      if (!node) return;

      measure();
      const frame =
        typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame(measure)
          : 0;

      node.addEventListener('scroll', measure, { passive: true });
      const resizeObserver =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(measure);
      resizeObserver?.observe(node);
      const mutationObserver =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver(measure);
      mutationObserver?.observe(node, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      window.addEventListener('resize', measure);

      return () => {
        if (frame !== 0) window.cancelAnimationFrame(frame);
        node.removeEventListener('scroll', measure);
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        window.removeEventListener('resize', measure);
      };
    }, [measure]);

    const toneClass = tone === 'background' ? 'from-background' : 'from-surface';
    const resolvedTabIndex =
      tabIndex ?? (edges.scrollable ? 0 : undefined);
    // Keep caller positioning (fixed/absolute/sticky) intact; only add the
    // containing block when the wrapper has no position utility of its own.
    const hasPosition = className
      .split(/\s+/)
      .some((token) =>
        /^(?:[a-z-]+:)?(?:static|fixed|absolute|relative|sticky)$/.test(token),
      );

    return createElement(
      as,
      { className: `${hasPosition ? '' : 'relative '}${className}`.trim() },
      <div
        ref={setViewportRef}
        {...viewportProps}
        tabIndex={resolvedTabIndex}
        onScroll={(event) => {
          measure();
          onScroll?.(event);
        }}
        className={`h-full w-full ${viewportClassName}`}
      >
        {children}
      </div>,
      <div
        key="fade-top"
        aria-hidden="true"
        data-scroll-fade="top"
        data-visible={edges.top ? 'true' : 'false'}
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b ${toneClass} to-transparent transition-opacity duration-150 ${
          edges.top ? 'opacity-100' : 'opacity-0'
        }`}
      />,
      <div
        key="fade-bottom"
        aria-hidden="true"
        data-scroll-fade="bottom"
        data-visible={edges.bottom ? 'true' : 'false'}
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t ${toneClass} to-transparent transition-opacity duration-150 ${
          edges.bottom ? 'opacity-100' : 'opacity-0'
        }`}
      />,
    );
  },
);
