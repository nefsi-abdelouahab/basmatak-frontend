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
  verificationStatus: 'verified',
  slug: 'org-a',
  nameFr: 'Org A',
  nameAr: 'منظمة أ',
  description: 'Community heritage work.',
  coverMediaId: null,
  logoMediaId: null,
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
    description: 'Twenty captioned field photos.',
    volunteer: { nameFr: 'Volunteer One', avatarMediaId: null },
    opportunity: { title: 'Cleanup day' },
    evidence: [],
    createdAt: '2026-09-10T00:00:00.000Z',
  },
];

const applications = [
  {
    _id: '64f0000000000000000000a1',
    status: 'pending',
    applicant: { nameFr: 'Applicant One', avatarMediaId: null },
    volunteer: null,
    opportunity: { title: 'Food drive' },
    position: { title: 'Driver' },
    createdAt: '2026-09-09T00:00:00.000Z',
  },
];

const participants = [
  {
    _id: '64f0000000000000000000p1',
    status: 'active',
    volunteer: { nameFr: 'Volunteer One' },
    opportunity: { id: '64f0000000000000000000o1', title: 'Cleanup day' },
    createdAt: '2026-09-08T00:00:00.000Z',
  },
];

const recentOpps = [
  {
    _id: '64f0000000000000000000o1',
    title: 'Cleanup day',
    status: 'published',
    startDate: '2026-09-25T00:00:00.000Z',
    location: { address: 'Rue 12' },
    positions: [{ title: 'Cleaner', requiredCount: 2 }],
    coverMediaId: null,
  },
  {
    _id: '64f0000000000000000000o2',
    title: 'Food drive',
    status: 'published',
    startDate: '2026-10-10T00:00:00.000Z',
    location: { address: 'Bab Ezzouar' },
    positions: [{ title: 'Driver', requiredCount: 3 }],
    coverMediaId: null,
  },
];

const activity = [
  {
    _id: 'e2',
    type: 'submission.submitted',
    title: 'Contribution submitted',
    ts: '2026-09-10T00:00:00.000Z',
    entity: { type: 'submission', id: 's1', name: 'Beach cleanup report', summary: 'Opportunity Cleanup day' },
  },
  {
    _id: 'e1',
    type: 'application.applied',
    title: 'Application submitted',
    ts: '2026-09-09T00:00:00.000Z',
    entity: { type: 'application', id: 'a1', name: 'Food drive', summary: 'Volunteer Applicant One' },
  },
];

interface Captured {
  url: string;
  method: string;
}

