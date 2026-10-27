'use client';

import {
  forwardRef,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowDown, Send, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ComposerProps {
  disabled: boolean;
  streaming: boolean;
  canContinue: boolean;
  maxChars: number;
  onSend: (text: string) => Promise<boolean> | boolean | void;
  onStop: () => void;
  onContinue: () => void;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer(
    {
      disabled,
      streaming,
      canContinue,
      maxChars,
      onSend,
      onStop,
      onContinue,
    },
    forwardedRef,
  ) {
    const t = useTranslations('aiAgent');
    const [value, setValue] = useState('');
    const inputId = useId();
    const hintId = useId();
    const countId = useId();
    const overLimitId = useId();

    const trimmed = value.trim();
    const overLimit = value.length > maxChars;
    const canSubmit =
      !disabled && !streaming && trimmed.length > 0 && !overLimit;

    function restoreIfRejected(text: string): void {
      setValue((current) => (current === '' ? text : current));
    }

    function submit(): void {
      if (!canSubmit) return;
      const text = trimmed;
      setValue('');
      let result: Promise<boolean> | boolean | void;
      try {
        result = onSend(text);
      } catch {
        restoreIfRejected(text);
        return;
      }
      if (result instanceof Promise) {
        void result
          .then((accepted) => {
            if (accepted === false) restoreIfRejected(text);
          })
          .catch(() => restoreIfRejected(text));
      } else if (result === false) {
        restoreIfRejected(text);
      }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
      event.preventDefault();
      submit();
    }

    function handleKeyDown(
      event: KeyboardEvent<HTMLTextAreaElement>,
    ): void {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }
      event.preventDefault();
      submit();
    }

    const describedBy = `${hintId} ${countId}${
      overLimit ? ` ${overLimitId}` : ''
    }`;

    return (
      <div className="space-y-2 border-t border-border bg-surface px-3 pt-3">
        {canContinue && !streaming ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <ArrowDown aria-hidden="true" size={14} />
              {t('message.continue')}
            </button>
          </div>
        ) : null}

        <form
          data-testid="ai-agent-composer"
          onSubmit={handleSubmit}
          className="flex items-end gap-2"
        >
          <label htmlFor={inputId} className="sr-only">
            {t('composer.label')}
          </label>
          <textarea
            ref={forwardedRef}
            id={inputId}
            data-testid="ai-agent-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            dir="auto"
            disabled={disabled}
            aria-invalid={overLimit || undefined}
            aria-describedby={describedBy}
            placeholder={t('composer.placeholder')}
            className="min-h-11 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-body-md text-ink transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t('composer.stop')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <Square aria-hidden="true" size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label={t('composer.send')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden="true" size={18} className="rtl:-scale-x-100" />
            </button>
          )}
        </form>

        <div className="flex items-start justify-between gap-3 pb-3">
          <p id={hintId} className="text-label-xs text-ink-muted">
            {t('composer.hint')}
          </p>
          <p
            id={countId}
            className={`shrink-0 text-label-xs ${
              overLimit ? 'text-status-error' : 'text-ink-muted'
            }`}
          >
            {t('composer.charCount', {
              count: value.length,
              max: maxChars,
            })}
          </p>
        </div>
        {overLimit ? (
          <p id={overLimitId} className="pb-3 text-label-xs text-status-error">
            {t('composer.overLimit')}
          </p>
        ) : null}
      </div>
    );
  },
);
