import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/public-talent/en.json';
import ar from '../src/messages/public-talent/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const ORG = {
  id: 'o1',
  slug: 'el-amel',
  nameFr: 'Association El-Amel',
  nameAr: 'جمعية الأمل',
};

const SKILLS = [
  { id: 's1', skillId: 's1', nameFr: 'First aid', nameAr: 'إسعاف أولي', level: 4, isPrimary: true },
  { id: 's2', skillId: 's2', nameFr: 'Logistics', nameAr: 'لوجستيك' },
];

// Two rows from the SAME organization (deduped in the CV) with MINUTE
// durations: 180 + 120 = 300 -> 5 h total.
const EXP1 = {
  id: '64f0000000000000000000a1',
  registryId: 'EXP-000001',
  title: 'Beach cleanup',
  description: 'Shoreline shift',
  skills: ['s1'],
  duration: 180,
  organization: ORG,
  verifiedAt: '2026-09-05T12:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  evidence: [],
};

const EXP2 = {
  ...EXP1,
  id: '64f0000000000000000000a2',
  registryId: 'EXP-000002',
  title: 'Food drive',
  duration: 120,
  verificationCode: 'IJKLMNOP',
};

const PROFILE = {
  username: 'amina',
  registryId: 'VOL-000042',
  // Payload-only: the CV must never render the surname.
  fullName: 'Amina Belkacem',
  firstName: 'Amina',
  avatar: null,
  banner: null,
  headline: 'Community outreach volunteer',
  bio: 'I organize neighborhood cleanups.',
  availabilityNote: null,
  preferredDomains: [],
  geographicBase: null,
  createdAt: '2019-04-02T00:00:00.000Z',
  stats: { completedTasks: 12, verifiedExperiences: 4, volunteerHours: 1800 },
  areasOfContribution: null,
  location: null,
  skills: SKILLS,
  availability: null,
  experiences: [EXP1, EXP2],
  portfolio: null,
  isFavorited: false,
  favoriteCount: 0,
};

/** Experiences/skills/stats gates closed: the CV shows identity only. */
const CLOSED_PROFILE = {
  username: 'karim',
  registryId: 'VOL-000077',
  fullName: 'Karim Haddad',
  firstName: null,
  avatar: null,
  banner: null,
  headline: null,
  bio: null,
  availabilityNote: null,
  preferredDomains: [],
  geographicBase: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  stats: null,
  areasOfContribution: null,
  location: null,
  skills: null,
  availability: null,
  experiences: null,
  portfolio: null,
  isFavorited: false,
  favoriteCount: 0,
};

const GUEST = {
  status: 401,
  body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Guest' },
};

