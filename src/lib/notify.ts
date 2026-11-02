import { toast } from 'sonner';
import { userMessageKeyOf, type ToastMessageKey } from '@/lib/errors/userMessage';

// The toast layer is deliberately framework-light: React Query callbacks and
// plain event handlers call notify, while AppToaster registers the active
// next-intl translator and the assertive error live region.

export type NotifyValues = Record<string, string | number>;
export type NotifySuccessKey = `success.${string}`;
export type NotifyErrorKey = `error.${string}`;

type Translator = (key: string, values?: NotifyValues) => string;
type ErrorAnnouncer = (message: string) => void;

export const SUCCESS_DURATION_MS = 3_000;
export const ERROR_DURATION_MS = 5_000;
export const DEDUPE_WINDOW_MS = 2_000;

let translator: Translator | null = null;
let announceError: ErrorAnnouncer | null = null;
const lastShownAt = new Map<string, number>();

export function configureNotify(options: {
  t: Translator;
  announceError?: ErrorAnnouncer;
}): () => void {
  translator = options.t;
  announceError = options.announceError ?? null;
  return () => {
    if (translator === options.t) {
      translator = null;
      announceError = null;
    }
  };
}

export function resetNotifyForTests(): void {
  translator = null;
  announceError = null;
  lastShownAt.clear();
}

function withinDedupeWindow(key: string): boolean {
  const now = Date.now();
  const last = lastShownAt.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  lastShownAt.set(key, now);
  // Opportunistic cleanup: the map only needs recent keys.
  if (lastShownAt.size > 50) {
    for (const [entryKey, shownAt] of lastShownAt) {
      if (now - shownAt >= DEDUPE_WINDOW_MS) lastShownAt.delete(entryKey);
    }
  }
  return false;
}

function messageFor(key: ToastMessageKey, values?: NotifyValues): string | null {
  if (!translator) return null;
  return translator(key, values);
}

export function success(key: NotifySuccessKey, values?: NotifyValues): void {
  const message = messageFor(key, values);
  if (message === null) return;
  if (withinDedupeWindow(key)) return;
  toast.success(message, {
    id: key,
    duration: SUCCESS_DURATION_MS,
    closeButton: false,
    testId: 'app-toast',
  });
}

export function error(key: NotifyErrorKey, values?: NotifyValues): void {
  const message = messageFor(key, values);
  if (message === null) return;
  if (withinDedupeWindow(key)) return;
  toast.error(message, {
    id: key,
    duration: ERROR_DURATION_MS,
    closeButton: true,
    testId: 'app-toast',
  });
  announceError?.(message);
}

export function fromError(err: unknown, fallbackKey?: NotifyErrorKey): void {
  const mapped = userMessageKeyOf(err);
  const key = mapped === 'error.generic' && fallbackKey ? fallbackKey : mapped;
  error(key);
}

export const notify = { success, error, fromError } as const;
