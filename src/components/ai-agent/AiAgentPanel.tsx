'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AI_AGENT_ICON_SRC } from '@/hooks/useAiChat';
import type { AiAgentStatusResponse } from '@/lib/api/aiAgent';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import {
  AI_AGENT_PANEL_ID,
  retryAfterDescriptor,
  type AiAgentAvailability,
  type AiChatView,
  type LauncherEdge,
} from './aiAgentUi';

export interface AiAgentPanelProps {
  chat: AiChatView;
  availability: AiAgentAvailability;
  serviceStatus: AiAgentStatusResponse | null;
  statusPending: boolean;
  quotaBlocked: boolean;
  quotaRetryAfter: number | undefined;
  edge: LauncherEdge;
  onClose: () => void;
  onRetryStatus: () => void;
}

const DOT_CLASSES: Record<AiAgentAvailability, string> = {
  online: 'bg-status-success',
  waking: 'bg-status-pending',
  limited: 'bg-status-pending',
  offline: 'bg-status-error',
};

const BANNER_TONES = {
  neutral: 'border-border bg-surface-muted text-ink',
  pending: 'border-status-pending/30 bg-status-pending/5 text-ink',
  error: 'border-status-error/30 bg-status-error/5 text-ink',
} as const;

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 639px)').matches;
}

interface BannerProps {
  tone: keyof typeof BANNER_TONES;
  title: string;
  body: string;
  extra?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retryPending?: boolean;
}

function PanelBanner({
  tone,
  title,
  body,
  extra,
  onRetry,
  retryLabel,
  retryPending = false,
}: BannerProps) {
  return (
    <div
      role="status"
      className={`border-b px-4 py-2.5 ${BANNER_TONES[tone]}`}
    >
      <p className="text-label-md font-medium">{title}</p>
      <p className="mt-0.5 text-body-sm text-ink-muted">{body}</p>
      {extra}
      {onRetry !== undefined && retryLabel !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryPending}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={retryPending ? 'motion-safe:animate-spin' : ''}
          />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AiAgentPanel({
  chat,
  availability,
  serviceStatus,
  statusPending,
  quotaBlocked,
  quotaRetryAfter,
  edge,
  onClose,
  onRetryStatus,
}: AiAgentPanelProps) {
  const t = useTranslations('aiAgent');
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const focusedOnceRef = useRef(false);
  const [isMobile, setIsMobile] = useState(isMobileViewport);

  const modeExhausted = serviceStatus?.mode === 'exhausted';
  const inputDisabled =
    availability === 'offline' ||
    availability === 'waking' ||
    quotaBlocked ||
    modeExhausted;
  const canChat = chat.canSend && !inputDisabled;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 639px)');
    const update = (): void => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      const previous = restoreFocusRef.current;
      if (previous !== null && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (focusedOnceRef.current) return;
    focusedOnceRef.current = true;
    if (isMobile || inputDisabled) {
      closeRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, [inputDisabled, isMobile]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!isMobile || event.key !== 'Tab') return;

      const root = panelRef.current;
      if (root === null) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true',
      );

      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !root.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !root.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, onClose]);

  useEffect(() => {
    if (!isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile]);

  const quotaReset = retryAfterDescriptor(quotaRetryAfter);

  let banner: ReactNode = null;
  if (availability === 'offline') {
    banner = (
      <PanelBanner
        tone="error"
        title={t('banners.offline.title')}
        body={t('banners.offline.body')}
        onRetry={onRetryStatus}
        retryLabel={t('banners.retry')}
        retryPending={statusPending}
      />
    );
  } else if (availability === 'waking') {
    banner = (
      <PanelBanner
        tone="pending"
        title={t('banners.waking.title')}
        body={t('banners.waking.body')}
        onRetry={onRetryStatus}
        retryLabel={t('banners.retry')}
        retryPending={statusPending}
      />
    );
  } else if (quotaBlocked || modeExhausted) {
    const resetKey =
      quotaReset === null
        ? null
        : quotaReset.unit === 'seconds'
          ? 'resetSeconds'
          : quotaReset.unit === 'minutes'
            ? 'resetMinutes'
            : 'resetHours';
    banner = (
      <PanelBanner
        tone="pending"
        title={t('banners.quota.title')}
        body={t('banners.quota.body')}
        extra={
          quotaReset !== null && resetKey !== null ? (
            <p className="mt-1 text-label-sm text-ink-muted">
              {t(`banners.quota.${resetKey}`, { count: quotaReset.count })}
            </p>
          ) : null
        }
        onRetry={onRetryStatus}
        retryLabel={t('banners.retry')}
        retryPending={statusPending}
      />
    );
  } else if (availability === 'limited') {
    banner = (
      <PanelBanner
        tone="pending"
        title={t('banners.limited.title')}
        body={t('banners.limited.body')}
      />
    );
  }

  const headerButtonClass =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      ref={panelRef}
      id={AI_AGENT_PANEL_ID}
      data-testid="ai-agent-panel"
      role="dialog"
      aria-modal={isMobile ? true : undefined}
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      tabIndex={-1}
      className={`animate-modal-panel fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-surface shadow-modal sm:inset-auto sm:bottom-24 sm:h-auto sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-lg sm:border sm:border-border ${
        edge === 'start' ? 'sm:start-4' : 'sm:end-4'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header
        className="flex items-start gap-3 border-b border-border px-4 pb-3"
        style={{ paddingTop: '0.75rem' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local portrait logo */}
        <img
          src={AI_AGENT_ICON_SRC}
          alt={t('branding.logoAlt')}
          className="h-9 w-9 shrink-0 rounded-full object-contain"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id={titleId}
              className="truncate text-title-sm font-semibold text-ink"
            >
              {t('panel.title')}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2 py-0.5 text-label-xs text-ink-muted">
              <span className="sr-only">{t('panel.statusLabel')}</span>
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${DOT_CLASSES[availability]}`}
              />
              <span>{t(`status.${availability}`)}</span>
            </span>
          </div>
          <p id={subtitleId} className="mt-0.5 text-body-sm text-ink-muted">
            {t('panel.subtitle')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={chat.newChat}
            disabled={chat.messages.length === 0 && !chat.isStreaming}
            aria-label={t('panel.newChat')}
            className={headerButtonClass}
          >
            <Plus aria-hidden="true" size={18} />
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('panel.close')}
            className={headerButtonClass}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      {banner}

      <MessageList
        messages={chat.messages}
        status={chat.status}
        error={chat.error}
        isStreaming={chat.isStreaming}
        canChat={canChat}
        canRetry={chat.canRetry}
        canContinue={chat.canContinue}
        onSuggestion={(text) => {
          void chat.send(text);
        }}
        onRetry={() => {
          void chat.retry();
        }}
        onContinue={() => {
          void chat.continueChat();
        }}
      />

      <Composer
        ref={textareaRef}
        disabled={inputDisabled}
        streaming={chat.isStreaming}
        canContinue={chat.canContinue}
        maxChars={Math.min(
          chat.limits.messageChars,
          serviceStatus?.limits.messageChars ?? chat.limits.messageChars,
        )}
        onSend={chat.send}
        onStop={chat.abort}
        onContinue={() => {
          void chat.continueChat();
        }}
      />

      <p className="px-4 pb-3 text-center text-label-xs text-ink-muted">
        {t('disclaimer')}
      </p>
    </div>
  );
}
