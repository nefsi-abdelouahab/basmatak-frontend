// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Shell } from './Shell';
import commonEn from '@/messages/common/en.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));

describe('Shell', () => {
  it('renders navbar, sidebar, bottom nav, and children', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ common: commonEn }}>
        <Shell>
          <p>page content</p>
        </Shell>
      </NextIntlClientProvider>,
    );

    expect(container.querySelector('[data-testid="shell-navbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-sidebar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-bottomnav"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-main"]')).not.toBeNull();
    expect(screen.getByText('page content')).toBeDefined();
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getByAltText('Basmatak')).toBeDefined();
  });
});
