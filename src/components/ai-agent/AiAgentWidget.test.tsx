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
import { AI_AGENT_STATUS_TIMEOUT_MS, AI_AGENT_LAUNCHER_STORAGE_KEY } from './aiAgentUi';
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

function mockLauncherRect(
  launcher: HTMLElement,
  left: number,
  top: number,
  width = 56,
  height = 56,
) {
  return vi.spyOn(launcher, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
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
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('renders a compact header and no footer disclaimer', async () => {
    renderWidget();
    const panel = await openPanel();
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    });

    expect(screen.getByText(aiAgentEn.panel.subtitle)).toBeDefined();
    expect(
      screen.getByText(aiAgentEn.branding.name, {
        selector: 'h2',
      }),
    ).toBeDefined();
    expect(
      screen.queryByText(
        'Answers about opportunities, organizations, and volunteering on Basmatak.',
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        'Answers are generated from public Basmatak data and may be incomplete.',
      ),
    ).toBeNull();
    expect(panel.style.height).toContain('640px');
    expect(panel.style.height).toContain('100dvh');
    expect(panel.style.width).toBe('400px');
    expect(panel.style.bottom).toContain('1rem');
  });

  it('opens on the right when the launcher is on the right half', async () => {
    renderWidget();
    mockLauncherRect(
      screen.getByTestId('ai-agent-launcher'),
      900,
      700,
    );

    const panel = await openPanel();
    expect(panel.style.right).toContain('safe-area-inset-right');
    expect(panel.style.left).toBe('');
    expect(panel.style.bottom).toContain('1rem');
    expect(panel.style.bottom).toContain('safe-area-inset-bottom');
  });

  it('opens on the left when the launcher is on the left half', async () => {
    renderWidget();
    mockLauncherRect(
      screen.getByTestId('ai-agent-launcher'),
      20,
      700,
    );

    const panel = await openPanel();
    expect(panel.style.left).toContain('safe-area-inset-left');
    expect(panel.style.right).toBe('');
    expect(panel.style.bottom).toContain('1rem');
  });

  it('recomputes the side on the next opening after the launcher moves', async () => {
    renderWidget();
    const launcher = screen.getByTestId('ai-agent-launcher');
    const rect = mockLauncherRect(launcher, 900, 700);

    const rightPanel = await openPanel();
    expect(rightPanel.style.right).toContain('safe-area-inset-right');

    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.panel.close }),
    );
    await waitFor(() => {
      expect(screen.queryByTestId('ai-agent-panel')).toBeNull();
    });

    rect.mockReturnValue({
      left: 20,
      top: 700,
      width: 56,
      height: 56,
      right: 76,
      bottom: 756,
      x: 20,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect);

    const leftPanel = await openPanel();
    expect(leftPanel.style.left).toContain('safe-area-inset-left');
    expect(leftPanel.style.right).toBe('');
  });

  it('hides the launcher while open and restores it at the same position on close', async () => {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      JSON.stringify({ version: 1, edge: 'end', y: 500 }),
    );
    renderWidget();
    const launcher = screen.getByTestId('ai-agent-launcher');
    await waitFor(() => {
      expect(launcher.style.top).toBe('500px');
    });
    mockLauncherRect(launcher, 900, 500);

    await openPanel();
    expect(launcher.style.visibility).toBe('hidden');
    expect(launcher.style.pointerEvents).toBe('none');
    expect(launcher.style.top).toBe('500px');

    await waitFor(() => {
      expect(document.activeElement).toBe(getInput());
    });

    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.panel.close }),
    );
    await waitFor(() => {
      expect(screen.queryByTestId('ai-agent-panel')).toBeNull();
    });

    expect(launcher.style.visibility).toBe('');
    expect(launcher.style.pointerEvents).toBe('');
    expect(launcher.style.top).toBe('500px');
    expect(launcher.style.insetInlineEnd).toBe('16px');
    await waitFor(() => {
      expect(document.activeElement).toBe(launcher);
    });
  });

  it('sends a suggestion and hides the empty state afterwards', async () => {
    mockedStream.mockImplementation(async () => ({
      text: 'Here is an opportunity.',
      done: { finishReason: 'stop' },
      aborted: false,
    }));

    renderWidget();
    await openPanel();
    await waitFor(() => {
      expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    });
    expect(screen.getByText(aiAgentEn.empty.title)).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', {
        name: aiAgentEn.empty.suggestion1,
      }),
    );

    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(1));
    expect(mockedStream.mock.calls[0]?.[0]).toMatchObject({
      message: aiAgentEn.empty.suggestion1,
      locale: 'en',
    });
    await waitFor(() => {
      expect(screen.queryByText(aiAgentEn.empty.title)).toBeNull();
    });
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

  it('runs the real chat hook against a streamed answer with an internal link', async () => {
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
        data: { delta: 'You can help at the ' },
      });
      options?.onEvent?.({
        event: 'token',
        data: { delta: '[food drive](/en/opportunities/food-drive).' },
      });
      return {
        text: 'You can help at the [food drive](/en/opportunities/food-drive).',
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
        screen.getByRole('link', { name: 'food drive' }),
      ).toBeDefined();
    });
    expect(
      screen
        .getByRole('link', { name: 'food drive' })
        .getAttribute('href'),
    ).toBe('/opportunities/food-drive');
    expect(screen.queryByText(aiAgentEn.sources.title)).toBeNull();
    expect(getInput().value).toBe('');
  });

  it('renders generated cards below the answer and keeps the inline link', async () => {
    mockedStream.mockImplementation(async (_input, options) => {
      options?.onEvent?.({
        event: 'meta',
        data: { conversationId: 'c2', locale: 'en', mode: 'normal' },
      });
      options?.onEvent?.({
        event: 'token',
        data: { delta: 'You can help at the [food drive](/en/opportunities/food-drive).' },
      });
      options?.onEvent?.({
        event: 'cards',
        data: {
          cards: [
            {
              kind: 'opportunity',
              slug: 'food-drive',
              title: 'Food drive',
              organizationName: { ar: 'مؤسسة العطاء', fr: 'Helping Hands' },
              wilayaName: { ar: 'الجزائر', fr: 'Algiers' },
              href: '/en/opportunities/food-drive',
            },
          ],
        },
      });
      return {
        text: 'You can help at the [food drive](/en/opportunities/food-drive).',
        done: { finishReason: 'stop' },
        aborted: false,
      };
    });

    renderWidget();
    await openPanel();
    await sendMessage('Where can I help?');

    const cards = await screen.findByTestId('ai-agent-cards');
    expect(cards.textContent).toContain('Food drive');
    expect(cards.textContent).toContain('Helping Hands');
    expect(cards.textContent).toContain('Algiers');
    expect(screen.getByRole('link', { name: 'food drive' })).toBeDefined();
    expect(
      screen.getByRole('link', { name: /View opportunity/ }),
    ).toBeDefined();
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
