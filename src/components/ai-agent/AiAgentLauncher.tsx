'use client';

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { AI_AGENT_ICON_SRC } from '@/hooks/useAiChat';
import {
  AI_AGENT_LAUNCHER_BOTTOM_MARGIN,
  AI_AGENT_LAUNCHER_DRAG_THRESHOLD,
  AI_AGENT_LAUNCHER_MARGIN,
  AI_AGENT_LAUNCHER_STORAGE_KEY,
  AI_AGENT_PANEL_ID,
  clampLauncherInset,
  clampLauncherYAboveNav,
  defaultLauncherY,
  launcherBottomMargin,
  launcherInsetFromRect,
  launcherSizeFor,
  nearestLauncherEdge,
  parseLauncherPosition,
  serializeLauncherPosition,
  type AiAgentAvailability,
  type LauncherEdge,
  type LauncherPosition,
} from './aiAgentUi';

export interface AiAgentLauncherProps {
  open: boolean;
  availability: AiAgentAvailability;
  onToggle: () => void;
  onEdgeChange?: (edge: LauncherEdge) => void;
}

interface DragStart {
  pointerId: number;
  startX: number;
  startY: number;
  startInset: number;
  startTop: number;
  isRtl: boolean;
  size: number;
  width: number;
  height: number;
}

interface DragVisual {
  inset: number;
  top: number;
}

const DOT_CLASSES: Record<AiAgentAvailability, string> = {
  online: 'bg-status-success',
  waking: 'bg-status-pending',
  limited: 'bg-status-pending',
  offline: 'bg-status-error',
};

function persistPosition(position: LauncherPosition): void {
  try {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      serializeLauncherPosition(position),
    );
  } catch {
    // Storage can be unavailable in private/security-restricted contexts.
  }
}

function readStoredPosition(): LauncherPosition | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(AI_AGENT_LAUNCHER_STORAGE_KEY);
  } catch {
    return null;
  }

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const position = parseLauncherPosition(raw, viewport);
  if (raw !== null && position === null) {
    try {
      window.localStorage.removeItem(AI_AGENT_LAUNCHER_STORAGE_KEY);
    } catch {
      // Best-effort cleanup only.
    }
  }
  return position;
}

export const AiAgentLauncher = forwardRef<
  HTMLButtonElement,
  AiAgentLauncherProps
