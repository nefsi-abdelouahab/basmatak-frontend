import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import toastEn from '../src/messages/toast/en.json';
import toastAr from '../src/messages/toast/ar.json';
import homeEn from '../src/messages/volunteer-home/en.json';

type Locale = 'en' | 'ar';

const sessionUser = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const me = {
  username: 'amineb',
  firstName: 'Amine',
  lastName: 'Benali',
  headline: 'Community helper',
  avatar: null,
  location: { wilayaId: '16', municipalityId: '1601' },
  publicProfile: { enabled: true, showAvatar: true },
};

const oppA = {
  id: '64f000000000000000000001',
  title: 'Food drive',
  registryId: '7',
  mode: 'onsite',
  durationMinutes: 180,
  organization: {
    id: 'o1',
    slug: 'helping-org',
    nameFr: 'Helping Org',
    nameAr: 'منظمة مساعدة',
    verificationStatus: 'verified',
  },
  isFavorited: false,
  favoriteCount: 4,
};

const oppB = {
  ...oppA,
  id: '64f000000000000000000002',
  title: 'Beach cleanup',
  registryId: '8',
  durationMinutes: 90,
  organization: {
    id: 'o2',
    slug: 'green-org',
    nameFr: 'Green Org',
    nameAr: 'منظمة خضراء',
    verificationStatus: 'pending',
  },
  isFavorited: true,
  favoriteCount: 1,
};

const notification = {
  _id: '64f0000000000000000000n1',
  type: 'application.accepted',
  isRead: false,
  createdAt: '2026-09-10T00:00:00.000Z',
};

function cursorPage(items: unknown[], total: number) {
  return { items, nextCursor: null, limit: 20, total, page: 1, pages: 1 };
}

type Handler =
  | { status: number; body?: unknown }
  | ((req: { url: URL; method: string }) => { status: number; body?: unknown });

async function mockApi(
  page: Page,
  handlers: Record<string, Handler>,
  options: { clipboard?: 'ok' | 'fail' } = {},
) {
  await page.addInitScript(
    ({ clipboard }) => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () =>
            clipboard === 'fail'
              ? Promise.reject(new Error('denied'))
              : Promise.resolve(),
        },
      });
    },
    { clipboard: options.clipboard ?? 'ok' },
  );

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '') || '/';
    const method = route.request().method();
    const key = Object.keys(handlers).find(
      (entry) =>
        path === entry || (entry.endsWith('*') && path.startsWith(entry.slice(0, -1))),
    );
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const handler = handlers[key];
    const { status, body } =
      typeof handler === 'function' ? handler({ url, method }) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function baseHandlers(): Record<string, Handler> {
  return {
    '/auth/me': { status: 200, body: sessionUser },
    '/volunteers/me': { status: 200, body: me },
    '/volunteers/me/skills': { status: 200, body: [] },
    '/opportunities/recommended': { status: 200, body: cursorPage([oppA], 1) },
    '/opportunities': { status: 200, body: cursorPage([oppA, oppB], 2) },
    '/skill-categories': { status: 200, body: [] },
    '/skills': { status: 200, body: [] },
    '/locations/wilayas': { status: 200, body: [] },
    '/favorites/lookup': ({ url }) => {
      const ids = (url.searchParams.get('targetIds') ?? '').split(',').filter(Boolean);
      const body: Record<string, { favorited: boolean; favoriteCount: number }> = {};
      for (const id of ids) {
        body[id] =
          id === oppB.id
            ? { favorited: true, favoriteCount: oppB.favoriteCount }
            : { favorited: false, favoriteCount: oppA.favoriteCount };
      }
      return { status: 200, body };
    },
    '/favorites/counts': { status: 200, body: { opportunities: 1, talents: 0 } },
    '/notifications/unread-count': { status: 200, body: { count: 1 } },
    '/notifications': { status: 200, body: cursorPage([notification], 1) },
    [`/notifications/${notification._id}/read`]: {
      status: 200,
      body: { ...notification, isRead: true },
    },
    '/notifications/read-all': { status: 200, body: { updated: 1 } },
    '/favorites/opportunities*': ({ method }) =>
      method === 'POST'
        ? { status: 201, body: { favorited: true, favoriteCount: 5 } }
        : { status: 204 },
  };
}

const viewport = { width: 1280, height: 800 };

async function expectHeaderOffset(toast: Locator) {
  // Sticky header is 4rem, plus the 0.5rem gap and no safe-area inset.
  await expect
    .poll(async () => {
      const box = await toast.boundingBox();
      return box ? Math.abs(box.y - 72) : 999;
    })
    .toBeLessThanOrEqual(2);
}

