// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import aiAgentEn from '@/messages/ai-agent/en.json';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { MessageList } from './MessageList';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function message(overrides: Partial<AiChatMessage> = {}): AiChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    content: 'An answer',
    createdAt: '2026-10-26T00:00:00.000Z',
    status: 'complete',
    ...overrides,
  };
}

function renderList(
  props: Partial<ComponentProps<typeof MessageList>> = {},
) {
  const handlers = {
    onSuggestion: vi.fn(),
    onRetry: vi.fn(),
    onContinue: vi.fn(),
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
      <MessageList
        messages={[]}
        status={null}
        error={null}
        isStreaming={false}
        canChat
        canRetry={false}
        canContinue={false}
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...handlers, ...view };
}

function announcement() {
  return screen.getByRole('status', {
    name: aiAgentEn.message.liveLabel,
  });
}

describe('MessageList', () => {
  afterEach(cleanup);

  it('shows the empty state with localized suggestions', () => {
    const { onSuggestion } = renderList();
    expect(screen.getByText(aiAgentEn.empty.title)).toBeDefined();
    expect(
      screen.getByRole('list', {
        name: aiAgentEn.empty.suggestionsLabel,
      }),
    ).toBeDefined();

    for (const key of [
      'suggestion1',
      'suggestion2',
      'suggestion3',
      'suggestion4',
    ] as const) {
      expect(
        screen.getByRole('button', { name: aiAgentEn.empty[key] }),
      ).toBeDefined();
    }

    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.empty.suggestion2 }),
    );
    expect(onSuggestion).toHaveBeenCalledWith(aiAgentEn.empty.suggestion2);
  });

  it('disables suggestions while chat is unavailable', () => {
    renderList({ canChat: false });
    for (const key of [
      'suggestion1',
      'suggestion2',
      'suggestion3',
      'suggestion4',
    ] as const) {
      const button = screen.getByRole('button', {
        name: aiAgentEn.empty[key],
      });
      expect(button.hasAttribute('disabled')).toBe(true);
    }
  });

  it('renders the transcript as a polite log with plain message text', () => {
    renderList({
      messages: [
        message({ id: 'u1', role: 'user', content: 'Hello' }),
        message({ id: 'a1', content: 'A **literal** answer' }),
      ],
    });

    const log = screen.getByRole('log', {
      name: aiAgentEn.panel.messagesLabel,
    });
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(
      screen.getByText('A **literal** answer').tagName,
    ).toBe('P');
  });

  it('shows the localized typing phase while a message streams', () => {
    renderList({
      messages: [message({ content: '', status: 'streaming' })],
      status: { state: 'searching' },
      isStreaming: true,
    });
    expect(
      screen.getByText(aiAgentEn.message.typing.searching),
    ).toBeDefined();
  });

  it('does not announce a hydrated transcript on first render', () => {
    renderList({ messages: [message({ id: 'stored' })] });
    expect(announcement().textContent).toBe('');
  });

  it('announces completion once the last answer settles', async () => {
    const streaming = message({
      id: 'a2',
      content: 'Partial',
      status: 'streaming',
    });
    const { rerender } = renderList({ messages: [streaming] });
    expect(announcement().textContent).toBe('');

    rerender(
      <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
        <MessageList
          messages={[{ ...streaming, content: 'Done', status: 'complete' }]}
          status={null}
          error={null}
          isStreaming={false}
          canChat
          canRetry={false}
          canContinue={false}
          onSuggestion={vi.fn()}
          onRetry={vi.fn()}
          onContinue={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(announcement().textContent).toBe(aiAgentEn.message.liveReady);
    });
  });

  it('announces an error and a stopped answer', async () => {
    const { rerender } = renderList();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
        <MessageList
          messages={[message({ id: 'a1', status: 'error' })]}
          status={null}
          error={null}
          isStreaming={false}
          canChat
          canRetry={false}
          canContinue={false}
          onSuggestion={vi.fn()}
          onRetry={vi.fn()}
          onContinue={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(announcement().textContent).toBe(aiAgentEn.message.liveError);
    });

    rerender(
      <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
        <MessageList
          messages={[
            message({ id: 'a1', status: 'error' }),
            message({ id: 'a2', status: 'aborted' }),
          ]}
          status={null}
          error={null}
          isStreaming={false}
          canChat
          canRetry={false}
          canContinue={false}
          onSuggestion={vi.fn()}
          onRetry={vi.fn()}
          onContinue={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(announcement().textContent).toBe(aiAgentEn.message.liveStopped);
    });
  });
});
