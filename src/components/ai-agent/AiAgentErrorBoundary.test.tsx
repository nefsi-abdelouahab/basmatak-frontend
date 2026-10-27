// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AiAgentErrorBoundary } from './AiAgentErrorBoundary';

function Broken(): JSX.Element {
  throw new Error('boom');
}

describe('AiAgentErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children while healthy', () => {
    render(
      <AiAgentErrorBoundary>
        <p>widget</p>
      </AiAgentErrorBoundary>,
    );
    expect(screen.getByText('widget')).toBeDefined();
  });

  it('renders the fallback instead of crashing the page', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    render(
      <AiAgentErrorBoundary fallback={<p>unavailable</p>}>
        <Broken />
      </AiAgentErrorBoundary>,
    );
    expect(screen.getByText('unavailable')).toBeDefined();
    consoleError.mockRestore();
  });

  it('renders nothing by default when the widget fails', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { container } = render(
      <AiAgentErrorBoundary>
        <Broken />
      </AiAgentErrorBoundary>,
    );
    expect(container.innerHTML).toBe('');
    consoleError.mockRestore();
  });
});
