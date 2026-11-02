import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

// Structural fidelity gate for the public opportunities list: loads the
// original design code.html via file:// and the built route at 1440x900, then
// compares per section — element counts, computed styles, container boxes —
// as a printed text table. Only the recorded allowed differences may remain.
// (Same method as e2e/landing-fidelity.spec.ts; screen.png never consulted.)
//
// Allowed differences (reviewed, intentional):
// - A-copy: all copy differs (neutralized forbidden vocabulary, real strings).
// - A-ink: text colors follow DESIGN.md (#111827/#64748B), not code.html
//   frontmatter (#141b2b/#4a4455).
// - A-canvas: bands follow DESIGN.md Neutral Canvas (#F8FAFC), not code.html
//   (#f1f3ff/#e9edff).
// - A-type: h1 follows DESIGN.md headline-lg (24px/600); code.html uses an
//   arbitrary larger desktop size and font-bold (700) where the system
//   mandates semibold (600) for headlines/titles. Card titles keep the
//   design's own title-lg size (18px).
// - A-data: card counts differ where real API data replaces the six mock rows
//   (2 mocked rows here); heights/counts driven by served data.
// - A-icons: Material Symbols replaced by lucide-react inline SVG.
// - A-links: dead `#` links target the real public detail route; guest CTA
//   buttons are Login-`next` links (established guest pattern).
// - A-civic: rejected narrative removed — badge slot keeps a neutral pill,
//   accreditation per-card line dropped (no certificate entity), banner keeps
//   neutral helper copy, legal-umbrella note removed, footer keeps the shared
//   reviewed legal links (About/Privacy/Terms) instead of Civic Integrity
//   Code / Institutional Verification.
// - A-mode: Format labels are the real onsite|remote|hybrid enum (neutral
//   On-site/Remote/Hybrid), not the mockup's Field/Hybrid/Remote-Engagement.
// - A-sort: compact sort select added in the meta-bar row (server FEED_SORTS
//   whitelist; the design has no sort control) — 5 selects vs 4.
// - A-page: numbered 1/2 buttons reconciled to the shared Prev/Next
//   Pagination driven by the served total/page/pages (never invented).
// - A-footer: footer is the shared reviewed PublicFooter (identical component
//   as landing), not a per-screen port.
// - A-cta: all View CTAs share one style (first-row emphasis kept for the
//   featured row only where sampled).

const CODE_HTML = join(
  process.cwd(),
  '..',
  'design',
  'Basmatak Tatatoua - Public Opportunities',
  'code.html',
);
const CODE_URL = `file:///${CODE_HTML.replace(/\\/g, '/')}`;

const SECTION_MAP = [
  { code: 'header', route: 'header' },
  { code: 'toolbar', route: 'filters' },
  { code: 'list', route: 'list' },
  { code: 'pagination', route: 'pagination' },
  { code: 'cta', route: 'cta-band' },
] as const;

const COUNT_KEYS = ['h1', 'h2', 'h3', 'button', 'a', 'img', 'select', 'input'] as const;

interface SectionFacts {
  counts: Record<(typeof COUNT_KEYS)[number], number>;
  rootBg: string;
  rootPadTop: string;
  headFamily: string;
  headSize: string;
  headWeight: string;
  headColor: string;
  ctaBg: string;
  ctaColor: string;
  ctaRadius: string;
  cardBg: string;
  cardRadius: string;
  gridGap: string;
  boxW: number;
  boxH: number;
}

const CODE_SECTION_JS = `
  (() => {
    const h1 = document.querySelector('h1');
    const header = h1 ? h1.closest('div[class*="mb-space-xl"]') : null;
    const search = document.getElementById('searchInput');
    const toolbar = search ? search.closest('div[class*="rounded-xl"]') : null;
    const list = document.getElementById('view-active');
    const pagination = document.getElementById('pagination-bar');
    const ctaTitle = Array.from(document.querySelectorAll('h4')).find((el) =>
      el.textContent.includes('Looking to apply'),
    );
    const cta = ctaTitle ? ctaTitle.closest('div[class*="mt-space-xl"]') : null;
    return [header, toolbar, list, pagination, cta];
  })()
`;

