import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/org-review/en.json';
import ar from '../src/messages/org-review/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const orgUser = {
  id: '64f000000000000000000001',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const volunteerUser = {
  id: '64f000000000000000000002',
  email: 'vol@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

interface Captured {
  url: string;
  method: string;
  body?: unknown;
}

interface MockOptions {
  forbidden?: boolean;
  asVolunteer?: boolean;
}

interface QueueState {
  appStatus: Record<string, string>;
  subStatus: Record<string, string>;
  removedParts: Set<string>;
}

const pageEnvelope = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

const applicationsSeed = () => [
  {
    _id: '64f0000000000000000000a1',
    status: 'pending',
    message: 'Two seasons of food drives',
    applicant: { username: 'ali', nameFr: 'Ali Benali' },
    opportunity: { title: 'Food drive' },
    createdAt: '2026-09-09T00:00:00.000Z',
  },
  {
    _id: '64f0000000000000000000a2',
    status: 'under_review',
    message: 'Weekend availability',
    applicant: { username: 'sara', nameFr: 'Sara Amrani' },
    opportunity: { title: 'Food drive' },
    createdAt: '2026-09-08T00:00:00.000Z',
  },
];

const participantsSeed = () => [
  {
    _id: '64f0000000000000000000p1',
    status: 'active',
    volunteer: { nameFr: 'Volunteer One' },
    opportunity: { title: 'Cleanup day' },
    submission: { status: 'submitted' },
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  {
    _id: '64f0000000000000000000p2',
    status: 'completed',
    volunteer: { nameFr: 'Volunteer Two' },
    opportunity: { title: 'Cleanup day' },
    submission: { status: 'verified' },
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

const submissionsSeed = () => [
  {
    _id: '64f0000000000000000000s1',
    status: 'submitted',
    title: 'Beach cleanup report',
    volunteer: { nameFr: 'Volunteer One' },
    opportunity: { title: 'Cleanup day' },
    evidence: [{ mediaId: '64f0000000000000000000m1' }],
    createdAt: '2026-09-10T00:00:00.000Z',
  },
];

const applicantProfile = {
  username: 'ali',
  firstName: 'Ali',
  skills: [{ nameFr: 'First aid' }],
  experiences: null,
};

function matchesStatus(rowStatus: string, wanted: string | null): boolean {
  if (!wanted) return true;
  return wanted.split(',').includes(rowStatus);
}

async function mockApi(page: Page, captured: Captured[], options?: MockOptions) {
  const state: QueueState = {
    appStatus: { '64f0000000000000000000a1': 'pending' },
    subStatus: { '64f0000000000000000000s1': 'submitted' },
    removedParts: new Set<string>(),
  };
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const parsed = new URL(url);
    const path = parsed.pathname;
    const entry: Captured = { url, method: request.method() };
    try {
      entry.body = request.postDataJSON();
    } catch {
      entry.body = undefined;
    }
    captured.push(entry);

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options?.asVolunteer ? volunteerUser : orgUser),
      });
    }
    if (options?.forbidden && (path.includes('/organizations/me/') || path.includes('/applications/') || path.includes('/submissions/'))) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, code: 'FORBIDDEN', message: 'Access denied.' }),
      });
    }
    if (path.endsWith('/organizations/me/applications')) {
      const wanted = parsed.searchParams.get('status');
      const items = applicationsSeed()
        .map((row) => ({ ...row, status: state.appStatus[row._id] ?? row.status }))
        .filter((row) => matchesStatus(row.status, wanted));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageEnvelope(items)) });
    }
    const oppApps = path.match(/\/opportunities\/([^/]+)\/applications$/);
    if (oppApps) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageEnvelope(applicationsSeed())) });
    }
    const appDetail = path.match(/\/applications\/([^/]+)$/);
    if (appDetail && request.method() === 'GET') {
      const id = appDetail[1];
      const row = applicationsSeed().find((r) => r._id === id) ?? applicationsSeed()[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...row, status: state.appStatus[row._id] ?? row.status }),
      });
    }
    const appAction = path.match(/\/applications\/([^/]+)\/(start-review|accept|reject)$/);
    if (appAction && request.method() === 'POST') {
      const [, id, action] = appAction;
      const next = action === 'start-review' ? 'under_review' : action === 'accept' ? 'accepted' : 'rejected';
      state.appStatus[id] = next;
      const row = applicationsSeed().find((r) => r._id === id) ?? applicationsSeed()[0];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...row, status: next }) });
    }
    const applicant = path.match(/\/volunteers\/([^/]+)$/);
    if (applicant) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(applicantProfile) });
    }
    if (path.endsWith('/organizations/me/participants')) {
      const wanted = parsed.searchParams.get('status');
      const items = participantsSeed().filter(
        (row) => !state.removedParts.has(row._id) && matchesStatus(row.status, wanted),
      );
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageEnvelope(items)) });
    }
    const oppParts = path.match(/\/opportunities\/([^/]+)\/participants$/);
    if (oppParts) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageEnvelope(participantsSeed())) });
    }
    const remove = path.match(/\/participations\/([^/]+)\/remove$/);
    if (remove && request.method() === 'POST') {
      state.removedParts.add(remove[1]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ _id: remove[1], status: 'removed' }) });
    }
    if (path.endsWith('/organizations/me/submissions')) {
      const wanted = parsed.searchParams.get('status');
      const items = submissionsSeed()
        .map((row) => ({ ...row, status: state.subStatus[row._id] ?? row.status }))
        .filter((row) => matchesStatus(row.status, wanted));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageEnvelope(items)) });
    }
    const subDetail = path.match(/\/submissions\/([^/]+)$/);
    if (subDetail && request.method() === 'GET') {
      const id = subDetail[1];
      const row = submissionsSeed().find((r) => r._id === id) ?? submissionsSeed()[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...row, status: state.subStatus[row._id] ?? row.status }),
      });
    }
    const subReview = path.match(/\/submissions\/([^/]+)\/start-review$/);
    if (subReview && request.method() === 'POST') {
      state.subStatus[subReview[1]] = 'under_review';
      const row = submissionsSeed()[0];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...row, status: 'under_review' }) });
    }
    const subVerify = path.match(/\/submissions\/([^/]+)\/verify$/);
    if (subVerify && request.method() === 'POST') {
      state.subStatus[subVerify[1]] = 'verified';
      const row = submissionsSeed()[0];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...row, status: 'verified' }) });
    }
    const subReject = path.match(/\/submissions\/([^/]+)\/reject$/);
    if (subReject && request.method() === 'POST') {
      state.subStatus[subReject[1]] = 'rejected';
      const row = submissionsSeed()[0];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...row, status: 'rejected' }) });
    }
    const media = path.match(/\/media\/([^/]+)$/);
    if (media) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ media: { _id: media[1] }, url: 'https://cdn.example/e1.jpg' }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`applications inbox with real under_review tab (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/applications`);
        await expect(page.getByTestId('org-applications')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('tab-under_review')).toBeVisible();
        await expect(page.getByTestId('applications-count')).toContainText('1');
        await page.getByTestId('tab-under_review').click();
        await expect(page.getByTestId('applications-count')).toContainText('1');
        const inboxCalls = captured.filter((c) => c.url.includes('/organizations/me/applications'));
        expect(inboxCalls.some((c) => c.url.includes('status=under_review'))).toBe(true);
      });

      test(`pending to start-review to accept (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/applications`);
        await page.getByTestId('application-expand-64f0000000000000000000a1').click();
        await expect(page.getByTestId('application-detail')).toBeVisible();
        await expect(page.getByTestId('application-detail-message')).toContainText('Two seasons');
        await page.getByTestId('application-detail-start-review').click();
        await expect(page.getByTestId('application-detail-accept')).toBeVisible();
        await page.getByTestId('application-detail-accept').click();
        await expect(page.getByTestId('application-detail')).toContainText(catalogs[locale].tabs.accepted);
        expect(captured.some((c) => c.url.endsWith('/start-review') && c.method === 'POST')).toBe(true);
        expect(captured.some((c) => c.url.endsWith('/accept') && c.method === 'POST')).toBe(true);
      });

      test(`reject requires a reason then posts it (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/applications`);
        await page.getByTestId('application-expand-64f0000000000000000000a1').click();
        await page.getByTestId('application-detail-reject').click();
        await expect(page.getByTestId('application-detail-reject-dialog')).toBeVisible();
        await expect(page.getByTestId('application-detail-reject-dialog-confirm')).toBeDisabled();
        await expect(page.getByTestId('application-detail-reject-dialog-required')).toContainText(
          catalogs[locale].applications.reasonRequired,
        );
        await page.getByTestId('application-detail-reject-dialog-reason').fill('No seats left');
        await page.getByTestId('application-detail-reject-dialog-confirm').click();
        await expect(page.getByTestId('application-detail')).toContainText(catalogs[locale].tabs.rejected);
        const rejects = captured.filter((c) => c.url.endsWith('/reject') && c.method === 'POST');
        expect(rejects.length).toBeGreaterThan(0);
        expect(JSON.stringify(rejects[rejects.length - 1].body)).toContain('No seats left');
      });

      test(`cross-opportunity inbox filters (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/applications`);
        await expect(page.getByTestId('org-applications')).toBeVisible();
        await page.getByTestId('applications-opportunity').fill('64f0000000000000000000bb');
        await page.getByTestId('applications-search').fill('Ali');
        const inboxCalls = captured.filter((c) => c.url.includes('/organizations/me/applications'));
        expect(inboxCalls.some((c) => c.url.includes('opportunityId=64f0000000000000000000bb'))).toBe(true);
        expect(inboxCalls.some((c) => c.url.includes('q=Ali'))).toBe(true);
      });

      test(`applicant public blocks with opt-out empty states (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/applications/64f0000000000000000000a1`);
        await expect(page.getByTestId('application-detail-page')).toBeVisible();
        await expect(page.getByTestId('application-detail-page-applicant-skill')).toHaveCount(1);
        await expect(page.getByTestId('application-detail-page-applicant-experiences-empty')).toContainText(
          catalogs[locale].applications.applicantHidden,
        );
      });

      test(`non-org role sees the forbidden state (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        void captured;
        await mockApi(page, captured, { asVolunteer: true, forbidden: true });
        await page.goto(`/${locale}/org/applications`);
        await expect(page.getByTestId('applications-forbidden')).toBeVisible();
      });

      test(`participants roster incl. completed with remove-with-reason (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/participants`);
        await expect(page.getByTestId('org-participants')).toBeVisible();
        // Default filter is All (no status param → both seeds).
        await expect(page.getByTestId('tab-all')).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('participants-count')).toContainText('2');
        await expect(page.getByTestId('participant-row')).toHaveCount(2);
        await page.getByTestId('tab-completed').click();
        await expect(page.getByTestId('participant-row')).toHaveCount(1);
        await page.getByTestId('tab-active').click();
        await page.getByTestId('participant-expand-64f0000000000000000000p1').click();
        await expect(page.getByTestId('participant-detail-submission')).toContainText('submitted');
        await page.getByTestId('participant-detail-remove').click();
        await expect(page.getByTestId('participant-detail-remove-dialog-confirm')).toBeDisabled();
        await page.getByTestId('participant-detail-remove-dialog-reason').fill('No-show twice');
        await page.getByTestId('participant-detail-remove-dialog-confirm').click();
        await expect(page.getByTestId('participant-row')).toHaveCount(0);
        const removes = captured.filter((c) => c.url.endsWith('/remove') && c.method === 'POST');
        expect(removes.length).toBeGreaterThan(0);
        expect(JSON.stringify(removes[removes.length - 1].body)).toContain('No-show twice');
      });

      test(`contributions to-review multi-status with approve-and-mint (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/contributions`);
        await expect(page.getByTestId('org-contributions')).toBeVisible();
        await expect(page.getByTestId('tab-to-review')).toBeVisible();
        await expect(page.getByTestId('tab-verified')).toHaveCount(0);
        const inboxCalls = captured.filter((c) => c.url.includes('/organizations/me/submissions'));
        expect(inboxCalls.some((c) => c.url.includes('status=') && c.url.includes('under_review'))).toBe(true);
        await page.getByTestId('contribution-tabs').getByTestId('tab-submitted').click();
        await page.getByTestId('submission-expand-64f0000000000000000000s1').click();
        await expect(page.getByTestId('submission-detail')).toBeVisible();
        await expect(page.getByTestId('submission-detail-mint-note')).toContainText(
          catalogs[locale].contributions.mintNote,
        );
        await expect(page.locator('audio')).toHaveCount(0);
        const evidence = page.getByTestId('submission-detail-evidence-item').locator('img');
        await expect(evidence).toHaveAttribute('src', 'https://cdn.example/e1.jpg');
        await page.getByTestId('submission-detail-approve').click();
        await expect(page.getByTestId('submission-detail-verified')).toContainText(
          catalogs[locale].contributions.verifiedState,
        );
        const verifies = captured.filter((c) => c.url.endsWith('/verify') && c.method === 'POST');
        expect(verifies.length).toBeGreaterThan(0);
        const body = await page.getByTestId('org-contributions').textContent();
        expect(body ?? '').not.toMatch(/Ask clarification|Contact coordinator|Send participant message|Council|Compliance/i);
      });

      test(`contributions search, format, sort and reject-with-reason (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/contributions`);
        await expect(page.getByTestId('org-contributions')).toBeVisible();
        await page.getByTestId('contributions-search').fill('cleanup');
        await page.getByTestId('contributions-format').selectOption('image');
        await page.getByTestId('contributions-sort').selectOption('oldest');
        const inboxCalls = captured.filter((c) => c.url.includes('/organizations/me/submissions'));
        expect(inboxCalls.some((c) => c.url.includes('q=cleanup'))).toBe(true);
        expect(inboxCalls.some((c) => c.url.includes('format=image'))).toBe(true);
        expect(inboxCalls.some((c) => c.url.includes('sort=oldest'))).toBe(true);
        await page.getByTestId('submission-expand-64f0000000000000000000s1').click();
        await page.getByTestId('submission-detail-reject').click();
        await expect(page.getByTestId('submission-detail-reject-dialog-confirm')).toBeDisabled();
        await page.getByTestId('submission-detail-reject-dialog-reason').fill('Mismatch');
        await page.getByTestId('submission-detail-reject-dialog-confirm').click();
        await expect(page.getByTestId('submission-detail')).toContainText(catalogs[locale].tabs.rejected);
        const rejects = captured.filter((c) => c.url.includes('/reject') && c.method === 'POST');
        expect(JSON.stringify(rejects[rejects.length - 1].body)).toContain('Mismatch');
      });
    }
  });
}
