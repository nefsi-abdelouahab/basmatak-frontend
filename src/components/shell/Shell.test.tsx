// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Shell } from './Shell';
import commonEn from '@/messages/common/en.json';
import publicOrgsEn from '@/messages/public-orgs/en.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    locale?: string;
    scroll?: boolean;
  }) => (
    // `locale`/`scroll` are next-link router props: strip them so the plain
    // anchor mock does not leak non-boolean DOM attributes.
    <a
      href={href}
      {...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'locale' && k !== 'scroll'))}
    >
      {children}
    </a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe('Shell', () => {
  it('renders navbar, sidebar, bottom nav, and children', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <NextIntlClientProvider
        locale="en"
        messages={{
          common: commonEn,
          publicOrgs: publicOrgsEn as unknown as AbstractIntlMessages,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <Shell>
            <p>page content</p>
          </Shell>
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    expect(container.querySelector('[data-testid="shell-navbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-sidebar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-bottomnav"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-main"]')).not.toBeNull();
    expect(screen.getByText('page content')).toBeDefined();
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getByAltText('Basmatak')).toBeDefined();
    queryClient.clear();
  });
});