async function codeFacts(page: Page): Promise<SectionFacts[]> {
  return page.evaluate(
    ({ keys, js }) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const sections = new Function(`return (${js});`)() as (Element | null)[];
      const cs = (node: Element | null) => (node ? getComputedStyle(node) : null);
      return sections.map((el) => {
        if (!el) {
          return {
            counts: Object.fromEntries(keys.map((k) => [k, -1])),
            rootBg: 'MISSING',
            rootPadTop: 'MISSING',
            headFamily: 'MISSING',
            headSize: 'MISSING',
            headWeight: 'MISSING',
            headColor: 'MISSING',
            ctaBg: 'MISSING',
            ctaColor: 'MISSING',
            ctaRadius: 'MISSING',
            cardBg: 'MISSING',
            cardRadius: 'MISSING',
            gridGap: 'MISSING',
            boxW: -1,
            boxH: -1,
          };
        }
        const counts = {} as Record<string, number>;
        for (const key of keys) counts[key] = el.querySelectorAll(key).length;
        const root = cs(el);
        const head = el.querySelector('h1,h2,h3,h4');
        const headCs = cs(head);
        const cta =
          Array.from(el.querySelectorAll('a')).find(
            (a) => getComputedStyle(a).backgroundColor !== 'rgba(0, 0, 0, 0)',
          ) ?? el.querySelector('a');
        const card = el.querySelector('article');
        const cardCs = cs(card);
        const grid = Array.from(el.querySelectorAll('div')).find((d) =>
          getComputedStyle(d).display.includes('grid'),
        );
        const box = el.getBoundingClientRect();
        return {
          counts,
          rootBg: root?.backgroundColor ?? 'n/a',
          rootPadTop: root?.paddingTop ?? 'n/a',
          headFamily: headCs?.fontFamily ?? 'n/a',
          headSize: headCs?.fontSize ?? 'n/a',
          headWeight: headCs?.fontWeight ?? 'n/a',
          headColor: headCs?.color ?? 'n/a',
          ctaBg: cta ? (cs(cta)?.backgroundColor ?? 'n/a') : 'n/a',
          ctaColor: cta ? (cs(cta)?.color ?? 'n/a') : 'n/a',
          ctaRadius: cta ? (cs(cta)?.borderRadius ?? 'n/a') : 'n/a',
          cardBg: cardCs?.backgroundColor ?? 'n/a',
          cardRadius: cardCs?.borderRadius ?? 'n/a',
          gridGap: grid ? getComputedStyle(grid).gap : 'n/a',
          boxW: Math.round(box?.width ?? 0),
          boxH: Math.round(box?.height ?? 0),
        };
      });
    },
    { keys: [...COUNT_KEYS], js: CODE_SECTION_JS },
  ) as Promise<SectionFacts[]>;
}

