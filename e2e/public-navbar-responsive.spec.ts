import { expect, test, type Page, type Route } from '@playwright/test';

// PublicNavbar responsive contract (shared by landing, talents, public
// profiles, and the auth screens — single component, single fix).
// Matrix: 390 / 768 / 1024 / 1440 asserting
//   1. no page-level horizontal overflow (body scrollWidth <= clientWidth),
//   2. hamburger toggle visibility + open/close behaviour per breakpoint,
//   3. mobile-menu content matches desktop content (same links, same auth),
//   4. guest AND authenticated auth-state variants collapse correctly,
//   5. RTL mirrors (toggle at the logical end side) without overflow.

type Handler = { status: number; body?: unknown };
type Handlers = Record<string, Handler>;

const GUEST_ME: Handler = {
  status: 401,
  body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' },
};

const VOLUNTEER_ME: Handler = {
  status: 200,
  body: {
    id: '64f000000000000000000001',
    email: 'volunteer@example.org',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    role: 'volunteer',
    status: 'active',
  },
};

async function mockApi(page: Page, handlers: Handlers) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const key = Object.keys(handlers).find((k) => path.endsWith(k));
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    const { status, body } = handlers[key] as Handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

// Readiness gate: PublicNavbar fires GET /auth/me from client JS after
// hydration. Waiting for that response proves React listeners are attached,
// so the hamburger click below can never be lost to a pre-hydration race.
// Soft: a missed signal (slow dev compile) falls through to openMenu, which
// retries the click until the panel is actually open.
async function gotoReady(page: Page, url: string) {
  const meSettled = page
    .waitForResponse((r) => r.url().includes('/auth/me'), { timeout: 15000 })
    .catch(() => null);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await meSettled;
}

