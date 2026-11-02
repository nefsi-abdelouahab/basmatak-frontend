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
import aiAgentAr from '@/messages/ai-agent/ar.json';
import type { AiAgentStatusResponse } from '@/lib/api/aiAgent';
import type { AiChatView } from './aiAgentUi';
import { AiAgentPanel } from './AiAgentPanel';

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

const onlineStatus: AiAgentStatusResponse = {
  enabled: true,
  mode: 'normal',
  knowledge: { files: 3, chunks: 20 },
  limits: { messageChars: 2000, historyMessages: 4, historyChars: 2400 },
};

function createChat(overrides: Partial<AiChatView> = {}): AiChatView {
  return {
    messages: [],
    connection: 'idle',
    isStreaming: false,
    status: null,
    error: null,
    canSend: true,
    canRetry: false,
    canContinue: false,
    limits: { messageChars: 2000 },
    send: vi.fn(async () => true),
    abort: vi.fn(),
    retry: vi.fn(async () => true),
    continueChat: vi.fn(async () => true),
    newChat: vi.fn(),
    ...overrides,
  };
}

function renderPanel(
  props: Partial<ComponentProps<typeof AiAgentPanel>> = {},
  locale: 'en' | 'ar' = 'en',
) {
  const chat = props.chat ?? createChat();
  const onClose = props.onClose ?? vi.fn();
  const onRetryStatus = props.onRetryStatus ?? vi.fn();
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ aiAgent: locale === 'ar' ? aiAgentAr : aiAgentEn }}
    >
      <AiAgentPanel
        chat={chat}
        availability="online"
        serviceStatus={onlineStatus}
        statusPending={false}
        quotaBlocked={false}
        quotaRetryAfter={undefined}
        side="right"
        {...props}
        onClose={onClose}
        onRetryStatus={onRetryStatus}
      />
    </NextIntlClientProvider>,
  );
  return { chat, onClose, onRetryStatus, ...view };
}

