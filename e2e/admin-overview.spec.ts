import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/admin-overview/en.json';
import ar from '../src/messages/admin-overview/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const adminUser = {
  id: '64f0000000000000000000ad',
  email: 'admin@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'admin',
  status: 'active',
};

const volunteerUser = {
  id: '64f0000000000000000000v1',
  email: 'vol@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const organizationUser = {
  id: '64f0000000000000000000o1',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const analyticsOverview = {
  totals: {
    users: { current: 12, previous: 8, deltaPercent: 50 },
    organizations: { current: 4, previous: 0, deltaPercent: null },
    opportunities: { current: 30, previous: 25, deltaPercent: 20 },
    applications: { current: 60, previous: 75, deltaPercent: -20 },
    submissions: { current: 5, previous: 5, deltaPercent: 0 },
  },
  activeParticipants: 42,
  perStatus: {
    users: { active: 90, suspended: 3 },
    organizations: { byStatus: { active: 10 }, byVerificationStatus: { pending: 4, verified: 6 } },
    opportunities: { published: 20, draft: 10 },
    applications: { pending: 30, accepted: 30 },
    submissions: { submitted: 2, under_review: 3 },
  },
  verificationReady: { total: 5, byOrganization: [{ organizationId: 'org1', count: 5 }] },
  gateFreezes: 1,
  medianDecisionHours: 18.5,
};

const queue = {
  pendingVerifications: 4,
  openReports: 2,
  underReviewSubmissions: 3,
  suspendedUsers: 1,
  suspendedOrganizations: 2,
  maintenanceMode: false,
};

const statsOverview = {
  counts: {
    users: 93,
    volunteers: 80,
    organizations: 10,
    verifiedOrganizations: 6,
    opportunities: 30,
    pendingVerifications: 7,
  },
  totalVolunteerHours: 1234.5,
  verificationRate: 0.6,
  gateFreezes: 2,
};

const series = {
  days: 30,
  points: [
    { date: '2026-09-01', signups: 3, applications: 5, verifications: 1 },
    { date: '2026-09-02', signups: 7, applications: 0, verifications: 2 },
  ],
};

const verificationsQueue = {
  items: [
    {
      _id: '64f0000000000000000000c1',
      status: 'pending',
      submittedAt: '2026-09-20T10:15:00.000Z',
      documents: ['64f0000000000000000000d1', '64f0000000000000000000d2'],
      organization: {
        _id: '64f0000000000000000000b1',
        nameFr: 'Timimoun Cultural Association',
        verificationStatus: 'pending',
      },
    },
  ],
  nextCursor: null,
  limit: 3,
  total: 4,
  page: 1,
  pages: 2,
};

const openReports = {
  items: [
    {
      _id: '64f0000000000000000000e1',
      status: 'open',
      targetType: 'opportunity',
      title: 'Heritage Restoration Drive',
      reason: 'Inappropriate content',
      priority: 'high',
      createdAt: '2026-09-19T18:40:00.000Z',
      reporter: { username: 'reporter_one' },
      target: { type: 'opportunity', title: 'Heritage Restoration Drive' },
    },
    {
      _id: '64f0000000000000000000e2',
      status: 'open',
      targetType: 'user',
      title: null,
      reason: 'Multiple identity verification mismatch alerts',
      priority: 'normal',
      createdAt: '2026-09-18T09:15:00.000Z',
      reporter: { username: 'reporter_two' },
      target: { type: 'user', username: 'volunteer_suspect' },
    },
  ],
  nextCursor: null,
  limit: 3,
  total: 2,
  page: 1,
  pages: 1,
};

const auditLogs = {
  items: [
    {
      log: {
        _id: '64f0000000000000000000a1',
        action: 'organization.status.update',
        method: 'PATCH',
        path: '/admin/organizations/64f0000000000000000000b1/status',
        entityType: 'organizations',
        entityId: '64f0000000000000000000b1',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      actorName: 'Admin One',
      targetName: 'Org A',
    },
    {
      log: {
        _id: '64f0000000000000000000a2',
        action: 'opportunity.status.update',
        method: 'PATCH',
        path: '/admin/opportunities/64f0000000000000000000b2/status',
        entityType: 'opportunities',
        entityId: '64f0000000000000000000b2',
        createdAt: '2026-09-19T10:00:00.000Z',
      },
      actorName: null,
      targetName: null,
    },
  ],
  nextCursor: null,
  limit: 10,
  total: 2,
  page: 1,
  pages: 1,
};

const health = { status: 'ok', version: '1.0.0' };

const systemStatus = {
  status: 'ok',
  version: '1.0.0',
  uptimeSeconds: 90_061,
  maintenance: false,
  message: '',
};

const FORBIDDEN_COPY = [
  /DZ-NAT-REG/i,
  /12-06/,
  /DZ-VOL/,
  /civil registry/i,
  /anchored/i,
  /minted/i,
  /statute/i,
  /compliance\s*%/i,
  /statutory/i,
  /sanction/i,
  /secretariat/i,
];

interface Captured {
  url: string;
  method: string;
}

interface MockOptions {
  role?: 'admin' | 'volunteer' | 'organization' | 'guest';
  analyticsStatus?: number;
  nullDelta?: boolean;
  nullMedian?: boolean;
  maintenance?: boolean;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApi(page: Page, captured: Captured[], options: MockOptions = {}) {
  const role = options.role ?? 'admin';
  const analyticsStatus = options.analyticsStatus ?? 200;

  const overview = {
    ...analyticsOverview,
    totals: options.nullDelta
      ? {
          ...analyticsOverview.totals,
          opportunities: { current: 30, previous: 0, deltaPercent: null },
        }
      : analyticsOverview.totals,
    medianDecisionHours: options.nullMedian ? null : analyticsOverview.medianDecisionHours,
  };

  const status = {
    ...systemStatus,
    maintenance: options.maintenance ?? systemStatus.maintenance,
    message: options.maintenance ? 'Scheduled maintenance window' : '',
  };

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    captured.push({ url, method: route.request().method() });

    if (path.endsWith('/auth/me')) {
      if (role === 'guest') return json(route, { statusCode: 401, code: 'UNAUTHORIZED', message: 'no' }, 401);
      if (role === 'admin') return json(route, adminUser);
      if (role === 'volunteer') return json(route, volunteerUser);
      return json(route, organizationUser);
    }

    if (path.startsWith('/api/v1/admin/')) {
      if (analyticsStatus !== 200) return json(route, { statusCode: analyticsStatus, code: 'FORBIDDEN', message: 'no' }, analyticsStatus);
    }

    if (path.endsWith('/admin/stats/overview')) return json(route, statsOverview);
    if (path.endsWith('/admin/analytics/overview')) return json(route, overview);
    if (path.endsWith('/admin/analytics/series')) return json(route, series);
    if (path.endsWith('/admin/analytics/queue')) return json(route, queue);
    if (path.endsWith('/admin/organizations/verifications')) return json(route, verificationsQueue);
    if (path.endsWith('/admin/reports')) return json(route, openReports);
    if (path.endsWith('/admin/audit-logs')) return json(route, auditLogs);
    if (path.endsWith('/health')) return json(route, health);
    if (path.endsWith('/system/status')) return json(route, status);

    return json(route, {}, 404);
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      const fmt = (value: number) => new Intl.NumberFormat(locale).format(value);

      test(`dashboard numbers match fixtures (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('admin-dashboard')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );

        // Six-stat row comes from the responses, never from a literal.
        await expect(page.getByTestId('stat-total-volunteers-value')).toHaveText(fmt(80));
        await expect(page.getByTestId('stat-verified-organizations-value')).toHaveText(fmt(6));
        await expect(page.getByTestId('stat-published-opportunities-value')).toHaveText(fmt(20));
        await expect(page.getByTestId('stat-active-participants-value')).toHaveText(fmt(42));
        await expect(page.getByTestId('stat-pending-verifications-value')).toHaveText(fmt(4));
        await expect(page.getByTestId('stat-open-reports-value')).toHaveText(fmt(2));

        // Series totals come from the returned points.
        await expect(page.getByTestId('series-points')).toBeVisible();
        await expect(page.getByTestId('series-total-signups')).toHaveText(fmt(10));
        await expect(page.getByTestId('series-total-applications')).toHaveText(fmt(5));
        await expect(page.getByTestId('series-total-verifications')).toHaveText(fmt(3));

        // System status card.
        await expect(page.getByTestId('system-status-panel')).toBeVisible();
        await expect(page.getByTestId('system-status')).toHaveText(catalogs[locale].system.operational);
        await expect(page.getByTestId('system-version')).toHaveText('1.0.0');
        await expect(page.getByTestId('system-uptime')).toContainText('1');
        await expect(page.getByTestId('system-turnaround')).toContainText(fmt(18.5));

        // Audit feed uses enriched display names.
        await expect(page.getByTestId('audit-row')).toHaveCount(2);
        await expect(page.getByTestId('audit-actor').first()).toHaveText('Admin One');
        await expect(page.getByTestId('audit-target').first()).toHaveText('Org A');

        // Every dashboard endpoint was actually called.
        for (const fragment of [
          '/admin/stats/overview',
          '/admin/analytics/overview',
          '/admin/analytics/series',
          '/admin/analytics/queue',
          '/admin/organizations/verifications',
          '/admin/reports',
          '/admin/audit-logs',
        ]) {
          expect(captured.some((c) => c.url.includes(fragment))).toBe(true);
        }
      });

      test(`attention queue renders real rows and links to the manage screens (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/admin/dashboard`);

        const panel = page.getByTestId('queue-panel');
        await expect(panel).toBeVisible();
        await expect(
          page.getByRole('heading', { name: catalogs[locale].queue.title, level: 2 }),
        ).toBeVisible();

        // Real item rows from the pending-verifications and open-reports endpoints.
        await expect(page.getByTestId('queue-item-verification')).toHaveCount(1);
        await expect(panel).toContainText('Timimoun Cultural Association');
        const reportRows = page.getByTestId('queue-item-report');
        await expect(reportRows).toHaveCount(2);
        await expect(panel).toContainText('Heritage Restoration Drive');
        await expect(panel).toContainText('volunteer_suspect');

        // No badge or pill markup inside the queue.
        await expect(panel.locator('.rounded-full')).toHaveCount(0);

        // Review links target the existing manage screens.
        await expect(
          page.getByTestId('queue-view-all'),
        ).toHaveAttribute('href', expect.stringContaining('/admin/verifications'));

        // Read-only: no mutating control inside the queue panel.
        await expect(panel.locator('button')).toHaveCount(0);
      });

      test(`shortcuts route to the management screens (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured);
        await page.goto(`/${locale}/admin/dashboard`);

        const row = page.getByTestId('shortcuts-row');
        await expect(row).toBeVisible();
        await expect(page.getByTestId('shortcut-review-orgs')).toHaveAttribute(
          'href',
          expect.stringContaining('/admin/verifications'),
        );
        await expect(page.getByTestId('shortcut-review-reports')).toHaveAttribute(
          'href',
          expect.stringContaining('/admin/reports'),
        );
        await expect(page.getByTestId('shortcut-manage-volunteers')).toHaveAttribute(
          'href',
          expect.stringContaining('/admin/volunteers'),
        );
        await expect(page.getByTestId('shortcut-manage-opportunities')).toHaveAttribute(
          'href',
          expect.stringContaining('/admin/opportunities'),
        );
      });

      test(`time-range switch refetches the series window (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('series-panel')).toBeVisible();
        await page.getByTestId('dashboard-range-7').click();
        await expect(
          captured.some((c) => c.url.includes('/admin/analytics/series') && c.url.includes('days=7')),
        ).toBe(true);
      });

      test(`null delta and null median render explicit states, never zeros (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { nullDelta: true, nullMedian: true });
        await page.goto(`/${locale}/admin/dashboard`);

        const published = page.getByTestId('stat-published-opportunities');
        await expect(published).toContainText(catalogs[locale].stats.publishedCaptionNeutral);
        await expect(published).not.toContainText('0%');
        await expect(published).not.toContainText('+0%');

        await expect(page.getByTestId('system-turnaround')).toHaveCount(0);
      });

      test(`audit row without display names uses the neutral placeholder (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured);
        await page.goto(`/${locale}/admin/dashboard`);

        const rows = page.getByTestId('audit-row');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(1).getByTestId('audit-actor')).toHaveText(
          catalogs[locale].audit.nameUnavailable,
        );
        await expect(rows.nth(1).getByTestId('audit-target')).toHaveText(
          catalogs[locale].audit.nameUnavailable,
        );
        // A raw ObjectId is never used as the label.
        await expect(rows.nth(1).getByTestId('audit-actor')).not.toContainText('64f0');
      });

      test(`maintenance on renders the stored state (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { maintenance: true });
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('system-maintenance')).toHaveText(
          catalogs[locale].queue.maintenanceOn,
        );
      });

      test(`no civic-sync or sanction copy anywhere on the dashboard (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { maintenance: true });
        await page.goto(`/${locale}/admin/dashboard`);

        const body = (await page.getByTestId('admin-dashboard').textContent()) ?? '';
        for (const pattern of FORBIDDEN_COPY) {
          expect(body).not.toMatch(pattern);
        }
      });

      test(`volunteer sees the forbidden state and no admin request (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { role: 'volunteer' });
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('admin-dashboard-forbidden')).toBeVisible();
        await expect(page.getByTestId('stats-row')).toHaveCount(0);
        expect(captured.some((c) => c.url.includes('/admin/'))).toBe(false);
      });

      test(`organization user sees the forbidden state and no admin request (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { role: 'organization' });
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('admin-dashboard-forbidden')).toBeVisible();
        expect(captured.some((c) => c.url.includes('/admin/'))).toBe(false);
      });

      test(`guest is redirected to sign in (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { role: 'guest' });
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page).toHaveURL(new RegExp(`/${locale}/login`));
      });

      test(`403 from an analytics endpoint renders the forbidden state (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { analyticsStatus: 403 });
        await page.goto(`/${locale}/admin/dashboard`);

        await expect(page.getByTestId('admin-dashboard-forbidden')).toBeVisible();
        await expect(page.getByTestId('stats-row')).toHaveCount(0);
      });
    }
  });
}
