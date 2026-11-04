// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { AiAgentLauncher } from './AiAgentLauncher';
import { AI_AGENT_LAUNCHER_STORAGE_KEY } from './aiAgentUi';

function renderLauncher(
  props: Partial<ComponentProps<typeof AiAgentLauncher>> = {},
) {
  const onToggle = props.onToggle ?? vi.fn();
  const onEdgeChange = props.onEdgeChange ?? vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
      <AiAgentLauncher
        open={false}
        availability="online"
        {...props}
        onToggle={onToggle}
        onEdgeChange={onEdgeChange}
      />
    </NextIntlClientProvider>,
  );
  return {
    onToggle,
    onEdgeChange,
    button: screen.getByTestId('ai-agent-launcher'),
    ...view,
  };
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
}

function dispatchPointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  point: { x: number; y: number; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: point.x,
    clientY: point.y,
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: point.pointerId ?? 1,
  });
  fireEvent(element, event);
}

describe('AiAgentLauncher', () => {
  beforeEach(() => {
    setViewport(390, 800);
    window.localStorage.clear();
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.removeAttribute('dir');
    vi.restoreAllMocks();
  });

  it('renders an accessible launcher and toggles on click', () => {
    const { button, onToggle } = renderLauncher();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('ai-agent-panel');
    expect(button.getAttribute('aria-label')).toBe(aiAgentEn.launcher.open);
    expect(button.getAttribute('title')).toBe(aiAgentEn.launcher.open);
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reports the expanded state and reads the close label', () => {
    renderLauncher({ open: true });
    const button = screen.getByTestId('ai-agent-launcher');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(aiAgentEn.launcher.close);
    expect(button.getAttribute('title')).toBe(aiAgentEn.launcher.close);
  });

  it('hides at its stored position while open and returns when closed', async () => {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      JSON.stringify({ version: 1, edge: 'end', y: 500 }),
    );
    const { button, rerender } = renderLauncher();

    await waitFor(() => {
      expect(button.style.top).toBe('500px');
    });

    rerender(
      <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
        <AiAgentLauncher
          open
          availability="online"
          onToggle={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    const opened = screen.getByTestId('ai-agent-launcher');
    expect(opened.style.top).toBe('500px');
    expect(opened.style.insetInlineEnd).toBe('16px');
    expect(opened.style.visibility).toBe('hidden');
    expect(opened.style.pointerEvents).toBe('none');
    expect(opened.getAttribute('aria-expanded')).toBe('true');

    rerender(
      <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
        <AiAgentLauncher
          open={false}
          availability="online"
          onToggle={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    const closed = screen.getByTestId('ai-agent-launcher');
    expect(closed.style.top).toBe('500px');
    expect(closed.style.insetInlineEnd).toBe('16px');
    expect(closed.style.visibility).toBe('');
    expect(closed.style.pointerEvents).toBe('');
    expect(closed.getAttribute('aria-expanded')).toBe('false');
  });

  it('drags, snaps to the nearest edge, persists, and suppresses the click', async () => {
    const { button, onToggle } = renderLauncher();

    dispatchPointer(button, 'pointerdown', { x: 340, y: 720 });
    dispatchPointer(button, 'pointermove', { x: 300, y: 716 });
    dispatchPointer(button, 'pointermove', { x: 40, y: 120 });
    dispatchPointer(button, 'pointerup', { x: 40, y: 120 });

    // The click that can follow this pointer gesture is suppressed immediately;
    // the guard clears on the next task.
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();

    await waitFor(() => {
      const raw = window.localStorage.getItem(AI_AGENT_LAUNCHER_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw ?? '{}')).toMatchObject({
        version: 1,
        edge: 'start',
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps a click as a click when pointer movement stays under threshold', () => {
    const { button, onToggle } = renderLauncher();
    dispatchPointer(button, 'pointerdown', { x: 340, y: 720 });
    dispatchPointer(button, 'pointermove', { x: 342, y: 721 });
    dispatchPointer(button, 'pointerup', { x: 342, y: 721 });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(
      window.localStorage.getItem(AI_AGENT_LAUNCHER_STORAGE_KEY),
    ).toBeNull();
  });

  it('snaps to the opposing logical edge in RTL', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { button } = renderLauncher();

    dispatchPointer(button, 'pointerdown', { x: 40, y: 720 });
    dispatchPointer(button, 'pointermove', { x: 340, y: 140 });
    dispatchPointer(button, 'pointerup', { x: 340, y: 140 });

    await waitFor(() => {
      const raw = window.localStorage.getItem(AI_AGENT_LAUNCHER_STORAGE_KEY);
      expect(JSON.parse(raw ?? '{}')).toMatchObject({ edge: 'start' });
    });
  });

  it('resets a stored off-screen position', async () => {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      JSON.stringify({ version: 1, edge: 'start', y: 5000 }),
    );
    renderLauncher();
    await waitFor(() => {
      expect(
        window.localStorage.getItem(AI_AGENT_LAUNCHER_STORAGE_KEY),
      ).toBeNull();
    });
  });

  it('clamps the persisted position above the bottom navigation after a resize', async () => {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      JSON.stringify({ version: 1, edge: 'start', y: 700 }),
    );
    const { button } = renderLauncher();

    // Below `lg` the 72px bottom navigation plus a 24px gap reserves space, so
    // 700px is clamped to 800 - 52 - 96 = 652px.
    await waitFor(() => {
      expect((button as HTMLElement).style.top).toBe('652px');
    });

    setViewport(390, 400);
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(button.style.top).toBe('252px');
    });
  });

  it('keeps the full-height position on large screens', async () => {
    setViewport(1280, 800);
    const { button } = renderLauncher();

    await waitFor(() => {
      expect((button as HTMLElement).style.top).toBe('720px');
    });
  });
});
