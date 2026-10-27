// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import aiAgentEn from '@/messages/ai-agent/en.json';
import aiAgentAr from '@/messages/ai-agent/ar.json';
import {
  AiAgentError,
  getAiAgentStatus,
  streamChat,
  type AiAgentStatusResponse,
} from '@/lib/api/aiAgent';
import { AI_AGENT_STATUS_TIMEOUT_MS } from './aiAgentUi';
import { AiAgentWidget } from './AiAgentWidget';

vi.mock('@/lib/api', () => ({ api: {} }));

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

vi.mock('@/lib/api/aiAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/aiAgent')>();
  return {
    ...actual,
    getAiAgentStatus: vi.fn(),
    streamChat: vi.fn(),
  };
});

const mockedStatus = vi.mocked(getAiAgentStatus);
const mockedStream = vi.mocked(streamChat);

const status: AiAgentStatusResponse = {
  enabled: true,
  mode: 'normal',
  knowledge: { files: 3, chunks: 20 },
  limits: { messageChars: 2000, historyMessages: 4, historyChars: 2400 },
};

function renderWidget(locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ aiAgent: locale === 'ar' ? aiAgentAr : aiAgentEn }}
    >
      <AiAgentWidget />
    </NextIntlClientProvider>,
  );
}

async function openPanel() {
  fireEvent.click(screen.getByTestId('ai-agent-launcher'));
  return screen.findByTestId('ai-agent-panel');
}

function getInput(): HTMLTextAreaElement {
  return screen.getByTestId('ai-agent-input') as HTMLTextAreaElement;
}

async function sendMessage(text: string) {
  fireEvent.change(getInput(), { target: { value: text } });
  fireEvent.click(
    screen.getByRole('button', { name: aiAgentEn.composer.send }),
  );
}

describe('AiAgentWidget', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    mockedStatus.mockReset();
    mockedStream.mockReset();
    mockedStatus.mockResolvedValue(status);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('checks status on mount and on each open, without polling', async () => {
    renderWidget();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    await openPanel();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(mockedStatus).toHaveBeenCalledTimes(2);
  });

  it('runs the real chat hook against the streamed answer and sources', async () => {
    mockedStream.mockImplementation(async (_input, options) => {
      options?.onEvent?.({
        event: 'meta',
        data: { conversationId: 'c1', locale: 'en', mode: 'normal' },
      });
      options?.onEvent?.({
        event: 'status',
        data: { state: 'searching' },
      });
      options?.onEvent?.({
        event: 'sources',
        data: {
          knowledge: [],
          data: [
            {
              id: 'd1',
              citationId: 'T1',
              type: 'opportunity',
              title: 'Food drive',
              path: '/opportunities/food-drive',
            },
          ],
        },
      });
      options?.onEvent?.({
        event: 'token',
        data: { delta: 'You can help ' },
      });
      options?.onEvent?.({
        event: 'token',
        data: { delta: 'at the food drive.' },
      });
      return {
        text: 'You can help at the food drive.',
        done: { finishReason: 'stop' },
        aborted: false,
      };
    });

    renderWidget();
    await openPanel();
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    });

    await sendMessage('Where can I help?');

    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(1));
    expect(mockedStream.mock.calls[0]?.[0]).toMatchObject({
      message: 'Where can I help?',
      locale: 'en',
    });
    expect(mockedStream.mock.calls[0]?.[0].history).toBeUndefined();

    await waitFor(() => {
      expect(
        screen.getByText('You can help at the food drive.'),
      ).toBeDefined();
    });
    expect(
      screen.getByRole('link', { name: /Food drive/ }).getAttribute('href'),
    ).toBe('/opportunities/food-drive');
    expect(getInput().value).toBe('');
  });

  it('sends the Arabic locale when the page is Arabic', async () => {
    mockedStream.mockImplementation(async (_input, options) => {
      options?.onEvent?.({
        event: 'token',
        data: { delta: 'مرحبا' },
      });
      return {
        text: 'مرحبا',
        done: { finishReason: 'stop' },
        aborted: false,
      };
    });

    renderWidget('ar');
    await openPanel();
    await waitFor(() => {
      expect(screen.getByText(aiAgentAr.status.online)).toBeDefined();
    });

    fireEvent.change(getInput(), { target: { value: 'كيف أساعد؟' } });
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentAr.composer.send }),
    );

    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(1));
    expect(mockedStream.mock.calls[0]?.[0]).toMatchObject({
      message: 'كيف أساعد؟',
      locale: 'ar',
    });
    await waitFor(() => {
      expect(screen.getByText('مرحبا')).toBeDefined();
    });
  });

  it('blocks the composer on quota errors and recovers after checking again', async () => {
    mockedStream.mockRejectedValue(
      new AiAgentError('AI_AGENT_QUOTA_EXHAUSTED', {
        retryAfterSeconds: 90,
      }),
    );

    renderWidget();
    await openPanel();
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    });

    await sendMessage('One more question');
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.banners.quota.title)).toBeDefined();
    });
    expect(
      screen.getByText('The limit resets in 2 minutes.'),
    ).toBeDefined();
    expect(getInput().disabled).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.banners.retry }),
    );
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(getInput().disabled).toBe(false));
    expect(screen.queryByText(aiAgentEn.banners.quota.title)).toBeNull();
  });

  it('renders the offline banner when the status request fails', async () => {
    mockedStatus.mockRejectedValue(new Error('network down'));

    renderWidget();
    await openPanel();
    await waitFor(() => {
      expect(
        screen.getByText(aiAgentEn.banners.offline.title),
      ).toBeDefined();
    });
    expect(getInput().disabled).toBe(true);
    expect(mockedStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('maps a status timeout to the waking banner instead of offline', async () => {
    vi.useFakeTimers();
    mockedStatus.mockImplementation(
      () => new Promise<AiAgentStatusResponse>(() => undefined),
    );

    renderWidget();
    fireEvent.click(screen.getByTestId('ai-agent-launcher'));
    expect(screen.getByTestId('ai-agent-panel')).toBeDefined();
    expect(
      screen.getByText(aiAgentEn.banners.waking.title),
    ).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_AGENT_STATUS_TIMEOUT_MS + 1);
    });

    expect(
      screen.getByText(aiAgentEn.banners.waking.title),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: aiAgentEn.banners.retry })
        .hasAttribute('disabled'),
    ).toBe(false);
  });
});
