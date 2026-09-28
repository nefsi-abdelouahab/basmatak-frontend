import { expect, test, type Page } from '@playwright/test';

// Font/theme gate: the body stack must name the designed face per locale,
// with the locale face ordered before the other script's fallback.
async function bodyFontFamily(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).fontFamily);
}

test('en body font names Inter first', async ({ page }) => {
  await page.goto('/en');
  const family = await bodyFontFamily(page);
  expect(family).toContain('Inter');
  expect(family.indexOf('Inter')).toBeLessThan(family.indexOf('Plex'));
  expect(family.split(',')[0]).toMatch(/Inter|Plex/);
});

test('ar body font names IBM Plex Sans Arabic first', async ({ page }) => {
  await page.goto('/ar');
  const family = await bodyFontFamily(page);
  expect(family).toContain('IBM Plex Sans Arabic');
  expect(family.indexOf('Plex')).toBeLessThan(family.indexOf('Inter'));
  expect(family.split(',')[0]).toMatch(/Inter|Plex/);
});
