import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/public-talent/en.json';
import ar from '../src/messages/public-talent/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const USER = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const ORG = {
  id: 'o1',
  slug: 'el-amel',
  nameFr: 'Association El-Amel',
  nameAr: 'جمعية الأمل',
};

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

const EXP2 = { ...EXP1, id: '64f0000000000000000000a2', registryId: 'EXP-000002', title: 'Food drive' };

const SKILLS = [
  { id: 's1', skillId: 's1', nameFr: 'First aid', nameAr: 'إسعاف أولي' },
  { id: 's2', skillId: 's2', nameFr: 'Logistics', nameAr: 'لوجستيك' },
];

const WILAYAS = [
  { code: '16', nameFr: 'Alger', nameAr: 'الجزائر' },
  { code: '31', nameFr: 'Oran', nameAr: 'وهران' },
];

const SCHEDULE = {
  monday: [{ from: '09:00', to: '12:00' }],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

const PORTFOLIO = {
  items: [
    {
      id: 'p1',
      title: 'Cleanup photos',
      description: 'Shoreline set',
      typeLabel: 'Photography',
      tags: ['beach'],
      media: [
        { mediaId: 'm-photo', type: 'file', mimeType: 'image/jpeg', filename: 'a.jpg', url: null },
        { mediaId: 'm-link', type: 'link', url: 'https://example.org/field-notes' },
      ],
    },
  ],
};

const REVIEWS = {
  items: [
    {
      id: 'r1',
      rating: 5,
      comment: 'Reliable and punctual.',
      createdAt: '2026-08-01T10:00:00.000Z',
      organization: ORG,
    },
  ],
  nextCursor: null,
  limit: 10,
  total: 1,
  page: 1,
  pages: 1,
};

/** Every gate open. `createdAt` and `fullName` are payload-only, never rendered. */
const PROFILE = {
  username: 'amina',
  registryId: 'VOL-000042',
  fullName: 'Amina Belkacem',
  firstName: 'Amina',
  avatar: 'm-avatar',
  headline: 'Community outreach volunteer',
  bio: 'I organize neighborhood cleanups.',
  availabilityNote: 'Weekends only',
  preferredDomains: ['Environment'],
  geographicBase: 'Algiers',
  createdAt: '2019-04-02T00:00:00.000Z',
  stats: { completedTasks: 12, verifiedExperiences: 4, volunteerHours: 30 },
  areasOfContribution: [
    { categoryId: 'c1', nameFr: 'Environment', nameAr: 'البيئة', percent: 40, count: 4 },
    { categoryId: 'c2', nameFr: 'Health', nameAr: 'الصحة', percent: 60, count: 6 },
  ],
  location: { wilayaId: '16', municipalityId: '1601' },
  skills: SKILLS,
  availability: SCHEDULE,
  experiences: [EXP1],
  portfolio: PORTFOLIO,
  isFavorited: false,
  favoriteCount: 3,
};

/** Every show-flag closed: `null` fields, and `preferredDomains` stays `[]`. */
const CLOSED_PROFILE = {
  username: 'karim',
  registryId: 'VOL-000077',
  fullName: 'Karim Haddad',
  firstName: null,
  avatar: null,
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

const TALENTS_PAGE = {
  items: [
    {
      username: 'amina',
      registryId: 'VOL-000042',
      firstName: 'Amina',
      bio: 'I organize neighborhood cleanups.',
      location: { wilayaId: '16' },
      skills: [SKILLS[0]],
      avatar: 'm-avatar',
      isFavorited: false,
      favoriteCount: 3,
    },
    {
      username: 'yasmin',
      registryId: 'VOL-000043',
      firstName: 'Yasmin',
      bio: null,
      location: { wilayaId: '31' },
      skills: [SKILLS[1]],
      avatar: null,
      isFavorited: false,
      favoriteCount: 1,
    },
  ],
  nextCursor: null,
  limit: 20,
  total: 2,
  page: 1,
  pages: 1,
  facets: {
    skills: [
      { skillId: 's1', count: 7 },
      { skillId: 's2', count: 3 },
    ],
    wilayas: [
      { wilayaId: '16', count: 5 },
      { wilayaId: '31', count: 2 },
    ],
  },
};

// No apply-to-a-volunteer / contact / invite / curation affordances. `apply` is
// only forbidden in the volunteering sense, not as the "Apply filters" label.
const FORBIDDEN = {
  en: /apply\b(?!\s+filters)|contact|invite|message|joined|member since|since 2019/i,
  ar: /توظيف|اتصل|اتصال|دعوة|رسالة|منذ|عضو/,
} as const;

interface Captured {
  path: string;
  method: string;
  query: string;
}

type Handler =
  | { status: number; body?: unknown }
  | ((method: string) => { status: number; body?: unknown });

const MEDIA: Record<string, { media: unknown; url: string }> = {
  'm-avatar': {
    media: { mediaId: 'm-avatar', type: 'image', mimeType: 'image/jpeg', filename: 'a.jpg', url: null },
    url: 'https://cdn.example/avatar.jpg',
  },
  'm-photo': {
    media: { mediaId: 'm-photo', type: 'image', mimeType: 'image/jpeg', filename: 'a.jpg', url: null },
    url: 'https://cdn.example/photo.jpg',
  },
};

async function mockApi(page: Page, handlers: Record<string, Handler>, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const mediaId = /\/media\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (mediaId) {
      captured.push({ path: url.pathname, method: route.request().method(), query: url.search });
      const read = MEDIA[mediaId];
      return route.fulfill({
        status: read ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(read ?? { statusCode: 404, message: 'Not found' }),
      });
    }
    const key = Object.keys(handlers).find((k) => url.pathname.endsWith(k));
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    captured.push({ path: url.pathname, method: route.request().method(), query: url.search });
    const handler = handlers[key];
    const { status, body } =
      typeof handler === 'function' ? handler(route.request().method()) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
  await page.route('**/cdn.example/**', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'image/jpeg',
      body: Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
      ]),
    }),
  );
}

