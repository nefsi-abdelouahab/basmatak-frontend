'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
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
  isMobile?: boolean;
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
      isMobile = false,
      maxChars,
      onSend,
      onStop,
      onContinue,
    },
    forwardedRef,
  ) {
    const t = useTranslations('aiAgent');
    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);
    const inputId = useId();
    const hintId = useId();
    const countId = useId();
    const overLimitId = useId();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const setTextareaRef = useCallback(
      (node: HTMLTextAreaElement | null): void => {
        textareaRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef !== null) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const trimmed = value.trim();
    const overLimit = value.length > maxChars;
    const canSubmit =
      !disabled && !streaming && trimmed.length > 0 && !overLimit;
    const showHint = !isMobile && focused && value.length > 0;
    const showCount = maxChars > 0 && value.length > maxChars * 0.8;
    const describedBy = [
      showHint ? hintId : null,
      showCount ? countId : null,
      overLimit ? overLimitId : null,
    ]
      .filter((id): id is string => id !== null)
      .join(' ');

    useEffect(() => {
      const input = textareaRef.current;
      if (input === null) return;

      input.style.height = 'auto';
      const computed = window.getComputedStyle(input);
      const parsedLineHeight = Number.parseFloat(computed.lineHeight);
      const lineHeight =
        Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
          ? parsedLineHeight
          : 21;
      const verticalPadding =
        (Number.parseFloat(computed.paddingTop) || 0) +
        (Number.parseFloat(computed.paddingBottom) || 0);
      const verticalBorder =
        (Number.parseFloat(computed.borderTopWidth) || 0) +
        (Number.parseFloat(computed.borderBottomWidth) || 0);
      const maxHeight =
        lineHeight * 4 + verticalPadding + verticalBorder;

      if (input.scrollHeight <= 0) return;
      input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
      input.style.overflowY =
        input.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [value]);

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

    return (
      <div
        data-testid="ai-agent-composer-shell"
        className="border-t border-border bg-surface px-3 pb-3 pt-3"
      >
        {canContinue && !streaming ? (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-label-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
            ref={setTextareaRef}
            id={inputId}
            data-testid="ai-agent-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            rows={1}
            dir="auto"
            enterKeyHint="send"
            disabled={disabled}
            aria-invalid={overLimit || undefined}
            aria-describedby={describedBy === '' ? undefined : describedBy}
            placeholder={t('composer.placeholder')}
            className="min-h-11 w-full resize-none overflow-y-hidden rounded-[14px] border border-border bg-surface px-3 py-2 text-body-md text-ink transition-colors placeholder:text-ink-muted focus:border-gold-strong focus:outline-none focus:ring-2 focus:ring-gold-strong/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t('composer.stop')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-ink transition-colors hover:bg-border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <Square aria-hidden="true" size={15} />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={t('composer.send')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send
              aria-hidden="true"
              size={17}
              className="rtl:-scale-x-100"
            />
          </button>
        </form>

        {showHint || showCount ? (
          <div className="mt-1.5 flex items-start justify-between gap-3">
            {showHint ? (
              <p id={hintId} className="text-label-xs text-ink-muted">
                {t('composer.hint')}
              </p>
            ) : null}
            {showCount ? (
              <p
                id={countId}
                className={`shrink-0 text-label-xs ${
                  showHint ? '' : 'ms-auto'
                } ${overLimit ? 'text-status-error' : 'text-ink-muted'}`}
              >
                {t('composer.charCount', {
                  count: value.length,
                  max: maxChars,
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        {overLimit ? (
          <p id={overLimitId} className="mt-1 text-label-xs text-status-error">
            {t('composer.overLimit')}
          </p>
        ) : null}
      </div>
    );
  },
);
