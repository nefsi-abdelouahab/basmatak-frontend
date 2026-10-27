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
  render(
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
    button: screen.getByRole('button', {
      name: props.open
        ? aiAgentEn.launcher.close
        : aiAgentEn.launcher.open,
    }),
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
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reports the expanded state and reads the close label', () => {
    renderLauncher({ open: true });
    const button = screen.getByRole('button', {
      name: aiAgentEn.launcher.close,
    });
    expect(button.getAttribute('aria-expanded')).toBe('true');
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

  it('clamps the persisted position after a viewport resize', async () => {
    window.localStorage.setItem(
      AI_AGENT_LAUNCHER_STORAGE_KEY,
      JSON.stringify({ version: 1, edge: 'start', y: 700 }),
    );
    const { button } = renderLauncher();

    await waitFor(() => {
      expect((button as HTMLElement).style.top).toBe('700px');
    });

    setViewport(390, 400);
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(button.style.top).toBe('332px');
    });
  });
});
