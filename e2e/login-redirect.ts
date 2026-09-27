import { expect, type Page } from '@playwright/test';

/**
 * Shared assertion for the guest authed-action redirect.
 *
 * Compares the exact pathname rather than a substring: a double-prefixed
 * `/en/en/login` contains `/en/login`, so `toContain` would pass while the route
 * does not exist. Every spec that asserts this invariant delegates here so the
 * expected path is derived once.
 *
 * `next` is the locale-less path (with optional query) the guest should return
 * to after authenticating. The locale-aware router adds the prefix, so a `next`
 * that already carried `/{locale}` would be double-prefixed on the way back.
 */
export async function expectLoginRedirect(
  page: Page,
  locale: string,
  next?: string,
): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, { message: 'guest login pathname' })
    .toBe(`/${locale}/login`);

  if (next === undefined) return;

  const actual = new URL(page.url()).searchParams.get('next');
  expect(actual, 'login redirect must carry a next parameter').not.toBeNull();
  const parsed = new URL(actual ?? '', 'http://127.0.0.1');
  // Path is locale-less so the post-login `router.push(next)` cannot re-prefix.
  expect(parsed.pathname, 'next must be locale-less').toBe(next.split('?')[0]);
  if (next.includes('?')) {
    const expected = new URL(next, 'http://127.0.0.1');
    expected.searchParams.forEach((value, key) => {
      expect(parsed.searchParams.get(key), `next param ${key}`).toBe(value);
    });
  }
}
