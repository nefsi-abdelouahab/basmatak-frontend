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

  it('shows the character counter only above 80% of the limit', () => {
    const { input } = renderComposer({ maxChars: 100 });
    expect(screen.queryByText('0 of 100 characters')).toBeNull();

    type(input, 'x'.repeat(80));
    expect(screen.queryByText('80 of 100 characters')).toBeNull();

    type(input, 'x'.repeat(81));
    expect(screen.getByText('81 of 100 characters')).toBeDefined();
  });

  it('shows the keyboard hint only while focused with content on desktop', () => {
    const { input } = renderComposer();
    expect(screen.queryByText(aiAgentEn.composer.hint)).toBeNull();

    fireEvent.focus(input);
    expect(screen.queryByText(aiAgentEn.composer.hint)).toBeNull();

    type(input, 'Hello');
    expect(screen.getByText(aiAgentEn.composer.hint)).toBeDefined();

    fireEvent.blur(input);
    expect(screen.queryByText(aiAgentEn.composer.hint)).toBeNull();
  });

  it('hides the keyboard hint on mobile', () => {
    const { input } = renderComposer({ isMobile: true });
    fireEvent.focus(input);
    type(input, 'Hello');
    expect(screen.queryByText(aiAgentEn.composer.hint)).toBeNull();
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

  it('keeps send disabled while streaming and offers stop', () => {
    const { onStop } = renderComposer({ streaming: true });
    expect(
      screen
        .getByRole('button', { name: aiAgentEn.composer.send })
        .hasAttribute('disabled'),
    ).toBe(true);
    const stop = screen.getByRole('button', {
      name: aiAgentEn.composer.stop,
    });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('offers continue when a completed answer was shortened', () => {
    const { onContinue } = renderComposer({ canContinue: true });
    fireEvent.click(
      screen.getByRole('button', { name: aiAgentEn.message.continue }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
