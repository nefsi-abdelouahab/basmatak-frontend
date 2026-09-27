import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-home/en.json';
import systemEn from '../src/messages/system/en.json';
import { expectLoginRedirect } from './login-redirect';

// F19 gate check (5) — state matrix, rendered half (the mapping half lives in
// src/gate/state-matrix.test.ts).
// Representative screens prove loading/empty/error + 401/403-variants/
// 404/429/503. Full locale × viewport content matrices live in the owning
// F-series specs; this gate pins the states exist and resolve correctly.

const sessionUser = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

function cursorPage(items: unknown[], total: number) {
  return { items, nextCursor: null, limit: 20, total, page: 1, pages: 1 };
}

async function mockApi(page: Page, handlers: Record<string, { status: number; body?: unknown; delayMs?: number }>) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const key = Object.keys(handlers).find((k) => url.pathname.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const { status, body, delayMs } = handlers[key]!;
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function authedBase(overrides: Record<string, { status: number; body?: unknown; delayMs?: number }> = {}) {
  return {
    '/auth/me': { status: 200, body: sessionUser },
    '/volunteers/me': { status: 200, body: { username: 'amineb' } },
    '/skill-categories': { status: 200, body: [] },
    '/skills': { status: 200, body: [] },
    '/locations/wilayas': { status: 200, body: [] },
    '/favorites/lookup': { status: 200, body: {} },
    '/favorites/counts': { status: 200, body: {} },
    ...overrides,
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('loading state renders while the feed is in flight', async ({ page }) => {
      await mockApi(
        page,
        authedBase({
          '/volunteers/me/dashboard': { status: 200, body: { completionPercent: 10 } },
          '/opportunities/recommended': { status: 200, body: cursorPage([], 0), delayMs: 800 },
          '/opportunities': { status: 200, body: cursorPage([], 0), delayMs: 800 },
          '/talents': { status: 200, body: cursorPage([], 0) },
        }),
      );
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('volunteer-opportunities')).toBeVisible();
      await expect(page.getByRole('status').first()).toBeVisible();
    });

    test('empty feed renders the empty state with a recovery action', async ({ page }) => {
      await mockApi(
        page,
        authedBase({
          '/volunteers/me/dashboard': { status: 200, body: { completionPercent: 10 } },
          '/opportunities/recommended': { status: 200, body: cursorPage([], 0) },
          '/opportunities': { status: 200, body: cursorPage([], 0) },
          '/talents': { status: 200, body: cursorPage([], 0) },
        }),
      );
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('feed-count')).toContainText('0');
      await expect(page.getByText(en.opportunities.emptyTitle)).toBeVisible();
    });

    test('failed feed renders the error state', async ({ page }) => {
      await mockApi(
        page,
        authedBase({
          '/volunteers/me/dashboard': { status: 200, body: { completionPercent: 10 } },
          '/opportunities/recommended': { status: 500 },
          '/opportunities': { status: 500 },
        }),
      );
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('opportunities-error')).toBeVisible();
    });

    test('guest (401) on an authed screen redirects to login with next', async ({ page }) => {
      await mockApi(page, {
        '/auth/me': { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'expired' } },
      });
      await page.goto('/en/volunteer/dashboard');
      await expectLoginRedirect(page, 'en', '/volunteer/dashboard');
    });

    test('404 screens render for the state route and unknown paths', async ({ page }) => {
      await page.goto('/en/system/not-found');
      await expect(page.getByTestId('system-not-found')).toBeVisible();
      await page.goto('/en/does-not-exist-f19');
      await expect(page.getByTestId('system-not-found')).toBeVisible();
    });

    test('403 variants resolve to distinct sub-states', async ({ page }) => {
      const variants = [
        { code: 'FORBIDDEN', title: systemEn.forbidden.title },
        { code: 'ACCOUNT_SUSPENDED', title: systemEn.suspended.title },
        { code: 'ACCOUNT_INACCESSIBLE', title: systemEn.inaccessible.title },
        { code: 'EMAIL_NOT_VERIFIED', title: systemEn.emailNotVerified.title },
      ];
      for (const { code, title } of variants) {
        await page.goto(`/en/system/forbidden?code=${code}`);
        await expect(page.getByTestId('system-forbidden').getByRole('heading', { level: 1 })).toHaveText(title);
      }
    });

    test('429 and 503 states render their dedicated screens', async ({ page }) => {
      await page.goto('/en/system/rate-limited');
      await expect(page.getByTestId('system-rate-limited')).toBeVisible();
      await page.goto('/en/system/maintenance');
      await expect(page.getByTestId('system-maintenance')).toBeVisible();
      await page.goto('/en/system/session-expired');
      await expect(page.getByTestId('system-session-expired')).toBeVisible();
    });
  });
}
