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
import type { AiAgentSourcesEvent } from '@/lib/api/aiAgent';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { MessageBubble } from './MessageBubble';

vi.mock('@/i18n/navigation', () => ({
  // Simulate next-intl's locale-aware Link, which prepends the active locale
  // to every internal href. A double-prefixed href therefore becomes visible.
  Link: ({
    href,
    children,
    className,
    'data-link-card': linkCard,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    'data-link-card'?: string;
  }) => (
    <a
      href={`/en${href}`}
      className={className}
      data-link-card={linkCard}
    >
      {children}
    </a>
  ),
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

  it('renders an internal entity link as a link card with the locale prefix', () => {
    renderBubble({
      message: message({
        content: 'See [Beach cleanup](/opportunities/beach-cleanup).',
      }),
    });
    const link = screen.getByRole('link', { name: 'Beach cleanup' });
    expect(link.getAttribute('href')).toBe(
      '/en/opportunities/beach-cleanup',
    );
    expect(link.getAttribute('data-link-card')).toBe('true');
    expect(link.className).toContain('rounded-[10px]');
  });

  it('does not add a second locale prefix to an already-prefixed link', () => {
    renderBubble({
      message: message({
        content: 'See [Beach cleanup](/en/opportunities/beach-cleanup).',
      }),
    });
    const link = screen.getByRole('link', { name: 'Beach cleanup' });
    expect(link.getAttribute('href')).toBe(
      '/en/opportunities/beach-cleanup',
    );
  });

  it('normalizes a stored absolute link with a doubled locale', () => {
    renderBubble({
      message: message({
        content:
          'See [Beach cleanup](http://localhost:3000/en/en/opportunities/beach-cleanup).',
      }),
    });
    const link = screen.getByRole('link', { name: 'Beach cleanup' });
    expect(link.getAttribute('href')).toBe(
      '/en/opportunities/beach-cleanup',
    );
    expect(screen.queryByText(/\[Beach cleanup\]\(/)).toBeNull();
  });

  it('keeps non-entity internal links as normal text links', () => {
    renderBubble({
      message: message({
        content: 'Browse [talents](/talents).',
      }),
    });
    const link = screen.getByRole('link', { name: 'talents' });
    expect(link.getAttribute('href')).toBe('/en/talents');
    expect(link.hasAttribute('data-link-card')).toBe(false);
  });

  it('sets bubble direction from the message script, not the UI locale', () => {
    const { unmount } = renderBubble({
      message: message({ content: 'مرحبا كيف أساعد؟' }),
    });
    expect(
      screen.getByText('مرحبا كيف أساعد؟').getAttribute('dir'),
    ).toBe('rtl');
    unmount();

    renderBubble({
      message: message({ content: 'How can I help?' }),
    });
    expect(
      screen.getByText('How can I help?').getAttribute('dir'),
    ).toBe('ltr');
  });

  it('strips external links to plain text', () => {
    const { container } = renderBubble({
      message: message({
        content: 'Visit [example](https://evil.example).',
      }),
    });
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Visit example.');
  });

  it('does not render source chips even when sources are present', () => {
    const sources: AiAgentSourcesEvent = {
      knowledge: [
        {
          id: 'K1',
          title: 'Basmatak FAQ',
          source: 'faq/en.md',
        },
      ],
      data: [
        {
          id: 'T1-1',
          citationId: 'T1',
          type: 'opportunity',
          title: 'Food drive',
          path: '/opportunities/food-drive',
        },
      ],
    };
    renderBubble({
      message: message({ content: 'Answer', sources }),
    });
    expect(screen.queryByText(aiAgentEn.sources.title)).toBeNull();
  });

  it('shows the typing dots only while waiting for the first token', () => {
    const { unmount } = renderBubble({
      message: message({ content: '', status: 'streaming' }),
      typingPhase: 'searching',
    });
    expect(
      screen.getByText(aiAgentEn.message.typing.searching),
    ).toBeDefined();
    unmount();

    renderBubble({
      message: message({ content: 'Partial answer', status: 'streaming' }),
      typingPhase: 'searching',
    });
    expect(
      screen.queryByText(aiAgentEn.message.typing.searching),
    ).toBeNull();
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
