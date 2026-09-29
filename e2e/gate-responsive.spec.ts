import { expect, test } from '@playwright/test';

// F19 gate check (4) — responsive matrix.
// Every route renders the shell chrome at 1440/1100/390 with no page-level
// horizontal overflow. Backend reads are stubbed to 404 so the matrix proves
// layout resilience (loading/error/redirect states), not fixture content:
// per-screen content assertions live in the owning F-series specs.
// src/gate/route-coverage.test.ts pins this list against src/app page routes.

const ID = '64f000000000000000000001';

const ROUTES = [
  '/',
  '/login',
  '/create-account',
  '/create-account?type=organization',
  '/forgot-password',
  '/reset-password?token=probe',
  '/verify-email?token=probe',
  '/opportunities/test-opportunity',
  '/orgs/test-org',
  '/talents',
  '/volunteers/testuser',
  '/admin/dashboard',
  '/admin/opportunities',
  '/admin/organizations',
  '/admin/reports',
  '/admin/settings',
  '/admin/verifications',
  '/admin/volunteers',
  '/org/applications',
  `/org/applications/${ID}`,
  '/org/complete-profile',
  '/org/contributions',
  `/org/contributions/${ID}`,
  '/org/dashboard',
  '/org/experiences',
  '/org/opportunities',
  `/org/opportunities/${ID}`,
  '/org/opportunities/new',
  '/org/participants',
  `/org/participants/${ID}`,
  '/org/profile',
  '/org/settings',
  '/org/verification-dossier',
  '/system/not-found',
  '/volunteer/applications',
  `/volunteer/applications/${ID}`,
  '/volunteer/dashboard',
  '/volunteer/experiences',
  '/volunteer/opportunities',
  '/volunteer/opportunities/test-opportunity',
  '/volunteer/portfolio',
  '/volunteer/profile',
  '/volunteer/settings',
  '/volunteer/talents',
  '/volunteer/tasks',
  `/volunteer/tasks/${ID}`,
  `/volunteer/tasks/${ID}/submit`,
  '/does-not-exist-f19',
];

const AR_SPOT = ['/', '/login', '/volunteer/dashboard', '/org/dashboard', '/admin/dashboard', '/volunteers/testuser'];

// Auth screens are full-screen standalone (no navbar/footer): only the main
// landmark is asserted, plus zero page-level scroll in either axis.
function isAuthRoute(route: string): boolean {
  const path = route.split('?')[0];
  return (
    path === '/login' ||
    path === '/create-account' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/verify-email'
  );
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.setTimeout(120000);

    for (const route of ROUTES) {
      test(`shell renders without page-level overflow: ${route} (en)`, async ({ page }) => {
        await page.route('**/api/v1/**', async (routeHandler) =>
          routeHandler.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
        );
        await page.goto(`/en${route}`, { waitUntil: 'domcontentloaded' });
        if (isAuthRoute(route)) {
          await expect(page.getByTestId('shell-navbar')).toHaveCount(0);
        } else {
          await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
        }
        await expect(page.getByTestId('shell-main')).toBeVisible({ timeout: 15000 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
        if (isAuthRoute(route)) {
          const vertical = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight,
          );
          expect(vertical).toBeLessThanOrEqual(1);
        }
      });
    }

    test('representative routes mirror RTL without overflow (ar)', async ({ page }) => {
      await page.route('**/api/v1/**', async (route) =>
        route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
      );
      const failures: string[] = [];
      for (const route of AR_SPOT) {
        await page.goto(`/ar${route}`);
        try {
          await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
          await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          if (overflow > 1) failures.push(`${route}: horizontal overflow ${overflow}px`);
        } catch {
          failures.push(`${route}: shell chrome not visible or dir != rtl`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
}
