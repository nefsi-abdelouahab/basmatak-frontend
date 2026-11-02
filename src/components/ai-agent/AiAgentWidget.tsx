'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAiChat } from '@/hooks/useAiChat';
import { api } from '@/lib/api';
import {
  getAiAgentStatus,
  type AiAgentStatusResponse,
} from '@/lib/api/aiAgent';
import { AiAgentLauncher } from './AiAgentLauncher';
import { AiAgentPanel, type AiAgentPanelSide } from './AiAgentPanel';
import {
  AI_AGENT_STATUS_TIMEOUT_MS,
  AiAgentStatusTimeoutError,
  availabilityFor,
  isQuotaExhaustedError,
  withTimeout,
  type AiAgentStatusPhase,
} from './aiAgentUi';

const PANEL_CLOSE_MS = 150;

/**
 * Mounted once per localized page. The widget owns availability, quota, and
 * open state; the chat transcript itself lives in useAiChat so closing the
 * panel never loses an answer that is still streaming.
 */
export function AiAgentWidget() {
  const t = useTranslations('aiAgent');
  const locale = useLocale();
  const chatLocale = locale === 'ar' ? 'ar' : 'en';
  const chat = useAiChat({
    locale: chatLocale,
    continuePrompt: t('composer.continuePrompt'),
  });

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [panelSide, setPanelSide] = useState<AiAgentPanelSide>('right');
  const [serviceStatus, setServiceStatus] =
    useState<AiAgentStatusResponse | null>(null);
  const [statusPhase, setStatusPhase] =
    useState<AiAgentStatusPhase>('loading');
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [quotaRetryAfter, setQuotaRetryAfter] = useState<
    number | undefined
  >(undefined);

  const openRef = useRef(false);
  const mountedRef = useRef(true);
  const statusRequestRef = useRef(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusRequestRef.current += 1;
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    const requestId = statusRequestRef.current + 1;
    statusRequestRef.current = requestId;
    setStatusPhase('loading');

    try {
      const status = await withTimeout(
        getAiAgentStatus(api),
        AI_AGENT_STATUS_TIMEOUT_MS,
      );
      if (!mountedRef.current || requestId !== statusRequestRef.current) {
        return;
      }
      setServiceStatus(status);
      setStatusPhase('ready');
      if (status.mode === 'exhausted') {
        setQuotaBlocked(true);
      } else {
        setQuotaBlocked(false);
        setQuotaRetryAfter(undefined);
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== statusRequestRef.current) {
        return;
      }
      setServiceStatus(null);
      setStatusPhase(
        error instanceof AiAgentStatusTimeoutError ? 'waking' : 'offline',
      );
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!isQuotaExhaustedError(chat.error)) return;
    setQuotaBlocked(true);
    setQuotaRetryAfter(chat.error?.retryAfterSeconds);
  }, [chat.error]);

  const clearCloseTimer = useCallback((): void => {
    if (closeTimerRef.current === null) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const handleClose = useCallback((): void => {
    openRef.current = false;
    setOpen(false);
    clearCloseTimer();

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setClosing(false);
    } else {
      setClosing(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setClosing(false);
      }, PANEL_CLOSE_MS);
    }

    window.requestAnimationFrame(() => {
      launcherRef.current?.focus();
    });
  }, [clearCloseTimer]);

  const handleToggle = useCallback((): void => {
    if (openRef.current) {
      handleClose();
      return;
    }

    const launcherRect = launcherRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const launcherCenter =
      launcherRect !== undefined && launcherRect.width > 0
        ? launcherRect.left + launcherRect.width / 2
        : viewportWidth / 2;

    setPanelSide(
      launcherCenter < viewportWidth / 2 ? 'left' : 'right',
    );

    clearCloseTimer();
    setClosing(false);
    openRef.current = true;
    setOpen(true);
    void refreshStatus();
  }, [clearCloseTimer, handleClose, refreshStatus]);

  const availability = availabilityFor(serviceStatus, statusPhase);

  return (
    <>
      <AiAgentLauncher
        ref={launcherRef}
        open={open}
        availability={availability}
        onToggle={handleToggle}
      />
      {open || closing ? (
        <AiAgentPanel
          chat={chat}
          availability={availability}
          serviceStatus={serviceStatus}
          statusPending={statusPhase === 'loading'}
          quotaBlocked={quotaBlocked}
          quotaRetryAfter={quotaRetryAfter}
          side={panelSide}
          closing={closing}
          onClose={handleClose}
          onRetryStatus={() => {
            void refreshStatus();
          }}
        />
      ) : null}
    </>
  );
}
