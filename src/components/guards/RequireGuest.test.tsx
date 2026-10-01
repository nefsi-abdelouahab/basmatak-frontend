// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireGuest, guestRedirectTarget, isUnverifiedVerifyEmailVisit } from './RequireGuest';
import commonEn from '@/messages/common/en.json';

const replace = vi.fn();
let sessionState: {
  status: 'pending' | 'guest' | 'volunteer' | 'organization' | 'admin';
  emailVerifiedAt?: string | null;
} = {
  status: 'guest',
};
let mockPathname = '/talents';

vi.mock('@/hooks/useSession', () => ({
  useSessionQuery: () => {
    if (sessionState.status === 'pending') return { isPending: true, isError: false, data: undefined };
    if (sessionState.status === 'guest') return { isPending: false, isError: true, data: undefined };
    return {
      isPending: false,
      isError: false,
      data: { role: sessionState.status, emailVerifiedAt: sessionState.emailVerifiedAt ?? null },
    };
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => mockPathname,
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

  it('sends verify-email visits to the role home by default', () => {
    expect(guestRedirectTarget('/verify-email', 'volunteer')).toBe('/volunteer/dashboard');
    expect(guestRedirectTarget('/verify-email', 'organization')).toBe('/org/dashboard');
  });
});

describe('isUnverifiedVerifyEmailVisit', () => {
  it('holds the gate only for unverified sessions on verify-email', () => {
    expect(isUnverifiedVerifyEmailVisit('/verify-email', null)).toBe(true);
    expect(isUnverifiedVerifyEmailVisit('/verify-email', undefined)).toBe(true);
    expect(isUnverifiedVerifyEmailVisit('/verify-email/', null)).toBe(true);
    expect(isUnverifiedVerifyEmailVisit('/verify-email', '2026-01-01T00:00:00.000Z')).toBe(false);
    expect(isUnverifiedVerifyEmailVisit('/login', null)).toBe(false);
    expect(isUnverifiedVerifyEmailVisit('/reset-password', null)).toBe(false);
  });
});

describe('RequireGuest', () => {
  it('renders children for guests without redirecting', () => {
    sessionState = { status: 'guest' };
    mockPathname = '/talents';
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
    mockPathname = '/talents';
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
    mockPathname = '/talents';
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
    mockPathname = '/talents';
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

  it('redirects a verified session away from verify-email to the role home', () => {
    sessionState = { status: 'volunteer', emailVerifiedAt: '2026-01-01T00:00:00.000Z' };
    mockPathname = '/verify-email';
    replace.mockClear();
    const { container } = renderGuest(
      <RequireGuest>
        <p>guest content</p>
      </RequireGuest>,
    );
    expect(screen.queryByText('guest content')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/volunteer/dashboard');
    expect(container.textContent).toBe('');
  });

  it('holds verify-email for authenticated-but-unverified sessions', () => {
    sessionState = { status: 'organization', emailVerifiedAt: null };
    mockPathname = '/verify-email';
    replace.mockClear();
    renderGuest(
      <RequireGuest>
        <p>verify gate</p>
      </RequireGuest>,
    );
    expect(screen.getByText('verify gate')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders auth screens for guests without redirecting', () => {
    sessionState = { status: 'guest' };
    mockPathname = '/login';
    replace.mockClear();
    renderGuest(
      <RequireGuest>
        <p>login form</p>
      </RequireGuest>,
    );
    expect(screen.getByText('login form')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects an authenticated organization away from auth screens', () => {
    sessionState = { status: 'organization', emailVerifiedAt: '2026-01-01T00:00:00.000Z' };
    mockPathname = '/login';
    replace.mockClear();
    renderGuest(
      <RequireGuest>
        <p>login form</p>
      </RequireGuest>,
    );
    expect(screen.queryByText('login form')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/org/dashboard');
  });
});
