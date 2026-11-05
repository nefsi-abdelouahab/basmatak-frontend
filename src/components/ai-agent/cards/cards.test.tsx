// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import aiAgentAr from '@/messages/ai-agent/ar.json';
import aiAgentEn from '@/messages/ai-agent/en.json';
import type {
  AiAgentOpportunityCard,
  AiAgentOrganizationCard,
  AiAgentStatsCard,
} from '@/lib/api/aiAgent';
import { OpportunityChatCard } from './OpportunityChatCard';
import { OrganizationChatCard } from './OrganizationChatCard';
import { StatsChatCard } from './StatsChatCard';

vi.mock('@/i18n/navigation', () => ({
  // next-intl's Link prepends the active locale to every internal href.
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={`/en${href}`} className={className}>
      {children}
    </a>
  ),
}));

const opportunity: AiAgentOpportunityCard = {
  kind: 'opportunity',
  slug: 'beach-cleanup',
  title: 'Beach cleanup',
  organizationName: { ar: 'الأرض الخضراء', fr: 'Green Earth' },
  wilayaName: { ar: 'الجزائر', fr: 'Algiers' },
  startDate: '2026-03-15T00:00:00.000Z',
  applicationDeadline: '2026-04-01T00:00:00.000Z',
  openPositions: 2,
  mode: 'remote',
  href: '/en/opportunities/beach-cleanup',
};

const organization: AiAgentOrganizationCard = {
  kind: 'organization',
  slug: 'green-earth',
  nameAr: 'الأرض الخضراء',
  nameFr: 'Green Earth',
  type: 'Association',
  wilayaName: { ar: 'الجزائر', fr: 'Algiers' },
  foundedYear: 2015,
  href: '/en/orgs/green-earth',
};

const stats: AiAgentStatsCard = {
  kind: 'stats',
  publishedOpportunities: 11,
  verifiedOrganizations: 4,
  activeSkills: 9,
  wilayas: 58,
  municipalities: 1541,
};

function renderCard(
  node: ReactNode,
  locale: 'en' | 'ar' = 'en',
): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ aiAgent: locale === 'ar' ? aiAgentAr : aiAgentEn }}
    >
      {node}
    </NextIntlClientProvider>,
  );
}

describe('chat cards', () => {
  afterEach(cleanup);

  it('renders an opportunity summary and a locale-safe detail link', () => {
    renderCard(<OpportunityChatCard card={opportunity} />);

    expect(screen.getByText('Beach cleanup')).toBeDefined();
    expect(screen.getByText('Green Earth')).toBeDefined();
    expect(screen.getByText('Algiers')).toBeDefined();
    expect(screen.getByText('Remote')).toBeDefined();
    expect(screen.getByText(/Starts/)).toBeDefined();
    expect(screen.getByText(/Apply by/)).toBeDefined();
    expect(screen.getByText('2 open positions')).toBeDefined();

    const link = screen.getByRole('link', { name: /View opportunity/ });
    expect(link.getAttribute('href')).toBe(
      '/en/opportunities/beach-cleanup',
    );
  });

  it('uses Arabic entity names when the UI is Arabic', () => {
    renderCard(<OpportunityChatCard card={opportunity} />, 'ar');

    expect(screen.getByText('الأرض الخضراء')).toBeDefined();
    expect(screen.getByText('الجزائر')).toBeDefined();
    expect(screen.getByText('عن بُعد')).toBeDefined();
  });

  it('renders an organization summary with its type and founding year', () => {
    renderCard(<OrganizationChatCard card={organization} />);

    expect(screen.getByText('Green Earth')).toBeDefined();
    expect(screen.getByText('Association')).toBeDefined();
    expect(screen.getByText('Algiers')).toBeDefined();
    expect(screen.getByText('Founded 2015')).toBeDefined();

    const link = screen.getByRole('link', { name: /View organization/ });
    expect(link.getAttribute('href')).toBe('/en/orgs/green-earth');
  });

  it('falls back to the Arabic organization name in English', () => {
    renderCard(
      <OrganizationChatCard
        card={{ ...organization, nameFr: undefined }}
      />,
    );

    expect(screen.getByText('الأرض الخضراء')).toBeDefined();
  });

  it('does not render a link for an unsafe card href', () => {
    renderCard(
      <OrganizationChatCard
        card={{ ...organization, href: 'javascript:alert(1)' }}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the five public platform counts', () => {
    renderCard(<StatsChatCard card={stats} />);

    expect(screen.getByText(aiAgentEn.cards.stats)).toBeDefined();
    for (const key of [
      'publishedOpportunities',
      'verifiedOrganizations',
      'activeSkills',
      'wilayas',
      'municipalities',
    ] as const) {
      expect(
        screen.getByText(aiAgentEn.cards[key]),
      ).toBeDefined();
    }
    expect(screen.getByText('11')).toBeDefined();
    expect(screen.getByText(String(stats.municipalities.toLocaleString()))).toBeDefined();
  });
});
