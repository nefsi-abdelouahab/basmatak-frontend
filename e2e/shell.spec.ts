import { expect, test } from '@playwright/test';
// Landing owns the locale home route and renders inside the PUBLIC layout
// (top navbar + footer, no sidebar / bottom nav). The authenticated 3-column
// shell only wraps volunteer/org/admin screens.
import publicOrgsAr from '../src/messages/public-orgs/ar.json';
import publicOrgsEn from '../src/messages/public-orgs/en.json';

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('en home renders public layout and content', async ({ page }) => {
      await page.goto('/en');
      await expect(page.getByTestId('shell-navbar')).toBeVisible();
      await expect(page.getByTestId('shell-main')).toBeVisible();
      await expect(page.getByTestId('public-footer')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      await expect(page.locator('aside')).toHaveCount(0);
      await expect(page.getByTestId('shell-sidebar')).toHaveCount(0);
      await expect(page.getByTestId('shell-bottomnav')).toHaveCount(0);
      await expect(page.getByTestId('home').getByRole('heading', { level: 1 })).toHaveText(
        publicOrgsEn.landing.title,
      );
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });

    test('ar home renders mirrored public layout and content', async ({ page }) => {
      await page.goto('/ar');
      await expect(page.getByTestId('shell-navbar')).toBeVisible();
      await expect(page.getByTestId('public-footer')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      await expect(page.locator('aside')).toHaveCount(0);
      await expect(page.getByTestId('shell-sidebar')).toHaveCount(0);
      await expect(page.getByTestId('shell-bottomnav')).toHaveCount(0);
      await expect(page.getByTestId('home').getByRole('heading', { level: 1 })).toHaveText(
        publicOrgsAr.landing.title,
      );
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    });

    test('locale switch en->ar mirrors layout', async ({ page }) => {
      await page.goto('/en');
      await page.getByTestId('language-switcher').getByRole('link').click();
      await expect(page).toHaveURL(/\/ar(\/|$)/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('home').getByRole('heading', { level: 1 })).toHaveText(
        publicOrgsAr.landing.title,
      );
    });
  });
}