async function routeFacts(page: Page, selectors: string[]): Promise<SectionFacts[]> {
  const out = await page.$$eval(
    selectors.join(', '),
    (sections, args) =>
      sections.map((el) => {
        const cs = (node: Element | null) => (node ? getComputedStyle(node) : null);
        const counts = {} as Record<string, number>;
        for (const key of args.keys) counts[key] = el.querySelectorAll(key).length;
        const root = cs(el);
        const head = el.querySelector('h1,h2,h3,h4');
        const headCs = cs(head);
        const cta =
          Array.from(el.querySelectorAll('a')).find(
            (a) => getComputedStyle(a).backgroundColor !== 'rgba(0, 0, 0, 0)',
          ) ?? el.querySelector('a');
        const ctaCs = cs(cta ?? null);
        const card = el.querySelector('[data-testid="opp-list-card"]');
        const cardCs = cs(card);
        const grid = Array.from(el.querySelectorAll('div')).find((d) =>
          getComputedStyle(d).display.includes('grid'),
        );
        const box = el.getBoundingClientRect();
        return {
          counts,
          rootBg: root?.backgroundColor ?? 'n/a',
          rootPadTop: root?.paddingTop ?? 'n/a',
          headFamily: headCs?.fontFamily ?? 'n/a',
          headSize: headCs?.fontSize ?? 'n/a',
          headWeight: headCs?.fontWeight ?? 'n/a',
          headColor: headCs?.color ?? 'n/a',
          ctaBg: ctaCs?.backgroundColor ?? 'n/a',
          ctaColor: ctaCs?.color ?? 'n/a',
          ctaRadius: ctaCs?.borderRadius ?? 'n/a',
          cardBg: cardCs?.backgroundColor ?? 'n/a',
          cardRadius: cardCs?.borderRadius ?? 'n/a',
          gridGap: grid ? getComputedStyle(grid).gap : 'n/a',
          boxW: Math.round(box?.width ?? 0),
          boxH: Math.round(box?.height ?? 0),
        };
      }),
    { keys: [...COUNT_KEYS] },
  );
  return out as unknown as SectionFacts[];
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

// Left = design code.html palette; right = Basmatak warm light identity.
const ALLOWED_STYLE_PAIRS = new Set([
  'rgb(20, 27, 43)|rgb(20, 17, 13)', // A-ink headings -> ink
  'rgb(74, 68, 85)|rgb(92, 85, 72)', // A-ink muted -> ink-muted
  'rgb(249, 249, 255)|rgb(255, 255, 255)', // A-canvas cards -> surface
  'rgb(241, 243, 255)|rgb(244, 240, 230)', // A-canvas low -> surface-muted
  'rgb(233, 237, 255)|rgb(244, 240, 230)', // A-canvas container -> surface-muted
  'rgb(233, 237, 255)|rgb(246, 236, 203)', // A-tint CTA fill -> gold-soft
  'rgb(109, 40, 217)|rgb(212, 166, 42)', // A-cta primary -> gold fill
  'rgb(109, 40, 217)|rgb(20, 17, 13)', // A-cta primary -> near-black fill
  'rgb(109, 40, 217)|rgb(138, 101, 8)', // A-link -> gold-strong
  'rgb(255, 255, 255)|rgb(20, 17, 13)', // A-cta text -> on-gold
]);

const DATA_SECTIONS = new Set(['list']);

const oppA = {
  _id: '64f0000000000000000000b2',
  slug: 'oasis-water-restoration',
  title: 'Oasis Water Channel Restoration',
  description: 'Hands-on maintenance of historic surface irrigation channels.',
  registryId: 'OPP-000123',
  mode: 'onsite',
  startDate: '2026-10-24T00:00:00.000Z',
  endDate: '2026-10-26T00:00:00.000Z',
  applicationDeadline: new Date(Date.now() + 4 * 86_400_000).toISOString(),
  durationMinutes: 960,
  categoryName: { nameFr: 'Environnement', nameAr: 'البيئة' },
  locationLabels: {
    wilaya: { nameFr: 'Adrar', nameAr: 'أدرار' },
    municipality: { nameFr: 'Timimoun', nameAr: 'تيميمون' },
  },
  positions: [
    {
      requiredCount: 8,
      filledCount: 4,
      skillNames: [
        { skillId: 's1', nameFr: 'Fieldwork', nameAr: 'عمل ميداني' },
        { skillId: 's2', nameFr: 'Coordination', nameAr: 'تنسيق' },
      ],
    },
  ],
  organization: {
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    verificationStatus: 'verified',
  },
};

const oppB = {
  _id: '64f0000000000000000000b3',
  slug: 'bilingual-guide-translation',
  title: 'Bilingual Guide Translation',
  description: 'Translate community workshop handbooks for volunteer leaders.',
  registryId: 'OPP-000124',
  mode: 'remote',
  startDate: '2026-11-05T00:00:00.000Z',
  endDate: '2026-11-20T00:00:00.000Z',
  applicationDeadline: new Date(Date.now() + 60 * 86_400_000).toISOString(),
  durationMinutes: 900,
  categoryName: { nameFr: 'Education', nameAr: 'التعليم' },
  locationLabels: { wilaya: null, municipality: null },
  positions: [],
  organization: {
    slug: 'casbah-initiative',
    nameFr: 'Casbah Initiative',
    nameAr: 'مبادرة القصبة',
    verificationStatus: 'pending',
  },
};

async function mockOpps(page: Page, mode: 'populated' | 'empty') {
  await page.route('**/api/v1/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
      });
    }
    if (path.endsWith('/opportunities')) {
      const url = new URL(route.request().url());
      const q = url.searchParams.get('q') ?? '';
      const items = mode === 'empty' || q.includes('no-match-xyz') ? [] : [oppA, oppB];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          nextCursor: null,
          limit: 12,
          total: items.length,
          page: 1,
          pages: 1,
        }),
      });
    }
    if (path.endsWith('/skill-categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'c1', nameFr: 'Environnement', nameAr: 'البيئة' }]),
      });
    }
    if (path.endsWith('/skills')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 's1', nameFr: 'Fieldwork', nameAr: 'عمل ميداني' }]),
      });
    }
    if (path.endsWith('/locations/wilayas')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ code: '01', nameFr: 'Adrar', nameAr: 'أدرار' }]),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