const GUEST: Handler = {
  status: 401,
  body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Guest' },
};

function profileHandlers(profile: unknown, extra: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    '/auth/me': GUEST,
    '/volunteers/amina/experiences': {
      status: 200,
      body: { items: [EXP1], nextCursor: null, limit: 50, total: 1, page: 1, pages: 1 },
    },
    '/reviews': { status: 200, body: REVIEWS },
    '/skills': { status: 200, body: SKILLS },
    '/locations/wilayas': { status: 200, body: WILAYAS },
    '/talents': { status: 200, body: TALENTS_PAGE },
    [profilePath(profile)]: { status: 200, body: profile },
    ...extra,
  };
}

function profilePath(profile: unknown): string {
  return `/volunteers/${(profile as { username: string }).username}`;
}

function requestsTo(captured: Captured[], suffix: string): Captured[] {
  return captured.filter((c) => c.path.endsWith(suffix) && c.method === 'GET');
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`merged profile renders every open section (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, profileHandlers(PROFILE), captured);
        await page.goto(`/${locale}/volunteers/amina`);

        const profile = page.getByTestId('public-profile');
        await expect(profile).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

        // Identity: first name only, registry code, localized wilaya.
        await expect(profile.getByRole('heading', { level: 1 })).toHaveText('Amina');
        await expect(page.getByTestId('profile-registry-code')).toContainText('VOL-000042');
        await expect(page.getByTestId('profile-location')).toContainText(
          locale === 'ar' ? 'الجزائر' : 'Alger',
        );
        await expect(page.getByTestId('profile-bio')).toContainText('neighborhood cleanups');
        await expect(page.getByTestId('profile-avatar')).toBeVisible();

        // Stats strip.
        const stats = page.getByTestId('profile-stats');
        await expect(stats).toContainText('12');
        await expect(stats).toContainText('4');
        await expect(stats).toContainText('30');

        // Areas sorted by percent desc, localized label + percent.
        const areas = page.getByTestId('profile-areas').getByRole('listitem');
        await expect(areas).toHaveCount(2);
        await expect(areas.first()).toContainText(locale === 'ar' ? 'الصحة' : 'Health');
        await expect(areas.first()).toContainText('60');
        await expect(areas.last()).toContainText('40');

        // Skills and weekly availability.
        await expect(page.getByTestId('profile-skills').getByRole('listitem')).toHaveCount(2);
        await expect(page.getByTestId('profile-availability')).toContainText('09:00');
        await expect(page.getByTestId('profile-availability')).toContainText('Weekends only');

        // Experiences: local title, EXP code, org by locale, minutes as hours.
        const exp = page.getByTestId('experience-card').first();
        await expect(exp).toContainText('Beach cleanup');
        await expect(exp).toContainText('EXP-000001');
        await expect(exp).toContainText(locale === 'ar' ? 'جمعية الأمل' : 'Association El-Amel');
        await expect(exp).toContainText('3');

        // Portfolio from the embedded authoritative set, with the link media.
        const portfolio = page.getByTestId('portfolio-item').first();
        await expect(portfolio).toContainText('Cleanup photos');
        await expect(portfolio).toContainText('Photography');
        await expect(portfolio.getByRole('link')).toHaveAttribute(
          'href',
          'https://example.org/field-notes',
        );

        // Reviews section renders the org, rating, and comment.
        const review = page.getByTestId('review-card').first();
        await expect(review).toContainText(locale === 'ar' ? 'جمعية الأمل' : 'Association El-Amel');
        await expect(review).toContainText('Reliable and punctual.');

        // Privacy + neutrality: no surname, no member-since claim, no curation.
        await expect(profile).not.toContainText('Belkacem');
        await expect(profile).not.toContainText('2019');
        await expect(profile).not.toContainText(FORBIDDEN[locale]);
        // Raw-username link, never an `@` key.
        await expect(profile.getByRole('link', { name: catalogs[locale].profile.backToTalents })).toHaveAttribute(
          'href',
          `/${locale}/talents`,
        );

        // Exactly one profile read; standalone portfolio is never requested;
        // experiences are requested once at the aligned limit.
        expect(requestsTo(captured, '/volunteers/amina')).toHaveLength(1);
        expect(requestsTo(captured, '/volunteers/amina/portfolio')).toHaveLength(0);
        const experiences = requestsTo(captured, '/volunteers/amina/experiences');
        expect(experiences).toHaveLength(1);
        expect(experiences[0].query).toContain('limit=50');
      });

      test(`opt-out renders no closed section and no standalone requests (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, profileHandlers(CLOSED_PROFILE), captured);
        await page.goto(`/${locale}/volunteers/karim`);

        const profile = page.getByTestId('public-profile');
        await expect(profile).toBeVisible();
        // Username is the public fallback when the name is opted out.
        await expect(profile.getByRole('heading', { level: 1 })).toHaveText('karim');

        for (const heading of [
          catalogs[locale].skills.title,
          catalogs[locale].availability.title,
          catalogs[locale].experiences.title,
          catalogs[locale].portfolio.title,
          catalogs[locale].areas.title,
          catalogs[locale].stats.title,
        ]) {
          await expect(page.getByText(heading, { exact: false })).toHaveCount(0);
        }
        // No placeholder, empty state, or reserved space for a closed gate.
        await expect(page.getByTestId('profile-skills')).toHaveCount(0);
        await expect(page.getByTestId('profile-availability')).toHaveCount(0);
        await expect(page.getByTestId('profile-areas')).toHaveCount(0);
        await expect(page.getByTestId('profile-portfolio')).toHaveCount(0);
        await expect(page.getByTestId('profile-avatar')).toHaveCount(0);
        // Ungated createdAt stays unrendered even with every flag closed.
        await expect(profile).not.toContainText('2020');
        await expect(profile).not.toContainText('Haddad');

        // The critical privacy assertion: zero calls to the ungated routes.
        expect(requestsTo(captured, '/volunteers/karim/experiences')).toHaveLength(0);
        expect(requestsTo(captured, '/volunteers/karim/portfolio')).toHaveLength(0);
        expect(requestsTo(captured, '/volunteers/karim')).toHaveLength(1);
      });

      test(`directory renders projection, facets and grid (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, profileHandlers(PROFILE), captured);
        await page.goto(`/${locale}/talents`);

        const dir = page.getByTestId('public-talents');
        await expect(dir).toBeVisible();
        await expect(dir.getByRole('heading', { level: 1 })).toHaveText(catalogs[locale].directory.title);
        await expect(page.getByTestId('public-talents-count')).toContainText('2');

        const cards = page.getByTestId('public-talent-card');
        await expect(cards).toHaveCount(2);
        const first = cards.first();
        await expect(first).toContainText('Amina');
        await expect(first).toContainText('VOL-000042');
        await expect(first).toContainText(locale === 'ar' ? 'الجزائر' : 'Alger');
        await expect(first).toContainText(locale === 'ar' ? 'إسعاف أولي' : 'First aid');
        // Thin projection: no headline/counts/availability claims on a card.
        await expect(first).not.toContainText('Community outreach volunteer');
        await expect(first).not.toContainText('Beach cleanup');
        await expect(first).not.toContainText('member');

        // Raw-username profile link, not an `@` handle.
        await expect(first.getByRole('link', { name: 'Amina' })).toHaveAttribute(
          'href',
          `/${locale}/volunteers/amina`,
        );

        // Facet counts are rendered in the filter options.
        const skillOption = page.locator('#public-talent-skill option').first();
        await expect(skillOption).toContainText('(7)');
        const wilayaOption = page.locator('#public-talent-wilaya option').first();
        await expect(wilayaOption).toContainText('(5)');
      });
    }
  });
}

test.describe('directory behavior', () => {
  test('applying filters refetches with the whitelisted query params', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(page, profileHandlers(PROFILE), captured);
    await page.goto('/en/talents');
    await expect(page.getByTestId('public-talent-card')).toHaveCount(2);

    await page.locator('#public-talent-skill').selectOption(['s1']);
    await page.locator('#public-talent-wilaya').selectOption(['16']);
    await page.locator('#public-talent-min-exp').fill('2');
    await page.locator('#public-talent-sort').selectOption('experiences_desc');
    await page.getByRole('button', { name: catalogs.en.directory.applyFilters }).first().click();

    await expect
      .poll(() => {
        const call = requestsTo(captured, '/talents').at(-1);
        return call?.query ?? '';
      })
      .toContain('skillIds=s1');
    const query = requestsTo(captured, '/talents').at(-1)?.query ?? '';
    expect(query).toContain('wilayaIds=16');
    expect(query).toContain('minExperiences=2');
    expect(query).toContain('sort=experiences_desc');
    // Shareable URL keeps the applied filters.
    await expect.poll(() => page.url()).toContain('sort=experiences_desc');
  });

  test('portfolio and availability toggles send their boolean params', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(page, profileHandlers(PROFILE), captured);
    await page.goto('/en/talents');
    await expect(page.getByTestId('public-talent-card')).toHaveCount(2);

    await page.getByRole('checkbox').first().check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('button', { name: catalogs.en.directory.applyFilters }).first().click();

    await expect
      .poll(() => requestsTo(captured, '/talents').at(-1)?.query ?? '')
      .toContain('hasAvailability=true');
    expect(requestsTo(captured, '/talents').at(-1)?.query ?? '').toContain('portfolio=true');
  });

  test('an out-of-whitelist sort is refused before any request', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(page, profileHandlers(PROFILE), captured);
    await page.goto('/en/talents?sort=drop-table');

    await expect(page.getByTestId('public-talents')).toBeVisible();
    await expect(page.getByText(catalogs.en.directory.invalidSortTitle)).toBeVisible();
    expect(requestsTo(captured, '/talents')).toHaveLength(0);
    // Recovery returns to a real listing.
    await page.getByRole('button', { name: catalogs.en.shared.clearFilters }).click();
    await expect.poll(() => requestsTo(captured, '/talents').length).toBe(1);
  });

  test('an empty result shows the neutral empty state', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(
      page,
      profileHandlers(PROFILE, {
        '/talents': {
          status: 200,
          body: { items: [], nextCursor: null, limit: 20, total: 0, page: 1, pages: 1, facets: { skills: [], wilayas: [] } },
        },
      }),
      captured,
    );
    await page.goto('/en/talents');
    await expect(page.getByTestId('public-talent-card')).toHaveCount(0);
    await expect(page.getByText(catalogs.en.directory.emptyTitle)).toBeVisible();
    await expect(page.getByTestId('public-talents')).not.toContainText(FORBIDDEN.en);
  });

  test('cursor paging advances and returns to the first page', async ({ page }) => {
    const captured: Captured[] = [];
    const firstPage = { ...TALENTS_PAGE, nextCursor: 'cursor-2', page: 1, pages: 2, total: 3 };
    const secondPage = {
      ...TALENTS_PAGE,
      items: [{ ...TALENTS_PAGE.items[0], username: 'zineb', firstName: 'Zineb' }],
      nextCursor: null,
      page: 2,
      pages: 2,
      total: 3,
    };
    await mockApi(page, profileHandlers(PROFILE, { '/talents': { status: 200, body: firstPage } }), captured);
    // The paged follow-up is served by cursor, so page 1 must advertise one.
    await page.route('**/api/v1/talents?*cursor=cursor-2*', (route: Route) => {
      const url = new URL(route.request().url());
      captured.push({ path: url.pathname, method: route.request().method(), query: url.search });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(secondPage) });
    });

    await page.goto('/en/talents');
    await expect(page.getByTestId('public-talent-card')).toHaveCount(2);
    await page.getByRole('button', { name: catalogs.en.directory.next }).click();
    await expect(page.getByTestId('public-talent-card')).toHaveCount(1);
    await expect(page.getByTestId('public-talent-card')).toContainText('Zineb');
    await expect.poll(() => requestsTo(captured, '/talents').at(-1)?.query ?? '').toContain('cursor=cursor-2');
    await page.getByRole('button', { name: catalogs.en.directory.previous }).click();
    await expect(page.getByTestId('public-talent-card')).toHaveCount(2);
  });
});

test.describe('profile behavior', () => {
  test('the experiences block merges the embedded window with paged rows without duplicating', async ({
    page,
  }) => {
    const captured: Captured[] = [];
    // The embedded array repeats EXP1 and the first paged page adds EXP2: the
    // union is 2 rows, not 3, and ordering keeps the embedded window first.
    await mockApi(
      page,
      profileHandlers(PROFILE, {
        '/volunteers/amina/experiences': {
          status: 200,
          body: { items: [EXP1, EXP2], nextCursor: null, limit: 50, total: 2, page: 1, pages: 1 },
        },
      }),
      captured,
    );
    await page.goto('/en/volunteers/amina');
    const cards = page.getByTestId('experience-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Beach cleanup');
    await expect(cards.nth(1)).toContainText('Food drive');
    // The dedupe keeps one copy of the overlapping row.
    await expect(page.getByText('Beach cleanup')).toHaveCount(1);
    // One aligned page request, not one per rendered row.
    expect(requestsTo(captured, '/volunteers/amina/experiences')).toHaveLength(1);
  });

  test('a guest save redirects to login with the current URL and sends no mutation', async ({
    page,
  }) => {
    const locale: Locale = 'en';
    const captured: Captured[] = [];
    await mockApi(page, profileHandlers(PROFILE), captured);
    await page.goto('/en/talents?sort=newest&portfolio=true');
    await expect(page.getByTestId('public-talent-card')).toHaveCount(2);

    await page.getByTestId('save-talent-amina').click();
    // The guest lands on Login, once, at the real localized path.
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}/login`);
    // The redirect target keeps the active filters (order is URL-built).
    const next = new URL(page.url()).searchParams.get('next') ?? '';
    const nextUrl = new URL(next, 'http://127.0.0.1');
    expect(nextUrl.pathname).toBe(`/${locale}/talents`);
    expect(nextUrl.searchParams.get('sort')).toBe('newest');
    expect(nextUrl.searchParams.get('portfolio')).toBe('true');
    expect(captured.filter((c) => c.path.includes('/favorites/'))).toHaveLength(0);
  });

  test('a signed-in save posts the favorite and reflects the pressed state', async ({ page }) => {
    const captured: Captured[] = [];
    let favorited = false;
    await mockApi(
      page,
      {
        ...profileHandlers(PROFILE, {
          '/auth/me': { status: 200, body: USER },
          '/favorites/talents/amina': { status: 201, body: { favorited: true, favoriteCount: 4 } },
        }),
        // The toggle invalidates and refetches the profile, so the server copy
        // has to agree with the mutation for the pressed state to settle.
        '/volunteers/amina': () => ({
          status: 200,
          body: { ...PROFILE, isFavorited: favorited, favoriteCount: favorited ? 4 : 3 },
        }),
      },
      captured,
    );
    // Capture the mutation so the fixture flips after the POST is answered.
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/favorites/talents/amina')) {
        favorited = true;
      }
    });
    await page.goto('/en/volunteers/amina');
    await expect(page.getByTestId('profile-save')).toBeVisible();
    await page.getByTestId('profile-save').click();
    await expect
      .poll(() => captured.filter((c) => c.path.endsWith('/favorites/talents/amina') && c.method === 'POST').length)
      .toBe(1);
    await expect(page.getByTestId('profile-save')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a missing profile shows the not-found state without sub-requests', async ({ page }) => {    const captured: Captured[] = [];
    await mockApi(
      page,
      {
        '/auth/me': GUEST,
        '/volunteers/ghost': { status: 404, body: { statusCode: 404, message: 'Not found' } },
        '/skills': { status: 200, body: SKILLS },
        '/locations/wilayas': { status: 200, body: WILAYAS },
      },
      captured,
    );
    await page.goto('/en/volunteers/ghost');
    await expect(page.getByText(catalogs.en.profile.notFoundTitle)).toBeVisible();
    expect(requestsTo(captured, '/volunteers/ghost/experiences')).toHaveLength(0);
    expect(requestsTo(captured, '/volunteers/ghost/reviews')).toHaveLength(0);
    expect(requestsTo(captured, '/volunteers/ghost')).toHaveLength(1);
  });
});