>(function AiAgentLauncher(
  { open, availability, onToggle, onEdgeChange },
  forwardedRef,
) {
  const t = useTranslations('aiAgent');
  const [position, setPosition] = useState<LauncherPosition | null>(null);
  const [drag, setDrag] = useState<DragVisual | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const dragVisualRef = useRef<DragVisual | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const lastReportedEdgeRef = useRef<LauncherEdge | null>(null);

  useEffect(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const stored = readStoredPosition();
    setPosition(
      stored ?? {
        edge: 'end',
        y: defaultLauncherY(
          viewport.height,
          launcherSizeFor(viewport.width),
          viewport.width,
        ),
      },
    );
  }, []);

  useEffect(() => {
    const handleResize = (): void => {
      setPosition((current) => {
        if (current === null) return current;
        const y = clampLauncherYAboveNav(
          current.y,
          window.innerHeight,
          launcherSizeFor(window.innerWidth),
          window.innerWidth,
        );
        return y === current.y ? current : { ...current, y };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (position === null) return;
    if (lastReportedEdgeRef.current === position.edge) return;
    lastReportedEdgeRef.current = position.edge;
    onEdgeChange?.(position.edge);
  }, [onEdgeChange, position]);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
    const size = rect.width > 0 ? rect.width : launcherSizeFor(width);

    dragStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startInset: launcherInsetFromRect(rect, width, isRtl),
      startTop:
        rect.height > 0
          ? rect.top
          : (position?.y ?? defaultLauncherY(height, size, width)),
      isRtl,
      size,
      width,
      height,
    };
    draggingRef.current = false;
    dragVisualRef.current = null;
    setDrag(null);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Older browsers/synthetic events may not support pointer capture.
    }
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    const start = dragStartRef.current;
    if (start === null || start.pointerId !== event.pointerId) return;

    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (
      !draggingRef.current &&
      Math.hypot(dx, dy) < AI_AGENT_LAUNCHER_DRAG_THRESHOLD
    ) {
      return;
    }

    draggingRef.current = true;
    const inlineDelta = start.isRtl ? -dx : dx;
    const next: DragVisual = {
      inset: clampLauncherInset(
        start.startInset + inlineDelta,
        start.width,
        start.size,
      ),
      top: clampLauncherYAboveNav(
        start.startTop + dy,
        start.height,
        start.size,
        start.width,
      ),
    };
    dragVisualRef.current = next;
    setDrag(next);
    if (event.cancelable) event.preventDefault();
  }

  function handlePointerUp(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    const start = dragStartRef.current;
    if (start === null || start.pointerId !== event.pointerId) return;

    dragStartRef.current = null;
    const wasDragging = draggingRef.current;
    draggingRef.current = false;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures; capture is already gone on most paths.
    }

    if (!wasDragging) {
      dragVisualRef.current = null;
      setDrag(null);
      return;
    }

    // A pointerup after a drag must not also fire the launcher's click.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const visual = dragVisualRef.current;
    dragVisualRef.current = null;
    if (visual === null) {
      setDrag(null);
      return;
    }

    const center = start.isRtl
      ? start.width - visual.inset - start.size / 2
      : visual.inset + start.size / 2;
    const next: LauncherPosition = {
      edge: nearestLauncherEdge(center, start.width, start.isRtl),
      y: visual.top,
    };
    setDrag(null);
    setPosition(next);
    persistPosition(next);
  }

  function handlePointerCancel(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    const start = dragStartRef.current;
    if (start === null || start.pointerId !== event.pointerId) return;
    dragStartRef.current = null;
    draggingRef.current = false;
    dragVisualRef.current = null;
    setDrag(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures on cancellation.
    }
  }

  function handleClick(): void {
    if (suppressClickRef.current) return;
    onToggle();
  }

  let style: CSSProperties;
  if (drag !== null) {
    style = { top: drag.top, insetInlineStart: drag.inset };
  } else if (position !== null) {
    style =
      position.edge === 'start'
        ? { top: position.y, insetInlineStart: AI_AGENT_LAUNCHER_MARGIN }
        : { top: position.y, insetInlineEnd: AI_AGENT_LAUNCHER_MARGIN };
  } else {
    style = {
      bottom:
        typeof window === 'undefined'
          ? AI_AGENT_LAUNCHER_BOTTOM_MARGIN
          : launcherBottomMargin(window.innerWidth),
      insetInlineEnd: AI_AGENT_LAUNCHER_MARGIN,
    };
  }

  // Keep the launcher mounted so its dragged position survives while the
  // panel is open, but take it out of sight and out of pointer reach.
  if (open) {
    style = {
      ...style,
      visibility: 'hidden',
      pointerEvents: 'none',
    };
  }

  return (
    <button
      ref={forwardedRef}
      type="button"
      data-testid="ai-agent-launcher"
      aria-label={open ? t('launcher.close') : t('launcher.open')}
      title={open ? t('launcher.close') : t('launcher.open')}
      aria-expanded={open}
      aria-controls={AI_AGENT_PANEL_ID}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={style}
      className="fixed z-[60] inline-flex h-[52px] w-[52px] touch-none items-center justify-center rounded-full border-2 border-gold bg-surface shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-safe:transition-transform motion-safe:hover:scale-105 sm:h-14 sm:w-14"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AI_AGENT_ICON_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-9 w-9 select-none object-contain sm:h-10 sm:w-10"
      />
      <span
        aria-hidden="true"
        className={`absolute end-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${
          availability === 'waking' ? 'motion-safe:animate-pulse' : ''
        } ${DOT_CLASSES[availability]}`}
      />
    </button>
  );
});
