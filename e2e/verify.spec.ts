import { expect, test, type Page, type Route } from '@playwright/test';

const GUEST = {
  status: 401,
  body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Guest' },
};

const SKILLS = [
  { id: 's1', skillId: 's1', nameFr: 'First aid', nameAr: 'إسعاف أولي' },
];

const PROOF = {
  registryId: 'EXP-000123',
  title: 'Park cleanup',
  description: 'Shoreline shift',
  skills: ['s1', '64f0000000000000000000ff'],
  duration: 180,
  organization: { id: 'o1', slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: 'جمعية الأمل' },
  verifiedAt: '2026-09-05T12:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  review: { rating: 5, notes: 'Reliable and punctual.' },
  volunteer: { handle: 'aliben', firstName: 'Ali' },
  evidence: [
    { mediaId: 'm1', type: 'link', url: 'https://example.org/proof' },
    { mediaId: 'm2', type: 'file', mimeType: 'image/jpeg', filename: 'photo.jpg', url: null },
  ],
};

async function mockApi(
  page: Page,
  verifyHandler: { status: number; body?: unknown },
) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: GUEST.status,
        contentType: 'application/json',
        body: JSON.stringify(GUEST.body),
      });
    }
    if (url.pathname.endsWith('/skills')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SKILLS),
      });
    }
    if (url.pathname.includes('/verify/')) {
      return route.fulfill({
        status: verifyHandler.status,
        contentType: 'application/json',
        body: JSON.stringify(verifyHandler.body ?? {}),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test.describe('public certificate verification', () => {
  test('entry form accepts a pasted URL and opens the canonical code route', async ({ page }) => {
    await mockApi(page, { status: 200, body: PROOF });
    await page.goto('/en/verify');

    const form = page.getByTestId('verify-entry');
    await expect(form).toBeVisible();
    await form.getByLabel('Verification code').fill('https://basmatak.test/ar/verify/abcdefgh');
    await form.getByRole('button', { name: 'Verify' }).click();

    await expect(page).toHaveURL(/\/en\/verify\/ABCDEFGH$/);
    await expect(page.getByTestId('verify-result')).toBeVisible();
  });

  test('valid code renders the public proof with localized links and hours', async ({ page }) => {
    await mockApi(page, { status: 200, body: PROOF });
    await page.goto('/en/verify/ABCDEFGH');

    const result = page.getByTestId('verify-result');
    await expect(result).toBeVisible();
    await expect(result.getByRole('heading', { level: 1 })).toHaveText('Park cleanup');
    await expect(page.getByTestId('verify-code')).toHaveText('ABCDEFGH');
    await expect(page.getByTestId('verify-org')).toHaveText('Association El-Amel');
    await expect(page.getByTestId('verify-org')).toHaveAttribute('href', '/en/orgs/el-amel');
    await expect(page.getByTestId('verify-volunteer')).toHaveText('Ali');
    await expect(page.getByTestId('verify-volunteer')).toHaveAttribute('href', '/en/volunteers/aliben');
    // 180 minutes -> 3 h, never the raw minute count.
    await expect(page.getByTestId('verify-duration')).toHaveText('3 h');
    await expect(page.getByTestId('verify-duration')).not.toContainText('180');
    await expect(page.getByTestId('verify-skills')).toContainText('First aid');
    await expect(page.getByTestId('verify-skills')).not.toContainText('64f0000000000000000000ff');
    await expect(page.getByTestId('verify-review')).toContainText('Reliable and punctual.');
    await expect(page.getByTestId('verify-evidence').getByRole('link')).toHaveAttribute(
      'href',
      'https://example.org/proof',
    );
    await expect(page.getByTestId('verify-evidence')).toContainText('photo.jpg');
  });

  test('Arabic proof localizes the organization and RTL shell', async ({ page }) => {
    await mockApi(page, { status: 200, body: PROOF });
    await page.goto('/ar/verify/ABCDEFGH');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('verify-org')).toHaveText('جمعية الأمل');
    await expect(page.getByTestId('verify-duration')).toContainText('3');
  });

  test('invalid or replaced code shows the not-found state', async ({ page }) => {
    await mockApi(page, {
      status: 404,
      body: { statusCode: 404, code: 'EXPERIENCE_NOT_FOUND', message: 'Experience not found' },
    });
    await page.goto('/en/verify/ZZZZZZZZ');

    await expect(page.getByTestId('verify-not-found')).toBeVisible();
    await expect(page.getByTestId('verify-not-found')).toContainText('Code not found');
    await expect(page.getByTestId('verify-result')).toHaveCount(0);
  });
});
