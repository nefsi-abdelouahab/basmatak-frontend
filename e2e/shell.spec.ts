import { expect, test } from '@playwright/test';
// F18 landing owns the locale home route (replaces the F0 placeholder Card):
// shell chrome assertions stay, demo-heading assertions pin the landing title.
import publicOrgsAr from '../src/messages/public-orgs/ar.json';
import publicOrgsEn from '../src/messages/public-orgs/en.json';

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('en home renders shell and content', async ({ page }) => {
      await page.goto('/en');
      await expect(page.getByTestId('shell-navbar')).toBeVisible();
      await expect(page.getByTestId('shell-main')).toBeVisible();
      await expect(page.getByTestId('home').getByRole('heading', { level: 1 })).toHaveText(
        publicOrgsEn.landing.title,
      );
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });

    test('ar home renders mirrored shell and content', async ({ page }) => {
      await page.goto('/ar');
      await expect(page.getByTestId('home').getByRole('heading', { level: 1 })).toHaveText(
        publicOrgsAr.landing.title,
      );
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    });

    if (width >= 1024) {
      test('sidebar visible, bottom nav hidden on desktop/tablet', async ({ page }) => {
        await page.goto('/en');
        await expect(page.getByTestId('shell-sidebar')).toBeVisible();
        await expect(page.getByTestId('shell-bottomnav')).toBeHidden();
      });
    } else {
      test('bottom nav visible, sidebar hidden on mobile', async ({ page }) => {
        await page.goto('/en');
        await expect(page.getByTestId('shell-bottomnav')).toBeVisible();
        await expect(page.getByTestId('shell-sidebar')).toBeHidden();
      });
    }

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
