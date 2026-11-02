import { expect, test, type Page } from '@playwright/test';

// Font/theme gate: the body stack must name the designed face per locale,
// with the locale face ordered before the system fallbacks.
async function bodyFontFamily(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).fontFamily);
}

async function bodyLineHeight(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.body).lineHeight));
}

test('en body font names Inter first', async ({ page }) => {
  await page.goto('/en');
  const family = await bodyFontFamily(page);
  expect(family).toContain('Inter');
  expect(family).not.toContain('Tajawal');
  expect(family.split(',')[0]).toMatch(/Inter/);
});

test('ar body font names Tajawal first with the Arabic line-height', async ({ page }) => {
  await page.goto('/ar');
  const family = await bodyFontFamily(page);
  expect(family).toContain('Tajawal');
  expect(family.indexOf('Tajawal')).toBeLessThan(family.indexOf('system-ui'));
  expect(family.split(',')[0]).toMatch(/Tajawal/);

  const fontSize = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.body).fontSize),
  );
  expect(await bodyLineHeight(page)).toBeCloseTo(fontSize * 1.7, 1);
});

test('ar controls and code-like text use Tajawal', async ({ page }) => {
  await page.goto('/ar');
  const families = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('nav a, button, input, select, textarea, .font-mono'),
    )
      .slice(0, 40)
      .map((element) => getComputedStyle(element).fontFamily),
  );

  expect(families.length).toBeGreaterThan(0);
  for (const family of families) {
    expect(family).toContain('Tajawal');
  }
});
