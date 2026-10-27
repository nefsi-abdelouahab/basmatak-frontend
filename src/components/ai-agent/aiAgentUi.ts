import type {
  AiAgentError,
  AiAgentStatusEvent,
  AiAgentStatusResponse,
} from '@/lib/api/aiAgent';
import type { AiChatConnection, AiChatMessage } from '@/hooks/useAiChat';

/**
 * Pure UI helpers for the floating assistant.
 *
 * Keeping sizing, availability, error-copy, retry-duration, and source-path
 * decisions here makes the components declarative and lets the risky logic be
 * unit tested without a browser.
 */

export const AI_AGENT_PANEL_ID = 'ai-agent-panel';

export const AI_AGENT_STATUS_TIMEOUT_MS = 10_000;

export const AI_AGENT_LAUNCHER_SIZE = 56;
export const AI_AGENT_LAUNCHER_SIZE_SMALL = 52;
export const AI_AGENT_LAUNCHER_MARGIN = 16;
export const AI_AGENT_LAUNCHER_BOTTOM_MARGIN = 24;
export const AI_AGENT_LAUNCHER_STORAGE_KEY =
  'basmatak.aiAgent.launcherPosition';
export const AI_AGENT_LAUNCHER_DRAG_THRESHOLD = 6;

export type AiAgentAvailability = 'online' | 'waking' | 'limited' | 'offline';
export type AiAgentStatusPhase = 'loading' | 'ready' | 'waking' | 'offline';
export type LauncherEdge = 'start' | 'end';

export interface LauncherPosition {
  edge: LauncherEdge;
  y: number;
}

export interface LauncherViewport {
  width: number;
  height: number;
}

export interface RetryAfterDescriptor {
  unit: 'seconds' | 'minutes' | 'hours';
  count: number;
}

export interface AiChatView {
  messages: AiChatMessage[];
  connection: AiChatConnection;
  isStreaming: boolean;
  status: AiAgentStatusEvent | null;
  error: AiAgentError | null;
  canSend: boolean;
  canRetry: boolean;
  canContinue: boolean;
  limits: { messageChars: number };
  send(text: string): Promise<boolean>;
  abort(): void;
  retry(): Promise<boolean>;
  continueChat(): Promise<boolean>;
  newChat(): void;
}

export function availabilityFor(
  status: AiAgentStatusResponse | null,
  phase: AiAgentStatusPhase,
): AiAgentAvailability {
  if (phase === 'waking') return 'waking';
  if (phase === 'offline') return 'offline';
  if (status === null) return phase === 'loading' ? 'waking' : 'offline';
  if (!status.enabled) return 'offline';
  return status.mode === 'normal' || status.mode === 'conservative'
    ? 'online'
    : 'limited';
}

const ERROR_MESSAGE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  AI_AGENT_DISABLED: 'disabled',
  AI_AGENT_INVALID_INPUT: 'invalidInput',
  VALIDATION_ERROR: 'invalidInput',
  RATE_LIMITED: 'rateLimited',
  AI_AGENT_BUSY: 'busy',
  AI_AGENT_QUOTA_EXHAUSTED: 'quota',
  AI_AGENT_PROVIDER_UNAVAILABLE: 'providerUnavailable',
  AI_AGENT_TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network',
  AI_AGENT_STREAM_INTERRUPTED: 'interrupted',
  AI_AGENT_INVALID_RESPONSE: 'invalidResponse',
  AI_AGENT_INTERNAL_ERROR: 'internal',
  INTERNAL_SERVER_ERROR: 'internal',
});

export function errorMessageKey(code: string | undefined): string {
  if (code === undefined) return 'generic';
  return ERROR_MESSAGE_KEYS[code] ?? 'generic';
}

export function isQuotaExhaustedError(error: AiAgentError | null): boolean {
  return error?.code === 'AI_AGENT_QUOTA_EXHAUSTED';
}