async function openMenu(page: Page) {
  const toggle = page.getByTestId('public-navbar-menu-toggle');
  const menu = page.getByTestId('public-navbar-mobile-menu');
  await expect(toggle).toBeVisible({ timeout: 15000 });
  await expect
    .poll(async () => {
      if ((await menu.count()) === 0) await toggle.click().catch(() => {});
      return menu.count();
    }, { timeout: 15000 })
    .toBe(1);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function desktopLinkHrefs(page: Page) {
  return page
    .getByTestId('public-navbar-links-desktop')
    .locator('a')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
}

async function mobileLinkHrefs(page: Page) {
  return page
    .getByTestId('public-navbar-mobile-menu')
    .getByTestId('public-navbar-links-mobile')
    .locator('a')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
}

const WIDTHS = [390, 768, 1024, 1440] as const;

for (const width of WIDTHS) {
  test.describe(`public navbar @ ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    const isMobileLayout = width < 1024;

    test(`guest: no overflow, correct chrome, toggle behaviour (en)`, async ({ page }) => {
      await mockApi(page, { '/auth/me': GUEST_ME });
      await gotoReady(page, '/en');
      await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('public-footer')).toBeVisible({ timeout: 15000 });

      // 1. No horizontal overflow.
      const over = await overflow(page);
      expect(over.body, `body overflow at ${width}px`).toBeLessThanOrEqual(1);
      expect(over.html, `html overflow at ${width}px`).toBeLessThanOrEqual(1);

      const toggle = page.getByTestId('public-navbar-menu-toggle');
      const desktopLinks = page.getByTestId('public-navbar-links-desktop');
      const desktopSearch = page.getByTestId('public-navbar-search-desktop');
      const mobileSearch = page.getByTestId('public-navbar-search-mobile');

      if (isMobileLayout) {
        // 2a. Hamburger pattern below lg.
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(desktopLinks).toBeHidden();
        await expect(desktopSearch).toBeHidden();
        await expect(mobileSearch).toBeVisible();

        // Search must not force horizontal scroll and must work.
        await mobileSearch.locator('input').fill('photo');
        await expect(mobileSearch.locator('input')).toHaveValue('photo');

        // 2b. Toggle opens the panel; X state + scroll lock engage.
        await openMenu(page);
        const menu = page.getByTestId('public-navbar-mobile-menu');
        const lock = await page.evaluate(() => ({
          body: document.body.style.overflow,
          html: document.documentElement.style.overflow,
        }));
        expect(lock.body).toBe('hidden');
        expect(lock.html).toBe('hidden');

        // 3. Mobile-menu content matches desktop content (same links…).
        expect(await mobileLinkHrefs(page)).toEqual(await desktopLinkHrefs(page));

        // …and same guest auth state.
        const mobileActions = menu.getByTestId('public-navbar-actions-mobile');
        await expect(mobileActions.locator('a[href$="/login"]')).toBeVisible();
        await expect(mobileActions.locator('a[href$="/create-account"]')).toBeVisible();
        await expect(menu.getByTestId('language-switcher')).toBeVisible();

        // No overflow with the panel open either.
        const openOver = await overflow(page);
        expect(openOver.body, `body overflow with menu open at ${width}px`).toBeLessThanOrEqual(1);

        await page.getByTestId('shell-navbar').screenshot({
          path: `test-results/public-navbar-${width}-menu-open.png`,
        });

        // 2c. Toggle again closes; Escape closes too.
        await toggle.click();
        await expect(menu).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(menu).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();

        await page.getByTestId('shell-navbar').screenshot({
          path: `test-results/public-navbar-${width}.png`,
        });
      } else {
        // Desktop/tablet-wide: full nav visible, hamburger gone, single row.
        await expect(toggle).toBeHidden();
        await expect(page.getByTestId('public-navbar-mobile-menu')).toBeHidden();
        await expect(desktopLinks).toBeVisible();
        await expect(desktopSearch).toBeVisible();
        await expect(mobileSearch).toBeHidden();
        await expect(page.getByTestId('public-navbar-actions-desktop')).toBeVisible();

        // Single-row bar: links must not wrap into a second row.
        const bar = await page.getByTestId('shell-navbar').boundingBox();
        expect(bar?.height, `navbar height at ${width}px`).toBeLessThanOrEqual(66);

        // All three desktop links on one visual line (no wrap/overlap).
        const boxes = await desktopLinks.locator('a').evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          }),
        );
        expect(boxes).toHaveLength(3);
        const tops = new Set(boxes.map((b) => Math.round(b.top)));
        expect(tops.size, `nav links share one row at ${width}px`).toBe(1);

        const over2 = await overflow(page);
        expect(over2.body).toBeLessThanOrEqual(1);

        await page.getByTestId('shell-navbar').screenshot({
          path: `test-results/public-navbar-${width}.png`,
        });
      }
    });

    test(`authenticated: dashboard action collapses into the menu (en)`, async ({ page }) => {
      await mockApi(page, { '/auth/me': VOLUNTEER_ME });
      await gotoReady(page, '/en');
      await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });

      const over = await overflow(page);
      expect(over.body).toBeLessThanOrEqual(1);

      if (isMobileLayout) {
        await openMenu(page);
        const menu = page.getByTestId('public-navbar-mobile-menu');
        // Same auth state as desktop: dashboard link, no sign-in links.
        await expect(menu.locator('a[href$="/volunteer/dashboard"]')).toBeVisible();
        await expect(menu.locator('a[href$="/login"]')).toBeHidden();
        expect(await mobileLinkHrefs(page)).toEqual(await desktopLinkHrefs(page));
        const openOver = await overflow(page);
        expect(openOver.body).toBeLessThanOrEqual(1);
      } else {
        await expect(
          page.getByTestId('public-navbar-actions-desktop').locator('a[href$="/volunteer/dashboard"]'),
        ).toBeVisible();
      }
    });
  });
}

test.describe('public navbar RTL + auth screens', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('ar: mirrors toggle side, no overflow, menu reachable', async ({ page }) => {
    await mockApi(page, { '/auth/me': GUEST_ME });
    await gotoReady(page, '/ar');
    await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const over = await overflow(page);
    expect(over.body).toBeLessThanOrEqual(1);

    // Hamburger sits at the logical end side: left of the logo in RTL.
    const toggleBox = await page.getByTestId('public-navbar-menu-toggle').boundingBox();
    const logoBox = await page.getByTestId('shell-navbar').locator('a[href$="/ar"]').first().boundingBox();
    expect(toggleBox && logoBox && toggleBox.x < logoBox.x, 'toggle mirrors to inline-end in RTL').toBe(true);

    await openMenu(page);
    const menu = page.getByTestId('public-navbar-mobile-menu');
    expect(await mobileLinkHrefs(page)).toEqual(await desktopLinkHrefs(page));
    const openOver = await overflow(page);
    expect(openOver.body).toBeLessThanOrEqual(1);

    await page.getByTestId('shell-navbar').screenshot({
      path: 'test-results/public-navbar-390-ar-menu-open.png',
    });
  });

  test('en control: toggle sits at inline-end in LTR', async ({ page }) => {
    await mockApi(page, { '/auth/me': GUEST_ME });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
    const toggleBox = await page.getByTestId('public-navbar-menu-toggle').boundingBox();
    const logoBox = await page.getByTestId('shell-navbar').locator('a[href="/en"]').first().boundingBox();
    expect(toggleBox && logoBox && toggleBox.x > logoBox.x, 'toggle at inline-end in LTR').toBe(true);
  });

  test('auth screen shares the responsive navbar (login @ 390)', async ({ page }) => {
    await mockApi(page, { '/auth/me': GUEST_ME });
    await gotoReady(page, '/en/login');
    await expect(page.getByTestId('shell-navbar')).toBeVisible({ timeout: 15000 });
    const over = await overflow(page);
    expect(over.body).toBeLessThanOrEqual(1);
    await openMenu(page);
    expect(await mobileLinkHrefs(page)).toEqual(await desktopLinkHrefs(page));
  });
});
