import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => ({ href, children }),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  ROLE_HOME,
  VERIFY_EMAIL_PATH,
  isSafeNextPath,
  resolvePostLoginTarget,
} from './useAuth';

describe('guest-continue guard', () => {
  it('accepts same-origin relative paths', () => {
    expect(isSafeNextPath('/volunteer/dashboard')).toBe(true);
    expect(isSafeNextPath('/en/opportunities/abc')).toBe(true);
  });

  it('rejects absolute, protocol-relative, and non-string values', () => {
    expect(isSafeNextPath('https://evil.example/phish')).toBe(false);
    expect(isSafeNextPath('//evil.example/phish')).toBe(false);
    expect(isSafeNextPath('')).toBe(false);
    expect(isSafeNextPath(undefined)).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
  });
});

describe('post-login redirect targets', () => {
  it('resolves approved role-default landing paths', () => {
    expect(ROLE_HOME).toEqual({
      volunteer: '/volunteer/dashboard',
      organization: '/org/dashboard',
      admin: '/admin/dashboard',
    });
    expect(resolvePostLoginTarget('volunteer')).toBe('/volunteer/dashboard');
    expect(resolvePostLoginTarget('organization')).toBe('/org/dashboard');
    expect(resolvePostLoginTarget('admin')).toBe('/admin/dashboard');
  });

  it('prefers a safe next destination over the role default', () => {
    expect(resolvePostLoginTarget('volunteer', '/opportunities/abc')).toBe(
      '/opportunities/abc',
    );
  });

  it('ignores unsafe next destinations', () => {
    expect(resolvePostLoginTarget('volunteer', 'https://evil.example')).toBe(
      '/volunteer/dashboard',
    );
    expect(resolvePostLoginTarget('admin', '//evil.example')).toBe('/admin/dashboard');
  });

  it('exposes the verify-email gate path', () => {
    expect(VERIFY_EMAIL_PATH).toBe('/verify-email');
  });
});
