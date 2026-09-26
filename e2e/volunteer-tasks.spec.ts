import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-tasks/en.json';
import ar from '../src/messages/volunteer-tasks/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const user = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const appPending = {
  _id: '64f0000000000000000000a1',
  status: 'pending',
  message: 'I want to help',
  organization: { nameFr: 'Org A' },
  opportunity: { title: 'Cleanup day' },
  position: { title: 'Helper' },
  createdAt: '2026-09-01T00:00:00.000Z',
};

const appUnderReview = {
  _id: '64f0000000000000000000a2',
  status: 'under_review',
  message: 'Count me in',
  organization: { nameFr: 'Org B' },
  opportunity: { title: 'Food drive' },
  position: { title: 'Driver' },
  decisionActor: null,
  createdAt: '2026-09-05T00:00:00.000Z',
};

const appAccepted = {
  _id: '64f0000000000000000000a3',
  status: 'accepted',
  message: null,
  organization: { nameFr: 'Org A' },
  opportunity: { title: 'Cleanup day' },
  position: { title: 'Helper' },
  decisionActor: { nameFr: 'Org A' },
  createdAt: '2026-09-02T00:00:00.000Z',
};

const partAccepted = {
  _id: '64f0000000000000000000b1',
  status: 'accepted',
  organization: { nameFr: 'Org A' },
  opportunity: { title: 'Cleanup day', startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-02T00:00:00.000Z' },
  position: { title: 'Helper', deliverables: ['Collect bags', 'Sort waste'] },
  locationLabels: { nameFr: 'Alger' },
  experienceId: null,
  createdAt: '2026-09-02T00:00:00.000Z',
};

const partCompleted = {
  _id: '64f0000000000000000000b2',
  status: 'completed',
  organization: { nameFr: 'Org B' },
  opportunity: { title: 'Food drive' },
  position: { title: 'Driver', deliverables: ['Deliver boxes'] },
  locationLabels: { nameFr: 'Oran' },
  experienceId: '64f0000000000000000000e1',
  createdAt: '2026-08-01T00:00:00.000Z',
};

const activity = [
  { _id: 'e3', type: 'participation.completed', createdAt: '2026-09-10T00:00:00.000Z' },
  { _id: 'e2', type: 'application.accepted', createdAt: '2026-09-03T00:00:00.000Z' },
  { _id: 'e1', type: 'application.submitted', createdAt: '2026-09-01T00:00:00.000Z' },
];

interface Captured {
  url: string;
  method: string;
}

const pageEnvelope = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

async function mockApi(
  page: Page,
  captured: Captured[],
  overrides?: { participationsMeStatus?: number; authMeStatus?: number },
) {
  const withdrawnApps = new Set<string>();
  const withdrawnParts = new Set<string>();
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    const path = parsed.pathname;
    captured.push({ url, method: route.request().method() });

    if (path.endsWith('/experiences/64f0000000000000000000e1/attestation')) {
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="attestation-EXP-000123.pdf"',
          // XHR only exposes safelisted headers to axios; the real backend
          // exposes Content-Disposition via CORS for the same reason.
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-disposition',
        },
        body: Buffer.from('%PDF-1.4 fake-attestation'),
      });
    }
    if (path.endsWith('/auth/me')) {
      if (overrides?.authMeStatus && overrides.authMeStatus !== 200) {
        return route.fulfill({ status: overrides.authMeStatus, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    }
    if (path.endsWith('/volunteers/me/activity')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(activity)),
      });
    }
    if (path.endsWith('/applications/me')) {
      const status = parsed.searchParams.get('status');
      const from = parsed.searchParams.get('from');
      const to = parsed.searchParams.get('to');
      let rows = [appPending, appUnderReview, appAccepted].map((row) =>
        withdrawnApps.has(row._id) ? { ...row, status: 'withdrawn' } : row,
      );
      if (status) rows = rows.filter((row) => row.status === status);
      if (from) rows = rows.filter((row) => row.createdAt >= from);
      if (to) rows = rows.filter((row) => row.createdAt <= `${to}T23:59:59.999Z`);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(rows)),
      });
    }
    const appDetail = path.match(/\/applications\/([a-f0-9]{24})$/);
    if (appDetail) {
      const row = [appPending, appUnderReview, appAccepted].find((r) => r._id === appDetail[1]);
      if (!row) return route.fulfill({ status: 404, body: '{}' });
      const body = withdrawnApps.has(row._id) ? { ...row, status: 'withdrawn' } : row;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (/\/applications\/[a-f0-9]{24}\/withdraw$/.test(path)) {
      const id = path.split('/').at(-2) as string;
      withdrawnApps.add(id);
      const row = [appPending, appUnderReview, appAccepted].find((r) => r._id === id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...(row ?? appAccepted), status: 'withdrawn' }),
      });
    }
    if (path.endsWith('/participations/me')) {
      if (overrides?.participationsMeStatus && overrides.participationsMeStatus !== 200) {
        return route.fulfill({ status: overrides.participationsMeStatus, body: '{}' });
      }
      const status = parsed.searchParams.get('status');
      let rows = [partAccepted, partCompleted].map((row) =>
        withdrawnParts.has(row._id) ? { ...row, status: 'withdrawn' } : row,
      );
      if (status) rows = rows.filter((row) => row.status === status);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(rows)),
      });
    }
    const partDetail = path.match(/\/participations\/([a-f0-9]{24})$/);
    if (partDetail) {
      const row = [partAccepted, partCompleted].find((r) => r._id === partDetail[1]);
      if (!row) return route.fulfill({ status: 404, body: '{}' });
      const body = withdrawnParts.has(row._id) ? { ...row, status: 'withdrawn' } : row;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (/\/participations\/[a-f0-9]{24}\/withdraw$/.test(path)) {
      const id = path.split('/').at(-2) as string;
      withdrawnParts.add(id);
      const row = [partAccepted, partCompleted].find((r) => r._id === id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...(row ?? partAccepted), status: 'withdrawn' }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`applications list has under_review tab, count, short ID, RTL (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/applications`);
        await expect(page.getByTestId('volunteer-applications')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-applications').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].applications.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('tab-under_review')).toContainText(
          catalogs[locale].tabs.under_review,
        );
        await expect(page.getByTestId('applications-count')).toContainText('1');
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        await expect(page.getByText(catalogs[locale].applications.idLabel)).toBeVisible();
        await expect(page.getByTestId('activity-strip')).toBeVisible();
        await expect(page.getByTestId('activity-item')).toHaveCount(3);
      });

      test(`under_review tab + date filter hit the real query params (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/applications`);
        await page.getByTestId('tab-under_review').click();
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        await page.getByTestId('date-from').fill('2026-09-04');
        await page.getByTestId('date-to').fill('2026-09-06');
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        const listCalls = captured.filter((c) => c.url.includes('/applications/me'));
        expect(listCalls.length).toBeGreaterThan(0);
        expect(listCalls.some((c) => c.url.includes('status=under_review'))).toBe(true);
        expect(listCalls.some((c) => c.url.includes('from=2026-09-04'))).toBe(true);
        expect(listCalls.some((c) => c.url.includes('to=2026-09-06'))).toBe(true);
      });

      test(`withdraw accepted re-reads withdrawn and frees the seat (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/applications`);
        await page.getByTestId('tab-accepted').click();
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        await page.getByTestId('expand-64f0000000000000000000a3').click();
        await expect(page.getByTestId('application-timeline')).toBeVisible();
        await expect(page.getByTestId('view-task-link')).toBeVisible();
        await page.getByTestId('withdraw-button').click();
        await expect(page.getByTestId('withdraw-confirm')).toBeVisible();
        await page.getByTestId('withdraw-confirm-confirm').click();
        await expect(page.getByTestId('withdraw-success')).toContainText(
          catalogs[locale].applications.withdrawn,
        );
        // Withdrawn item is re-read on the withdrawn tab (seat freed).
        await expect(page.getByTestId('tab-withdrawn')).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        expect(
          captured.some((c) => c.url.endsWith('/applications/64f0000000000000000000a3/withdraw')),
        ).toBe(true);
      });

      test(`tasks list has no date filter, detail joins + attestation download (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/tasks`);
        await expect(page.getByTestId('volunteer-tasks')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-tasks').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].participations.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('date-from')).toHaveCount(0);
        await expect(page.getByTestId('participations-count')).toContainText('1');
        await page.getByTestId('tab-completed').click();
        await expect(page.getByTestId('participation-row')).toHaveCount(1);
        await page.getByTestId('expand-task-64f0000000000000000000b2').click();
        await expect(page.getByTestId('deliverable-item')).toHaveCount(1);
        await expect(page.getByTestId('submit-link')).toHaveAttribute(
          'href',
          `/${locale}/volunteer/tasks/64f0000000000000000000b2/submit`,
        );
        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('attestation-download').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('attestation-EXP-000123.pdf');
        await expect(page.getByTestId('attestation-success')).toBeVisible();
        // Task without experience renders the neutral empty state instead.
        await page.getByTestId('tab-accepted').click();
        await page.getByTestId('expand-task-64f0000000000000000000b1').click();
        await expect(page.getByTestId('attestation-unavailable')).toBeVisible();
        await expect(page.getByTestId('attestation-download')).toHaveCount(0);
      });

      test(`leave flow confirms then re-reads withdrawn (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/tasks`);
        await page.getByTestId('expand-task-64f0000000000000000000b1').click();
        await page.getByTestId('leave-button').click();
        await expect(page.getByTestId('leave-confirm')).toBeVisible();
        await page.getByTestId('leave-confirm-confirm').click();
        await expect(page.getByTestId('leave-success')).toContainText(
          catalogs[locale].participations.withdrawn,
        );
        // Left task is re-read on the withdrawn tab.
        await expect(page.getByTestId('tab-withdrawn')).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('participation-row')).toHaveCount(1);
        expect(
          captured.some((c) =>
            c.url.endsWith('/participations/64f0000000000000000000b1/withdraw'),
          ),
        ).toBe(true);
      });

      test(`deep links render detail directly (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/applications/64f0000000000000000000a2`);
        await expect(page.getByTestId('volunteer-application-detail')).toBeVisible();
        await expect(page.getByTestId('application-timeline-step-1')).toHaveAttribute(
          'data-state',
          'current',
        );
        await page.goto(`/${locale}/volunteer/tasks/64f0000000000000000000b2`);
        await expect(page.getByTestId('volunteer-task-detail')).toBeVisible();
        await expect(page.getByTestId('participation-timeline-step-2')).toHaveAttribute(
          'data-state',
          'current',
        );
      });

      test(`empty and error states render (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/volunteer/applications`);
        await page.getByTestId('tab-rejected').click();
        await expect(page.getByText(catalogs[locale].applications.empty)).toBeVisible();
        await page.goto(`/${locale}/volunteer/tasks`);
        await expect(page.getByTestId('volunteer-tasks')).toBeVisible();
      });

      test(`tasks list error state renders (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { participationsMeStatus: 500 });
        await page.goto(`/${locale}/volunteer/tasks`);
        await expect(page.getByTestId('participations-error')).toBeVisible();
      });
    }

    test('no messaging or contact affordances (en)', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, captured);
      await page.goto('/en/volunteer/applications');
      await expect(page.getByTestId('volunteer-applications')).toBeVisible();
      await expect(page.getByText(/contact coordinator/i)).toHaveCount(0);
      await expect(page.getByText(/message coordinator/i)).toHaveCount(0);
      await page.goto('/en/volunteer/tasks');
      await expect(page.getByTestId('volunteer-tasks')).toBeVisible();
      await expect(page.getByText(/contact coordinator/i)).toHaveCount(0);
      await expect(page.getByText(/internal messaging/i)).toHaveCount(0);
    });

    test('guest applications visit redirects to login', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, captured, { authMeStatus: 401 });
      await page.goto('/en/volunteer/applications');
      await expect(page).toHaveURL(/\/en\/login\?next=/);
    });
  });
}