interface MockOptions {
  coverMediaId?: string | null;
  verificationStatus?: string;
  empty?: boolean;
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
  const coverMediaId = options?.coverMediaId ?? null;
  const verificationStatus = options?.verificationStatus ?? org.verificationStatus;
  const empty = options?.empty ?? false;
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
    if (path.endsWith('/organizations/me/opportunities')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(empty ? [] : recentOpps)),
      });
    }
    if (path.endsWith('/organizations/me/participants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(empty ? [] : participants)),
      });
    }
    if (path.endsWith('/organizations/me/submissions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(empty ? [] : submissions)),
      });
    }
    if (path.endsWith('/organizations/me/applications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(empty ? [] : applications)),
      });
    }
    if (path.endsWith('/organizations/me/activity')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(empty ? [] : activity)),
      });
    }
    if (path.endsWith('/notifications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope([])),
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
        body: JSON.stringify({ ...org, coverMediaId, verificationStatus }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  // Serve a real image file for mocked CDN URLs so <img> elements load instead
  // of erroring (public-talent.spec.ts uses a similar stub).
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
      test(`dashboard numbers match fixtures, no forbidden copy (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { coverMediaId: '64f0000000000000000000c1' });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-dashboard')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        // Hero: real org name, verified badge, public-profile link, no registry line.
        await expect(page.getByTestId('org-name')).toContainText(locale === 'ar' ? 'منظمة أ' : 'Org A');
        await expect(page.getByTestId('org-verified')).toHaveCount(1);
        await expect(page.getByTestId('org-public-profile')).toHaveAttribute(
          'href',
          expect.stringContaining('/orgs/org-a'),
        );
        // 5-stat row from real aggregates + inbox totals (180 minutes -> 3 hours).
        await expect(page.getByTestId('dashboard-stat-published')).toContainText('3');
        await expect(page.getByTestId('dashboard-stat-applications')).toContainText('1');
        await expect(page.getByTestId('dashboard-stat-participants')).toContainText('12');
        await expect(page.getByTestId('dashboard-stat-review')).toContainText('1');
        await expect(page.getByTestId('dashboard-stat-hours')).toContainText('3');
        // Quick actions point at real routes.
        await expect(page.getByTestId('action-view-opps')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/opportunities'),
        );
        await expect(page.getByTestId('action-review-apps')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/applications'),
        );
        await expect(page.getByTestId('action-create-opp')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/opportunities/new'),
        );
        // Lists render real rows with working review links.
        await expect(page.getByTestId('contribution-row')).toHaveCount(1);
        await expect(page.getByTestId('contribution-review-64f0000000000000000000s1')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/contributions/64f0000000000000000000s1'),
        );
        await expect(page.getByTestId('application-row')).toHaveCount(1);
        await expect(page.getByTestId('application-view-64f0000000000000000000a1')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/applications/64f0000000000000000000a1'),
        );
        await expect(page.getByTestId('volunteer-activity-row')).toHaveCount(1);
        await expect(page.getByTestId('recent-opp-row')).toHaveCount(2);
        await expect(page.getByTestId('recent-opp-manage-64f0000000000000000000o1')).toHaveAttribute(
          'href',
          expect.stringContaining('/org/opportunities/64f0000000000000000000o1'),
        );
        await expect(page.getByTestId('activity-item')).toHaveCount(2);
        // Forbidden copy is gone entirely, never rephrased.
        const body = (await page.getByTestId('org-dashboard').textContent()) ?? '';
        expect(body).not.toMatch(/minted|minting|registry|12-06|sovereign|civic audit|accreditation|charter|DZ-ALG|DZ-TIM/i);
        expect(body).not.toMatch(/Approve|Reject|Verify submission/i);
        // Org navbar carries no public browse links; the sidebar does.
        const navbar = (await page.getByTestId('shell-navbar').textContent()) ?? '';
        expect(navbar).not.toMatch(/Discover Talents|اكتشاف المواهب/);
        const statsCalls = captured.filter((c) => c.url.includes('/organizations/me/stats'));
        expect(statsCalls.length).toBeGreaterThan(0);
      });

      test(`empty inboxes render i18n empty states (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { empty: true });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-dashboard')).toBeVisible();
        await expect(page.getByTestId('dashboard-stat-review')).toContainText('0');
        await expect(page.getByTestId('dashboard-stat-applications')).toContainText('0');
        await expect(page.getByTestId('contribution-row')).toHaveCount(0);
        await expect(page.getByTestId('application-row')).toHaveCount(0);
        await expect(page.getByTestId('recent-opp-row')).toHaveCount(0);
        const body = (await page.getByTestId('org-dashboard').textContent()) ?? '';
        expect(body).toContain(catalogs[locale].contributions.empty);
        expect(body).toContain(catalogs[locale].applications.empty);
        expect(body).toContain(catalogs[locale].recentOpps.empty);
        expect(body).toContain(catalogs[locale].activity.empty);
      });

      test(`unverified org shows no verified badge (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { verificationStatus: 'pending' });
        await page.goto(`/${locale}/org/dashboard`);
        await expect(page.getByTestId('org-dashboard')).toBeVisible();
        await expect(page.getByTestId('org-verified')).toHaveCount(0);
      });
    }
  });
}
