import { expect, test } from '@playwright/test';
import ar from '../src/messages/public-orgs/ar.json';
import en from '../src/messages/public-orgs/en.json';

const catalogs = { en, ar } as const;
const docs = ['terms', 'privacy', 'about'] as const;

for (const width of [1440, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const) {
      test(`footer legal links open modals without navigating (${locale})`, async ({ page }) => {
        await page.route('**/api/v1/**', (route) =>
          route.fulfill({ status: 404, body: '{}' }),
        );
        await page.goto(`/${locale}`);
        const catalog = catalogs[locale];
        for (const doc of docs) {
          await expect(page.getByTestId(`legal-modal-${doc}`)).toHaveCount(0);
          await page.getByTestId(`footer-${doc}-link`).click();
          const modal = page.getByTestId(`legal-modal-${doc}`);
          await expect(modal).toBeVisible();
          await expect(modal.getByRole('heading', { level: 2 })).toHaveText(
            (catalog.legal as Record<string, { title: string }>)[doc].title,
          );
          // No navigation happened: still on the landing route.
          await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
          // Background scroll locks while open.
          expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
          await modal.getByTestId(`legal-modal-${doc}-close`).click();
          await expect(modal).toHaveCount(0);
        }
      });

      test(`escape and outside click close the modal (${locale})`, async ({ page }) => {
        await page.route('**/api/v1/**', (route) =>
          route.fulfill({ status: 404, body: '{}' }),
        );
        await page.goto(`/${locale}`);
        await page.getByTestId('footer-terms-link').click();
        await expect(page.getByTestId('legal-modal-terms')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('legal-modal-terms')).toHaveCount(0);

        await page.getByTestId('footer-privacy-link').click();
        await expect(page.getByTestId('legal-modal-privacy')).toBeVisible();
        await page.mouse.click(8, 8);
        await expect(page.getByTestId('legal-modal-privacy')).toHaveCount(0);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      });
    }
  });
}
