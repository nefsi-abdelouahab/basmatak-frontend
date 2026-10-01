// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireGuest, guestRedirectTarget } from './RequireGuest';
import commonEn from '@/messages/common/en.json';

const replace = vi.fn();
let sessionState: { status: 'pending' | 'guest' | 'volunteer' | 'organization' | 'admin' } = {
  status: 'guest',
};

vi.mock('@/hooks/useSession', () => ({
  useSessionQuery: () => {
    if (sessionState.status === 'pending') return { isPending: true, isError: false, data: undefined };
    if (sessionState.status === 'guest') return { isPending: false, isError: true, data: undefined };
    return {
      isPending: false,
      isError: false,
      data: { role: sessionState.status },
    };
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/talents',
  useRouter: () => ({ replace, push: vi.fn() }),
}));

function renderGuest(children: ReactNode = <p>guest content</p>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ common: commonEn }}>
      {children}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('guestRedirectTarget', () => {  it('sends landing and auth screens to the role home', () => {
    expect(guestRedirectTarget('/', 'volunteer')).toBe('/volunteer/dashboard');
    expect(guestRedirectTarget('/', 'organization')).toBe('/org/dashboard');
    expect(guestRedirectTarget('/', 'admin')).toBe('/admin/dashboard');
    expect(guestRedirectTarget('/login', 'volunteer')).toBe('/volunteer/dashboard');
    expect(guestRedirectTarget('/create-account', 'organization')).toBe('/org/dashboard');
  });

  it('maps discovery lists to the role counterpart', () => {
    expect(guestRedirectTarget('/opportunities', 'volunteer')).toBe('/volunteer/opportunities');
    expect(guestRedirectTarget('/opportunities', 'organization')).toBe('/org/opportunities');
    expect(guestRedirectTarget('/opportunities', 'admin')).toBe('/admin/opportunities');
    expect(guestRedirectTarget('/talents', 'volunteer')).toBe('/volunteer/talents');
    expect(guestRedirectTarget('/talents', 'organization')).toBe('/org/dashboard');
    expect(guestRedirectTarget('/talents', 'admin')).toBe('/admin/dashboard');
  });
});

describe('RequireGuest', () => {
  it('renders children for guests without redirecting', () => {
    sessionState = { status: 'guest' };
    replace.mockClear();
    renderGuest(
      <RequireGuest>
        <p>guest content</p>
      </RequireGuest>,
    );
    expect(screen.getByText('guest content')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders a loader while the session resolves', () => {
    sessionState = { status: 'pending' };
    replace.mockClear();
    const { container } = renderGuest(
      <RequireGuest>
        <p>guest content</p>
      </RequireGuest>,
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(screen.queryByText('guest content')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects authenticated users without rendering children', () => {
    sessionState = { status: 'volunteer' };
    replace.mockClear();
    const { container } = renderGuest(
      <RequireGuest>
        <p>guest content</p>
      </RequireGuest>,
    );
    expect(screen.queryByText('guest content')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/volunteer/talents');
    expect(container.textContent).toBe('');
  });

  it('does not redirect a guest who signs in during the visit', () => {
    sessionState = { status: 'guest' };
    replace.mockClear();
    const view = renderGuest(
      <RequireGuest>
        <p>guest content</p>
      </RequireGuest>,
    );
    expect(screen.getByText('guest content')).toBeDefined();
    // Session transitions guest -> authenticated (login/register landing);
    // the flow's own navigation owns the next step, not the guard.
    sessionState = { status: 'volunteer' };
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ common: commonEn }}>
        <RequireGuest>
          <p>guest content</p>
        </RequireGuest>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('guest content')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