async function mockApi(page: Page, profile: unknown) {
  const username = (profile as { username: string }).username;
  await page.route('**/api/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/auth/me')) {
      return json(GUEST.status, GUEST.body);
    }
    if (url.pathname.endsWith(`/volunteers/${username}`)) {
      return json(200, profile);
    }
    // Secondary reads used by the profile shell; empty payloads keep the
    // entry-point assertions focused on the CV link.
    if (url.pathname.endsWith(`/volunteers/${username}/experiences`)) {
      return json(200, { items: [], nextCursor: null, limit: 50, total: 0, page: 1, pages: 1 });
    }
    if (url.pathname.endsWith('/reviews')) {
      return json(200, { items: [], nextCursor: null, limit: 10, total: 0, page: 1, pages: 1 });
    }
    if (url.pathname.endsWith('/skills')) {
      return json(200, SKILLS);
    }
    if (url.pathname.endsWith('/skill-categories')) {
      return json(200, []);
    }
    if (url.pathname.endsWith('/locations/wilayas')) {
      return json(200, []);
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

/** Record `window.print()` calls instead of invoking the real dialog. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    const calls: number[] = [];
    (window as unknown as { __printCalls: number[] }).__printCalls = calls;
    window.print = () => {
      calls.push(Date.now());
    };
  });
}

async function printCalls(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __printCalls?: number[] }).__printCalls?.length ?? 0,
  );
}

for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
  test.describe(`volunteer CV (${locale})`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('renders only the public sections with converted hours', async ({ page }) => {
      await stubPrint(page);
      await mockApi(page, PROFILE);
      await page.goto(`/${locale}/volunteers/amina/cv`);

      const cv = page.getByTestId('cv-page');
      await expect(cv).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

      // Identity: first name only, registry reference, headline.
      await expect(page.getByTestId('cv-name')).toHaveText('Amina');
      await expect(page.getByTestId('cv-header')).toContainText('VOL-000042');
      await expect(page.getByTestId('cv-header')).toContainText('Community outreach volunteer');

      // About + localized skills.
      await expect(page.getByTestId('cv-about')).toContainText('neighborhood cleanups');
      const skills = page.getByTestId('cv-skills').getByRole('listitem');
      await expect(skills).toHaveCount(2);
      await expect(skills.first()).toContainText(locale === 'ar' ? 'إسعاف أولي' : 'First aid');

      // Experiences: MINUTES -> hours, localized org, verification code.
      const experiences = page.getByTestId('cv-experience');
      await expect(experiences).toHaveCount(2);
      await expect(experiences.first()).toContainText('Beach cleanup');
      await expect(experiences.first()).toContainText(
        locale === 'ar' ? 'جمعية الأمل' : 'Association El-Amel',
      );
      await expect(experiences.first()).toContainText(
        catalogs[locale].cv.experienceHours.replace('{hours}', '3'),
      );
      await expect(page.getByTestId('cv-experience-code').first()).toContainText('ABCDEFGH');

      // Summary: 300 stored minutes -> 5 h, plus the public completed-task count.
      await expect(page.getByTestId('cv-total-hours')).toContainText(
        catalogs[locale].cv.experienceHours.replace('{hours}', '5'),
      );
      await expect(page.getByTestId('cv-completed-tasks')).toContainText('12');

      // Organizations are deduped by slug: two rows, one organization entry.
      const organizations = page.getByTestId('cv-organizations').getByRole('listitem');
      await expect(organizations).toHaveCount(1);

      // Footer links to the locale-prefixed verification page.
      await expect(page.getByTestId('cv-footer').getByRole('link', { name: catalogs[locale].cv.verifyLink }))
        .toHaveAttribute('href', `/${locale}/verify`);

      // Privacy: the surname and the unrendered createdAt never leak.
      await expect(cv).not.toContainText('Belkacem');
      await expect(cv).not.toContainText('2019');

      // No auto-print without `?print=1`.
      expect(await printCalls(page)).toBe(0);
    });

    test('closed gates render no experience, skill, or stat section', async ({ page }) => {
      await mockApi(page, CLOSED_PROFILE);
      await page.goto(`/${locale}/volunteers/karim/cv`);

      const cv = page.getByTestId('cv-page');
      await expect(cv).toBeVisible();
      // Username is the public fallback when the name gate is closed.
      await expect(page.getByTestId('cv-name')).toHaveText('karim');

      await expect(page.getByTestId('cv-about')).toHaveCount(0);
      await expect(page.getByTestId('cv-skills')).toHaveCount(0);
      await expect(page.getByTestId('cv-experiences')).toHaveCount(0);
      await expect(page.getByTestId('cv-summary')).toHaveCount(0);
      await expect(page.getByTestId('cv-organizations')).toHaveCount(0);

      await expect(cv).not.toContainText('Haddad');
      await expect(cv).not.toContainText('2020');
    });

    test('opens the print dialog once when the profile link passes ?print=1', async ({ page }) => {
      await stubPrint(page);
      await mockApi(page, PROFILE);
      await page.goto(`/${locale}/volunteers/amina/cv?print=1`);

      await expect(page.getByTestId('cv-page')).toBeVisible();
      await expect.poll(() => printCalls(page), { timeout: 5000 }).toBe(1);
      // The manual button still prints on demand.
      await page.getByRole('button', { name: catalogs[locale].cv.print }).click();
      await expect.poll(() => printCalls(page), { timeout: 5000 }).toBe(2);
    });
  });
}

test.describe('profile CV entry point', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows Download CV only when a public section exists', async ({ page }) => {
    await mockApi(page, PROFILE);
    await page.goto('/en/volunteers/amina');
    await expect(page.getByTestId('profile-download-cv')).toHaveAttribute(
      'href',
      '/en/volunteers/amina/cv?print=1',
    );
  });

  test('hides Download CV when every section is opted out', async ({ page }) => {
    await mockApi(page, CLOSED_PROFILE);
    await page.goto('/en/volunteers/karim');
    await expect(page.getByTestId('profile-download-cv')).toHaveCount(0);
  });
});
