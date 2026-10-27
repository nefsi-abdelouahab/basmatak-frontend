// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import aiAgentEn from '@/messages/ai-agent/en.json';
import type { AiAgentSourcesEvent } from '@/lib/api/aiAgent';
import { SourceChips } from './SourceChips';

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

function renderSources(sources: AiAgentSourcesEvent) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ aiAgent: aiAgentEn }}>
      <SourceChips sources={sources} />
    </NextIntlClientProvider>,
  );
}

const sources: AiAgentSourcesEvent = {
  knowledge: [
    {
      id: 'k1',
      title: 'Volunteering guide',
      source: 'guide.md',
    },
  ],
  data: [
    {
      id: 'd1',
      citationId: 'T1',
      type: 'opportunity',
      title: 'Food drive',
      path: '/opportunities/food-drive',
    },
    {
      id: 'd2',
      citationId: 'T2',
      type: 'organization',
      title: 'All organizations',
      path: '/orgs',
    },
    {
      id: 'd3',
      citationId: 'T3',
      type: 'stats',
      title: 'Platform totals',
    },
  ],
};

describe('SourceChips', () => {
  afterEach(cleanup);

  it('renders knowledge and data labels with a localized list name', () => {
    renderSources(sources);
    expect(
      screen.getByRole('list', { name: aiAgentEn.sources.listLabel }),
    ).toBeDefined();
    expect(screen.getByText(aiAgentEn.sources.knowledge)).toBeDefined();
    expect(screen.getByText(aiAgentEn.sources.opportunity)).toBeDefined();
    expect(screen.getByText(aiAgentEn.sources.organization)).toBeDefined();
    expect(screen.getByText(aiAgentEn.sources.stats)).toBeDefined();
  });

  it('links only to safe internal public routes', () => {
    renderSources(sources);
    const link = screen.getByRole('link', { name: /Food drive/ });
    expect(link.getAttribute('href')).toBe('/opportunities/food-drive');
    expect(screen.getByText('Volunteering guide').closest('a')).toBeNull();
    expect(screen.getByText('Platform totals').closest('a')).toBeNull();
  });

  it('renders the known slug-less /orgs source as plain text', () => {
    renderSources(sources);
    const title = screen.getByText('All organizations');
    expect(title.closest('a')).toBeNull();
    expect(title.closest('li')).not.toBeNull();
  });

  it('renders nothing when both source groups are empty', () => {
    const { container } = renderSources({ knowledge: [], data: [] });
    expect(container.innerHTML).toBe('');
  });
});