test.describe('global toasts', () => {
  test.use({ viewport });

  for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
    test(`success copy follows the locale (${locale})`, async ({ page }) => {
      await mockApi(page, baseHandlers());
      await page.goto(`/${locale}/volunteer/opportunities`);
      await page.getByTestId(`save-opp-${oppA.id}`).click();

      const copy = locale === 'ar' ? toastAr.success.favoriteAdded : toastEn.success.favoriteAdded;
      const toast = page.getByTestId('app-toast').filter({ hasText: copy });
      await expect(toast).toBeVisible();

      const toaster = page.locator('[data-sonner-toaster]');
      await expect(toaster).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(toast).not.toContainText(
        locale === 'ar' ? toastEn.success.favoriteAdded : toastAr.success.favoriteAdded,
      );
      await expect(toast.locator('[data-close-button]')).toHaveCount(0);

      await expectHeaderOffset(toast);
      const box = await toast.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(box!.width - 420)).toBeLessThanOrEqual(2);
    });
  }

  test('success fades after three seconds', async ({ page }) => {
    await mockApi(page, baseHandlers());
    await page.goto('/en/volunteer/opportunities');
    await page.getByTestId(`save-opp-${oppA.id}`).click();
    const toast = page
      .getByTestId('app-toast')
      .filter({ hasText: toastEn.success.favoriteAdded });
    await expect(toast).toBeVisible();

    await page.waitForTimeout(2_400);
    await expect(toast).toBeVisible();
    await expect(toast).toBeHidden({ timeout: 2_500 });
  });

  test('error stays for five seconds with a close button and assertive copy', async ({
    page,
  }) => {
    await mockApi(page, {
      ...baseHandlers(),
      '/favorites/opportunities*': {
        status: 500,
        body: { statusCode: 500, code: 'SERVER_ERROR', message: 'boom' },
      },
    });
    await page.goto('/en/volunteer/opportunities');
    await page.getByTestId(`save-opp-${oppA.id}`).click();

    const toast = page.getByTestId('app-toast').filter({ hasText: toastEn.error.server });
    await expect(toast).toBeVisible();
    await expect(toast.locator('[data-close-button]')).toBeVisible();
    await expect(page.getByTestId('toast-announcer')).toHaveText(toastEn.error.server);

    await page.waitForTimeout(3_400);
    await expect(toast).toBeVisible();
    await expect(toast).toBeHidden({ timeout: 3_000 });

    // Re-trigger and dismiss manually before the five-second timer.
    await page.getByTestId(`save-opp-${oppA.id}`).click();
    const again = page.getByTestId('app-toast').filter({ hasText: toastEn.error.server });
    await expect(again).toBeVisible();
    await again.locator('[data-close-button]').click();
    await expect(again).toBeHidden({ timeout: 1_500 });
  });

  test('keeps only three toasts visible when several fire together', async ({ page }) => {
    await mockApi(page, baseHandlers());
    await page.goto('/en/volunteer/opportunities');

    const saveA = page.getByTestId(`save-opp-${oppA.id}`);
    const saveB = page.getByTestId(`save-opp-${oppB.id}`);
    await expect(saveA).toHaveAttribute('aria-pressed', 'false');
    await expect(saveB).toHaveAttribute('aria-pressed', 'true');

    await saveA.click();
    await saveB.click();
    await page
      .getByTestId('opportunity-card')
      .filter({ hasText: oppA.title })
      .getByRole('button', { name: homeEn.opportunities.shareLabel })
      .click();
    await page.getByTestId('navbar-bell').click();
    await page.getByTestId(`navbar-notification-read-${notification._id}`).click();
    await page.getByTestId('navbar-notifications-read-all').click();

    await expect(page.locator('[data-sonner-toast]')).toHaveCount(5, { timeout: 5_000 });
    await expect(page.locator('[data-sonner-toast][data-visible="true"]')).toHaveCount(3);
  });

  test('copy link confirms with a toast and clears the chat launcher', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockApi(page, baseHandlers());
    await page.goto('/en/volunteer/opportunities');
    await page
      .getByTestId('opportunity-card')
      .filter({ hasText: oppA.title })
      .getByRole('button', { name: homeEn.opportunities.shareLabel })
      .click();

    const toast = page
      .getByTestId('app-toast')
      .filter({ hasText: toastEn.success.linkCopied });
    await expect(toast).toBeVisible();
    await expectHeaderOffset(toast);
    const box = await toast.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x - 12)).toBeLessThanOrEqual(2);
    expect(Math.abs(box!.width - 366)).toBeLessThanOrEqual(2);

    const launcher = await page.getByTestId('ai-agent-launcher').boundingBox();
    expect(launcher).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(launcher!.y);
  });

  test('copy failure uses the calm error toast', async ({ page }) => {
    await mockApi(page, baseHandlers(), { clipboard: 'fail' });
    await page.goto('/en/volunteer/opportunities');
    await page
      .getByTestId('opportunity-card')
      .filter({ hasText: oppA.title })
      .getByRole('button', { name: homeEn.opportunities.shareLabel })
      .click();

    const toast = page.getByTestId('app-toast').filter({ hasText: toastEn.error.copyFailed });
    await expect(toast).toBeVisible();
    await expect(toast.locator('[data-close-button]')).toBeVisible();
  });
});