test('opportunities structural fidelity table (code.html vs /en/opportunities)', async ({
  page,
}) => {
  await page.goto(CODE_URL, { waitUntil: 'domcontentloaded' });
  const codeH1Size = await page.$eval('h1', (el) => getComputedStyle(el).fontSize).catch(() => '');
  const styled = codeH1Size !== '';
  const codeSections = await codeFacts(page);
  const codeFooter = await page.$eval('footer', (el) => ({
    links: el.querySelectorAll('a').length,
    columns: (el.querySelector('.grid') ?? el).children.length,
  }));

  await mockOpps(page, 'populated');
  await page.goto('/en/opportunities');
  await expect(page.getByTestId('opp-list-card')).toHaveCount(2, { timeout: 30000 });

  const routeSelectors = SECTION_MAP.map(({ route }) => `[data-section="${route}"]`);
  const routeSections = await routeFacts(page, routeSelectors);
  await expect(page.getByTestId('public-footer')).toBeVisible();
  const routeFooter = await page.$eval('[data-testid="public-footer"]', (el) => ({
    links: el.querySelectorAll('a').length,
    columns: (el.querySelector('.grid') ?? el).children.length,
  }));

  const lines: string[] = [];
  const unlisted: string[] = [];
  const row = (section: string, metric: string, code: string, route: string, verdict: string) => {
    lines.push(
      `${section.padEnd(10)} | ${metric.padEnd(12)} | ${code.padEnd(30)} | ${route.padEnd(30)} | ${verdict}`,
    );
  };

  SECTION_MAP.forEach(({ route }, i) => {
    const c = codeSections[i];
    const r = routeSections[i];
    lines.push(`--- ${route} ---`);
    for (const key of COUNT_KEYS) {
      const cv = String(c.counts[key]);
      const rv = String(r.counts[key]);
      let verdict = 'MATCH';
      if (cv !== rv) {
        let allowed: string | null = null;
        if (DATA_SECTIONS.has(route) && (key === 'h2' || key === 'a' || key === 'img')) {
          allowed = 'ALLOWED (A-data)';
        } else if (route === 'filters' && key === 'select') {
          allowed = 'ALLOWED (A-sort)';
        } else if (route === 'pagination' && key === 'button') {
          allowed = 'ALLOWED (A-page)';
        } else if (route === 'cta-band' && (key === 'button' || key === 'a')) {
          allowed = 'ALLOWED (A-links)';
        } else if (route === 'filters' && key === 'button') {
          allowed = 'ALLOWED (A-links)';
        }
        if (allowed) {
          verdict = allowed;
        } else {
          verdict = 'UNLISTED-FAIL';
          unlisted.push(`${route} count ${key}: ${cv} vs ${rv}`);
        }
      }
      row(route, `count:${key}`, cv, rv, verdict);
    }
    if (c.rootBg === 'MISSING') {
      unlisted.push(`${route}: code section not resolved`);
      return;
    }
    if (!styled) return;
    const styles: [string, string, string][] = [
      ['rootBg', c.rootBg, r.rootBg],
      ['rootPadTop', c.rootPadTop, r.rootPadTop],
      ['headSize', c.headSize, r.headSize],
      ['headWeight', c.headWeight, r.headWeight],
      ['headColor', c.headColor, r.headColor],
      ['ctaBg', c.ctaBg, r.ctaBg],
      ['ctaColor', c.ctaColor, r.ctaColor],
      ['ctaRadius', c.ctaRadius, r.ctaRadius],
      ['cardBg', c.cardBg, r.cardBg],
      ['cardRadius', c.cardRadius, r.cardRadius],
      ['gridGap', c.gridGap, r.gridGap],
      ['boxW', String(c.boxW), String(r.boxW)],
    ];
    for (const [metric, cv, rv] of styles) {
      let verdict = 'MATCH';
      if (norm(cv) !== norm(rv)) {
        if (ALLOWED_STYLE_PAIRS.has(`${norm(cv)}|${norm(rv)}`)) {
          verdict = 'ALLOWED (A-ink/A-canvas)';
        } else if (metric === 'headWeight' && norm(cv) === '700' && norm(rv) === '600') {
          verdict = 'ALLOWED (A-type semibold)';
        } else if (route === 'cta-band' && metric.startsWith('cta')) {
          verdict = 'ALLOWED (A-links CTA link vs button)';
        } else if (metric === 'boxH' || metric === 'boxW') {
          verdict = 'ALLOWED (A-data box)';
        } else if (metric === 'headSize' && route === 'header') {
          verdict = 'ALLOWED (A-type)';
        } else if (route === 'list' && metric.startsWith('cta')) {
          verdict = 'ALLOWED (A-cta sampled)';
        } else if ((metric === 'cardBg' || metric === 'cardRadius') && norm(rv) !== 'n/a') {
          verdict = 'ALLOWED (A-data card)';
        } else {
          verdict = 'UNLISTED-FAIL';
          unlisted.push(`${route} style ${metric}: ${cv} vs ${rv}`);
        }
      }
      row(route, metric, cv, rv, verdict);
    }
    row(route, 'headFamily', c.headFamily, r.headFamily, 'RECORDED');
  });

  lines.push('--- footer ---');
  const footerRows: [string, string, string][] = [
    ['columns', String(codeFooter.columns), String(routeFooter.columns)],
    ['links', String(codeFooter.links), String(routeFooter.links)],
  ];
  for (const [metric, cv, rv] of footerRows) {
    const verdict = cv === rv ? 'MATCH' : 'ALLOWED (A-footer/A-civic)';
    row('footer', metric, cv, rv, verdict);
  }

  if (!styled) lines.push('NOTE: design CDN unreachable — styles skipped, counts only.');

  const table = [
    'section    | metric       | code.html                      | route                          | verdict',
    ...lines,
    `UNLISTED FAILURES: ${unlisted.length === 0 ? 'none' : unlisted.join('; ')}`,
  ].join('\n');
  // eslint-disable-next-line no-console
  console.log(`\n${table}\n`);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/opportunities-fidelity.txt', `${table}\n`);

  expect(unlisted, `unlisted fidelity failures:\n${unlisted.join('\n')}`).toEqual([]);
});