describe('AiAgentPanel', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('renders a compact accessible header with the Basma name and subtitle', async () => {
    renderPanel();
    const dialog = screen.getByRole('dialog', {
      name: aiAgentEn.panel.label,
    });
    expect(dialog.getAttribute('aria-modal')).toBeNull();
    expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
    expect(
      screen.getByRole('heading', { name: aiAgentEn.panel.title }),
    ).toBeDefined();
    expect(screen.getByText(aiAgentEn.panel.subtitle)).toBeDefined();
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
    expect(screen.getByText(aiAgentEn.status.online)).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('ai-agent-input'),
      );
    });
  });

  it('keeps a fixed panel size anchored to the bottom corner', () => {
    renderPanel();
    const panel = screen.getByTestId('ai-agent-panel');
    expect(panel.className).toContain('fixed');
    expect(panel.style.height).toContain('640px');
    expect(panel.style.height).toContain('100dvh');
    expect(panel.style.width).toBe('400px');
    expect(panel.style.bottom).toContain('1rem');
    expect(panel.style.bottom).toContain('safe-area-inset-bottom');
    expect(panel.style.right).toContain('safe-area-inset-right');
    expect(panel.style.left).toBe('');
    expect(panel.className).toContain('rounded-[20px]');
    expect(panel.className).toContain('shadow-modal');
  });

  it('uses the requested physical side regardless of locale', () => {
    const right = renderPanel();
    expect(screen.getByTestId('ai-agent-panel').style.right).toContain(
      'safe-area-inset-right',
    );
    expect(screen.getByTestId('ai-agent-panel').style.left).toBe('');
    right.unmount();

    renderPanel({ side: 'left' }, 'ar');
    expect(screen.getByTestId('ai-agent-panel').style.left).toContain(
      'safe-area-inset-left',
    );
    expect(screen.getByTestId('ai-agent-panel').style.right).toBe('');
  });

  it('keeps the composer flush as the last panel child with no extra gap', () => {
    renderPanel();
    const panel = screen.getByTestId('ai-agent-panel');
    const composerShell = screen.getByTestId('ai-agent-composer-shell');
    const transcript = panel.children[1] as HTMLElement;

    expect(panel.className).toContain('flex');
    expect(panel.className).toContain('flex-col');
    expect(panel.className).not.toContain('pb-[');
    expect(panel.style.paddingBottom).toBe('');
    expect(transcript.className).toContain('flex-1');
    expect(transcript.className).toContain('min-h-0');
    expect(panel.lastElementChild).toBe(composerShell);
    expect(composerShell.parentElement).toBe(panel);
    expect(composerShell.className).toContain('pb-3');
    expect(composerShell.className).not.toContain('4.5rem');
  });

  it('closes from the button and Escape', () => {
    const { onClose } = renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.panel.close }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('starts a new chat only when a transcript exists', () => {
    const empty = renderPanel();
    expect(
      screen
        .getByRole('button', { name: aiAgentEn.panel.newChat })
        .hasAttribute('disabled'),
    ).toBe(true);
    empty.unmount();

    const chat = createChat({
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-10-26T00:00:00.000Z',
          status: 'complete',
        },
      ],
    });
    renderPanel({ chat });
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.panel.newChat }),
    );
    expect(chat.newChat).toHaveBeenCalledTimes(1);
  });

  it('shows the offline banner and lets the user retry status', () => {
    const { onRetryStatus } = renderPanel({
      availability: 'offline',
      serviceStatus: null,
    });
    expect(screen.getByText(aiAgentEn.banners.offline.title)).toBeDefined();
    expect(
      (screen.getByTestId('ai-agent-input') as HTMLTextAreaElement).disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.banners.retry }),
    );
    expect(onRetryStatus).toHaveBeenCalledTimes(1);
  });

  it('shows the waking banner with a pending retry state', () => {
    renderPanel({
      availability: 'waking',
      serviceStatus: null,
      statusPending: true,
    });
    expect(screen.getByText(aiAgentEn.banners.waking.title)).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: aiAgentEn.banners.retry })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows the limited banner without blocking questions', () => {
    renderPanel({
      availability: 'limited',
      serviceStatus: { ...onlineStatus, mode: 'knowledge_only' },
    });
    expect(screen.getByText(aiAgentEn.banners.limited.body)).toBeDefined();
    expect(
      screen.getAllByText(aiAgentEn.banners.limited.title),
    ).toHaveLength(2);
    expect(
      (screen.getByTestId('ai-agent-input') as HTMLTextAreaElement).disabled,
    ).toBe(false);
  });

  it('blocks the composer after quota exhaustion and shows the reset time', () => {
    renderPanel({ quotaBlocked: true, quotaRetryAfter: 90 });
    expect(screen.getByText(aiAgentEn.banners.quota.title)).toBeDefined();
    expect(
      screen.getByText('The limit resets in 2 minutes.'),
    ).toBeDefined();
    expect(
      (screen.getByTestId('ai-agent-input') as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it('blocks the composer when the service reports exhausted mode', () => {
    renderPanel({
      availability: 'limited',
      serviceStatus: { ...onlineStatus, mode: 'exhausted' },
    });
    expect(screen.getByText(aiAgentEn.banners.quota.title)).toBeDefined();
    expect(
      (screen.getByTestId('ai-agent-input') as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it('uses the smaller of the hook and service message limits', () => {
    renderPanel({
      serviceStatus: {
        ...onlineStatus,
        limits: { ...onlineStatus.limits, messageChars: 5 },
      },
    });
    const input = screen.getByTestId('ai-agent-input');
    fireEvent.change(input, { target: { value: '123456' } });
    expect(screen.getByText(aiAgentEn.composer.overLimit)).toBeDefined();
  });

  it('locks body scroll, traps focus, and restores focus on mobile', async () => {
    const listeners: Array<(event: Event) => void> = [];
    const media = {
      matches: true,
      media: '(max-width: 479px)',
      addEventListener: vi.fn(
        (_type: string, listener: (event: Event) => void) => {
          listeners.push(listener);
        },
      ),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => media),
    });

    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = renderPanel();
    const dialog = screen.getByRole('dialog', {
      name: aiAgentEn.panel.label,
    });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(listeners.length).toBeGreaterThan(0);
    expect(dialog.style.width).toBe('calc(100vw - 1.5rem)');
    expect(dialog.style.height).toContain('100dvh');
    expect(dialog.style.height).toContain('6rem');
    expect(dialog.style.height).toContain('safe-area-inset-bottom');
    expect(dialog.style.left).toBe('0.75rem');
    expect(dialog.style.right).toBe('');
    expect(dialog.style.bottom).toContain('1rem');

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('ai-agent-input'),
      );
    });

    const input = screen.getByTestId('ai-agent-input');
    (input as HTMLTextAreaElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: aiAgentEn.panel.close }),
    );

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });
});
