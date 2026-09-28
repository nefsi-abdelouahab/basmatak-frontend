import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/org-workspace/en.json';
import ar from '../src/messages/org-workspace/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const user = {
  id: '64f000000000000000000001',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const org = {
  _id: '64f0000000000000000000aa',
  registryId: 'a1b2c3',
  verificationStatus: 'pending',
  nameFr: 'Org A',
  nameAr: 'منظمة أ',
  coverMediaId: null,
  location: { wilayaId: 'Alger', municipalityId: 'Bab Ezzouar', address: 'Rue 12' },
  foundedYear: 2018,
};

const stats = {
  opportunitiesActive: 3,
  opportunitiesCompleted: 7,
  applicationsPending: 4,
  applicationsUnderReview: 2,
  participantsActive: 12,
  participantsCompleted: 30,
  verifiedHours: 180,
  decisionsLast30d: 9,
};

const submissions = [
  {
    _id: '64f0000000000000000000s1',
    status: 'submitted',
    title: 'Beach cleanup report',
    volunteer: { nameFr: 'Volunteer One' },
    opportunity: { title: 'Cleanup day' },
    createdAt: '2026-09-10T00:00:00.000Z',
  },
];

const applications = [
  {
    _id: '64f0000000000000000000a1',
    status: 'pending',
    applicant: { nameFr: 'Applicant One' },
    opportunity: { title: 'Food drive' },
    createdAt: '2026-09-09T00:00:00.000Z',
  },
];

const participants = [
  {
    _id: '64f0000000000000000000p1',
    status: 'active',
    volunteer: { nameFr: 'Volunteer One' },
    opportunity: { title: 'Cleanup day' },
    createdAt: '2026-09-08T00:00:00.000Z',
  },
];

const activity = [
  { _id: 'e2', type: 'submission.received', createdAt: '2026-09-10T00:00:00.000Z' },
  { _id: 'e1', type: 'application.submitted', createdAt: '2026-09-09T00:00:00.000Z' },
];

const notifications = [
  { _id: 'n1', title: 'New application', isRead: false, createdAt: '2026-09-10T00:00:00.000Z' },
];

interface Captured {
  url: string;
  method: string;
}

interface MockOptions {
  gateLocked?: boolean;
  coverMediaId?: string | null;
  authMeStatus?: number;
}

const pageEnvelope = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 5,
  total: items.length,
  page: 1,
  pages: 1,
});

async function mockApi(page: Page, captured: Captured[], options?: MockOptions) {
  const gateLocked = options?.gateLocked ?? false;
  const coverMediaId = options?.coverMediaId ?? null;
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    const path = parsed.pathname;
    captured.push({ url, method: route.request().method() });

    if (path.endsWith('/auth/me')) {
      if (options?.authMeStatus && options.authMeStatus !== 200) {
        return route.fulfill({ status: options.authMeStatus, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    }
    if (path.endsWith('/organizations/me/stats')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) });
    }
    if (path.endsWith('/organizations/me/participants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(participants)),
      });
    }
    if (path.endsWith('/organizations/me/submissions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(submissions)),
      });
    }
    if (path.endsWith('/organizations/me/applications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(applications)),
      });
    }
    if (path.endsWith('/organizations/me/activity')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(activity)),
      });
    }
    if (path.endsWith('/organizations/me/publish-gate')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          gateLocked
            ? { locked: true, pendingCount: 2, threshold: 5, pendingOpportunities: [] }
            : { locked: false, pendingCount: 0, threshold: 5, pendingOpportunities: [] },
        ),
      });
    }
    if (path.endsWith('/notifications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(notifications)),
      });
    }
    const mediaMatch = path.match(/\/media\/([^/]+)$/);
    if (mediaMatch) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signedUrl: 'https://cdn.example/cover.jpg' }),
      });
    }
    if (path.endsWith('/organizations/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...org, coverMediaId }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  // Serve a real image file for mocked CDN URLs so <img> elements load instead
  // of erroring (public-talent.spec.ts uses a similar stub). Required now that
  // cover imgs fall back to /org.png on load failure.
  await page.route('**/cdn.example/**', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      path: 'public/user.jpg',
    }),
  );
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`dashboard numbers match fixtures, no lock banner (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { gateLocked: false });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-dashboard')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('org-code')).toContainText('ORG-a1b2c3');
        await expect(page.getByTestId('dashboard-stat-verifiedHours')).toContainText('180');
        await expect(page.getByTestId('dashboard-stat-applicationsPending')).toContainText('4');
        await expect(page.getByTestId('dashboard-stat-participantsActive')).toContainText('12');
        await expect(page.getByTestId('submissions-count')).toContainText('1');
        await expect(page.getByTestId('applications-count')).toContainText('1');
        await expect(page.getByTestId('participants-count')).toContainText('1');
        await expect(page.getByTestId('activity-item')).toHaveCount(2);
        await expect(page.getByTestId('notification-item')).toHaveCount(1);
        await expect(page.getByTestId('publish-gate-locked')).toHaveCount(0);
        const statsCalls = captured.filter((c) => c.url.includes('/organizations/me/stats'));
        expect(statsCalls.length).toBeGreaterThan(0);
      });

      test(`pending org sees publish-locked explanation (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { gateLocked: true });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('publish-gate-locked')).toBeVisible();
        await expect(page.getByTestId('publish-gate-locked')).toContainText(
          catalogs[locale].gate.lockedTitle,
        );
      });

      test(`neutral cover empty state without coverMediaId (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { coverMediaId: null });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-cover-empty')).toBeVisible();
        await expect(page.getByTestId('org-cover')).toHaveCount(0);
      });

      test(`real cover renders from coverMediaId (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { coverMediaId: '64f0000000000000000000c1' });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-cover')).toBeVisible();
        await expect(page.getByTestId('org-cover')).toHaveAttribute(
          'src',
          'https://cdn.example/cover.jpg',
        );
      });

      test(`summaries link to F11 queues with zero review actions (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { gateLocked: false });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('submissions-view-all')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/contributions'),
        );
        await expect(page.getByTestId('applications-view-all')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/applications'),
        );
        await expect(page.getByTestId('participants-view-all')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/participants'),
        );
        const body = (await page.getByTestId('org-dashboard').textContent()) ?? '';
        expect(body).not.toMatch(/Approve|Reject|Verify submission/i);
        await expect(page.getByTestId('submission-row')).toHaveCount(1);
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        await expect(page.getByTestId('participant-row')).toHaveCount(1);
      });
    }
  });
}
