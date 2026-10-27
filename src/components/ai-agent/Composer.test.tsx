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
import type { ComponentProps } from 'react';
import aiAgentEn from '@/messages/ai-agent/en.json';
import { Composer } from './Composer';

function renderComposer(
  props: Partial<ComponentProps<typeof Composer>> = {},
) {
  const onSend = props.onSend ?? vi.fn(() => true);
  const onStop = props.onStop ?? vi.fn();
  const onContinue = props.onContinue ?? vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
      <Composer
        disabled={false}
        streaming={false}
        canContinue={false}
        maxChars={2000}
        {...props}
        onSend={onSend}
        onStop={onStop}
        onContinue={onContinue}
      />
    </NextIntlClientProvider>,
  );
  return {
    onSend,
    onStop,
    onContinue,
    ...view,
    input: screen.getByTestId('ai-agent-input') as HTMLTextAreaElement,
  };
}

function type(input: HTMLTextAreaElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

describe('Composer', () => {
  afterEach(cleanup);

  it('sends trimmed text on Enter and clears the field', () => {
    const { input, onSend } = renderComposer();
    type(input, '  Where can I volunteer?  ');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Where can I volunteer?');
    expect(input.value).toBe('');
  });

  it('inserts a newline instead of sending with Shift+Enter', () => {
    const { input, onSend } = renderComposer();
    type(input, 'First line');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe('First line');
  });

  it('submits from the send button and keeps the text on a rejected send', async () => {
    const { input, onSend } = renderComposer({
      onSend: vi.fn(() => false),
    });
    type(input, 'Keep this');
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.composer.send }),
    );

    expect(onSend).toHaveBeenCalledWith('Keep this');
    await waitFor(() => expect(input.value).toBe('Keep this'));
  });

  it('restores the text when an async send rejects', async () => {
    const { input, onSend } = renderComposer({
      onSend: vi.fn(() => Promise.reject(new Error('offline'))),
    });
    type(input, 'Try again');
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.composer.send }),
    );

    expect(onSend).toHaveBeenCalledWith('Try again');
    await waitFor(() => expect(input.value).toBe('Try again'));
  });

  it('blocks over-limit text with an explicit error', () => {
    const { input, onSend } = renderComposer({ maxChars: 5 });
    type(input, '123456');

    expect(screen.getByText(aiAgentEn.composer.overLimit)).toBeDefined();
    expect(
      screen.getByText('6 of 5 characters'),
    ).toBeDefined();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const send = screen.getByRole('button', {
      name: aiAgentEn.composer.send,
    });
    expect(send.hasAttribute('disabled')).toBe(true);
    fireEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables input and submit while unavailable', () => {
    const { input } = renderComposer({ disabled: true, maxChars: 10 });
    expect(input.disabled).toBe(true);
    expect(
      screen
        .getByRole('button', { name: aiAgentEn.composer.send })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('swaps send for stop while streaming and calls onStop', () => {
    const { onStop } = renderComposer({ streaming: true });
    const stop = screen.getByRole('button', {
      name: aiAgentEn.composer.stop,
    });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: aiAgentEn.composer.send }),
    ).toBeNull();
  });

  it('offers continue when a completed answer was shortened', () => {
    const { onContinue } = renderComposer({ canContinue: true });
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.message.continue }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
