import { expect, test } from '@playwright/test';
import commonAr from '../src/messages/common/ar.json';
import commonEn from '../src/messages/common/en.json';
import systemAr from '../src/messages/system/ar.json';
import systemEn from '../src/messages/system/en.json';

const catalogs = {
  en: { common: commonEn, system: systemEn },
  ar: { common: commonAr, system: systemAr },
} as const;

type Locale = keyof typeof catalogs;

const states = [
  { state: 'not-found', testId: 'system-not-found', key: 'notFound' },
  { state: 'forbidden', testId: 'system-forbidden', key: 'forbidden' },
  { state: 'server-error', testId: 'system-server-error', key: 'serverError' },
  { state: 'maintenance', testId: 'system-maintenance', key: 'maintenance' },
  { state: 'network-error', testId: 'system-network-error', key: 'networkError' },
  { state: 'session-expired', testId: 'system-session-expired', key: 'sessionExpired' },
  { state: 'rate-limited', testId: 'system-rate-limited', key: 'rateLimited' },
] as const;

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test.describe(`locale ${locale}`, () => {
        for (const { state, testId, key } of states) {
          test(`${state} renders its screen`, async ({ page }) => {
            await page.goto(`/${locale}/system/${state}`);
            const screen = page.getByTestId(testId);
            await expect(screen).toBeVisible();
            await expect(screen.getByRole('heading', { level: 1 })).toHaveText(
              catalogs[locale].system[key].title,
            );
            await expect(page.locator('html')).toHaveAttribute(
              'dir',
              locale === 'ar' ? 'rtl' : 'ltr',
            );
            await expect(page.locator('html')).toHaveAttribute('lang', locale);
          });
        }

        test('unknown system state falls back to 404', async ({ page }) => {
          await page.goto(`/${locale}/system/bogus`);
          await expect(page.getByTestId('system-not-found')).toBeVisible();
        });

        test('unknown page falls back to 404', async ({ page }) => {
          await page.goto(`/${locale}/does-not-exist`);
          await expect(page.getByTestId('system-not-found')).toBeVisible();
        });
      });
    }

    test('403 variants resolve to distinct sub-states', async ({ page }) => {
      const variants = [
        { code: 'ACCOUNT_SUSPENDED', title: systemEn.suspended.title },
        { code: 'ACCOUNT_INACCESSIBLE', title: systemEn.inaccessible.title },
        { code: 'EMAIL_NOT_VERIFIED', title: systemEn.emailNotVerified.title },
        { code: 'FORBIDDEN', title: systemEn.forbidden.title },
      ];
      for (const { code, title } of variants) {
        await page.goto(`/en/system/forbidden?code=${code}`);
        const screen = page.getByTestId('system-forbidden');
        await expect(screen).toBeVisible();
        await expect(screen.getByRole('heading', { level: 1 })).toHaveText(title);
      }
    });

    test('session-expired links to sign-in', async ({ page }) => {
      await page.goto('/en/system/session-expired');
      const link = page.getByRole('link', { name: commonEn.actions.signIn });
      await expect(link).toHaveAttribute('href', '/en/login');
    });
  });
}