export function retryAfterDescriptor(
  seconds: number | undefined,
): RetryAfterDescriptor | null {
  if (
    seconds === undefined ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  const roundedSeconds = Math.max(1, Math.ceil(seconds));
  if (roundedSeconds < 60) {
    return { unit: 'seconds', count: roundedSeconds };
  }

  const roundedMinutes = Math.ceil(roundedSeconds / 60);
  if (roundedMinutes < 60) {
    return { unit: 'minutes', count: roundedMinutes };
  }

  return { unit: 'hours', count: Math.ceil(roundedMinutes / 60) };
}

const SAFE_SOURCE_BASE = 'https://basmatak.invalid';

function isSafeSourcePathname(pathname: string): boolean {
  if (pathname === '/opportunities') return true;
  if (pathname.startsWith('/opportunities/')) return true;
  if (pathname === '/talents') return true;
  if (pathname.startsWith('/orgs/') && pathname.length > '/orgs/'.length) {
    return true;
  }
  // Known backend gap: answer-policy can emit the listing path `/orgs` while
  // the frontend has no organization index route. Callers render it as text.
  return false;
}

/**
 * Only same-origin internal public routes may become links. This blocks
 * `javascript:`/`data:` URLs, protocol-relative URLs, backslash tricks, and
 * the known slug-less `/orgs` path.
 */
export function safeSourceHref(path: string | undefined): string | null {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (
    trimmed === '' ||
    trimmed.length > 2048 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, SAFE_SOURCE_BASE);
  } catch {
    return null;
  }

  if (parsed.origin !== SAFE_SOURCE_BASE) return null;
  if (!isSafeSourcePathname(parsed.pathname)) return null;
  return parsed.pathname;
}

export class AiAgentStatusTimeoutError extends Error {
  constructor() {
    super('AI_AGENT_STATUS_TIMEOUT');
    this.name = 'AiAgentStatusTimeoutError';
    Object.setPrototypeOf(this, AiAgentStatusTimeoutError.prototype);
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = AI_AGENT_STATUS_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return operation;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AiAgentStatusTimeoutError()),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function launcherSizeFor(viewportWidth: number): number {
  return viewportWidth < 640
    ? AI_AGENT_LAUNCHER_SIZE_SMALL
    : AI_AGENT_LAUNCHER_SIZE;
}

export function clampLauncherY(
  top: number,
  viewportHeight: number,
  size: number,
  margin: number = AI_AGENT_LAUNCHER_MARGIN,
): number {
  const maxTop = Math.max(0, viewportHeight - size - margin);
  const minTop = Math.min(margin, maxTop);
  if (!Number.isFinite(top)) return maxTop;
  return Math.min(Math.max(top, minTop), maxTop);
}

export function defaultLauncherY(
  viewportHeight: number,
  size: number,
): number {
  return clampLauncherY(
    viewportHeight - size - AI_AGENT_LAUNCHER_BOTTOM_MARGIN,
    viewportHeight,
    size,
  );
}

export function clampLauncherInset(
  inset: number,
  viewportWidth: number,
  size: number,
  margin: number = AI_AGENT_LAUNCHER_MARGIN,
): number {
  const maxInset = Math.max(0, viewportWidth - size - margin);
  const minInset = Math.min(margin, maxInset);
  if (!Number.isFinite(inset)) return maxInset;
  return Math.min(Math.max(inset, minInset), maxInset);
}

export function nearestLauncherEdge(
  centerX: number,
  viewportWidth: number,
  isRtl: boolean,
): LauncherEdge {
  const physicalLeft = centerX < viewportWidth / 2;
  if (isRtl) return physicalLeft ? 'end' : 'start';
  return physicalLeft ? 'start' : 'end';
}

export function launcherInsetFromRect(
  rect: { left: number; right: number },
  viewportWidth: number,
  isRtl: boolean,
): number {
  return isRtl ? viewportWidth - rect.right : rect.left;
}

export function serializeLauncherPosition(position: LauncherPosition): string {
  return JSON.stringify({
    version: 1,
    edge: position.edge,
    y: Math.round(position.y),
  });
}

export function parseLauncherPosition(
  raw: string | null,
  viewport: LauncherViewport,
): LauncherPosition | null {
  if (raw === null || raw.trim() === '') return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    (record.edge !== 'start' && record.edge !== 'end') ||
    typeof record.y !== 'number' ||
    !Number.isFinite(record.y)
  ) {
    return null;
  }

  const size = launcherSizeFor(viewport.width);
  // A position that no longer overlaps the viewport is stale, not merely
  // close to the edge: reset to the default corner instead of reviving it.
  if (record.y < -size || record.y > viewport.height) return null;

  return {
    edge: record.edge,
    y: clampLauncherY(record.y, viewport.height, size),
  };
}
