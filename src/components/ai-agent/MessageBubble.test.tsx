// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import aiAgentEn from '@/messages/ai-agent/en.json';
import { AiAgentError } from '@/lib/api/aiAgent';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { MessageBubble } from './MessageBubble';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function message(overrides: Partial<AiChatMessage> = {}): AiChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    content: '',
    createdAt: '2026-10-26T00:00:00.000Z',
    status: 'complete',
    ...overrides,
  };
}

function renderBubble(
  props: Partial<ComponentProps<typeof MessageBubble>> = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
      <MessageBubble
        message={props.message ?? message()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('MessageBubble', () => {
  afterEach(cleanup);

  it('renders message text literally, never as HTML', () => {
    const { container } = renderBubble({
      message: message({
        role: 'user',
        content: '<script>alert("x")</script>',
        status: 'complete',
      }),
    });
    expect(
      screen.getByText('<script>alert("x")</script>'),
    ).toBeDefined();
    expect(container.querySelector('script')).toBeNull();
  });

  it('exposes a localized sender label', () => {
    renderBubble({
      message: message({ role: 'user', content: 'Hello', status: 'complete' }),
    });
    expect(screen.getByText(aiAgentEn.message.you)).toBeDefined();
  });

  it('shows localized typing state and hides streaming text from assistive tech', () => {
    renderBubble({
      message: message({ content: 'Partial answer', status: 'streaming' }),
      typingPhase: 'searching',
    });
    expect(
      screen.getByText(aiAgentEn.message.typing.searching),
    ).toBeDefined();
    const content = screen.getByText('Partial answer');
    expect(content.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders a safe mapped error with retry guidance and retry action', () => {
    const onRetry = vi.fn();
    renderBubble({
      message: message({ content: 'Partial', status: 'error' }),
      error: new AiAgentError('RATE_LIMITED', { retryAfterSeconds: 30 }),
      canRetry: true,
      onRetry,
    });
    expect(screen.getByText(aiAgentEn.message.errorTitle)).toBeDefined();
    expect(screen.getByText(aiAgentEn.errors.rateLimited)).toBeDefined();
    expect(
      screen.getByText('Try again in 30 seconds.'),
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.message.retry }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a stopped state with retry', () => {
    const onRetry = vi.fn();
    renderBubble({
      message: message({ content: 'Half', status: 'aborted' }),
      canRetry: true,
      onRetry,
    });
    expect(screen.getByText(aiAgentEn.message.stopped)).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.message.retry }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the shortened state and continues a truncated answer', () => {
    const onContinue = vi.fn();
    renderBubble({
      message: message({
        content: 'A long answer',
        status: 'complete',
        truncated: true,
      }),
      canContinue: true,
      onContinue,
    });
    expect(screen.getByText(aiAgentEn.message.shortened)).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.message.continue }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