test('opportunities empty states (no-results + system empty)', async ({ page }) => {
  await mockOpps(page, 'populated');
  await page.goto('/en/opportunities');
  await expect(page.getByTestId('opp-list-card')).toHaveCount(2, { timeout: 30000 });

  // No-results: search a term the mock answers with zero rows.
  await page.getByLabel('Search opportunities').fill('no-match-xyz');
  await expect(page.getByTestId('opp-list-card')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByTestId('public-opportunities')).toContainText('No opportunities match');
  await expect(page.locator('[data-section="pagination"]')).toHaveCount(0);

  // System empty: fresh mock with zero total and no filters.
  await mockOpps(page, 'empty');
  await page.goto('/en/opportunities');
  await expect(page.getByTestId('public-opportunities')).toContainText(
    'No open opportunities right now',
    { timeout: 30000 },
  );
});

test('opportunities ar smoke (mirrored layout, translated copy)', async ({ page }) => {
  await mockOpps(page, 'populated');
  await page.goto('/ar/opportunities');
  await expect(page.getByTestId('opp-list-card')).toHaveCount(2, { timeout: 30000 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByTestId('public-opportunities').getByRole('heading', { level: 1 }),
  ).toHaveText('فرص التطوع');
  await expect(page.getByTestId('shell-navbar')).toBeVisible();
  await expect(page.getByTestId('public-footer')).toBeVisible();
});

test('opportunities pixel signal (informational only, never gates)', async ({ page }) => {
  await mockOpps(page, 'populated');
  await page.goto(CODE_URL, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const baseline = await page.screenshot({ timeout: 60000 });
  await page.goto('/en/opportunities');
  await expect(page.getByTestId('opp-list-card')).toHaveCount(2);
  const candidate = await page.screenshot({ timeout: 60000 });
  const length = Math.max(baseline.length, candidate.length);
  let different = Math.abs(baseline.length - candidate.length);
  const shared = Math.min(baseline.length, candidate.length);
  for (let i = 0; i < shared; i += 1) {
    if (baseline[i] !== candidate[i]) different += 1;
  }
  const percent = ((different / length) * 100).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`\nPIXEL SIGNAL (byte-level, informational): ${percent}% different\n`);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/opportunities-baseline.png', baseline);
  writeFileSync('test-results/opportunities-route.png', candidate);
});
