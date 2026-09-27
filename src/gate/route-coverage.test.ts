import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// F19 gate check (4) — route-coverage pin: the responsive matrix
// (e2e/gate-responsive.spec.ts) must enumerate every page route in src/app.
// Adding a route without extending the matrix turns this test red.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const FRONTEND = path.join(SRC, '..');

function pageRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name === 'page.tsx') routes.push(path.dirname(full));
    }
  };
  walk(path.join(SRC, 'app'));
  return routes.sort();
}

describe('F19 gate (4): responsive matrix covers every route', () => {
  it('every page route is enumerated in the responsive matrix', () => {
    const spec = fs.readFileSync(path.join(FRONTEND, 'e2e', 'gate-responsive.spec.ts'), 'utf8');
    const missing: string[] = [];
    for (const dir of pageRoutes()) {
      const rel = path.relative(path.join(SRC, 'app'), dir);
      const segments = rel.split(path.sep);
      // Locale wrapper + root layout carry no URL of their own.
      if (segments.length === 1 && (segments[0] === '[locale]' || segments[0] === '')) continue;
      const urlPath = segments
        .filter((segment) => segment !== '[locale]')
        .map((segment) => {
          if (/^\(.*\)$/.test(segment)) return null;
          if (segment === '[...rest]') return '/does-not-exist-f19';
          if (/^\[.*\]$/.test(segment)) return null;
          return `/${segment}`;
        })
        .filter((segment): segment is string => segment !== null)
        .join('');
      if (urlPath === '') continue;
      // Dynamic parents are covered by their concrete probes below.
      if (/\[(idOrSlug|slug|username|applicationId|participationId|submissionId|id|state)\]/.test(rel)) {
        continue;
      }
      if (!spec.includes(`'${urlPath}`)) missing.push(`${rel} → ${urlPath || '/'}`);
    }
    // Concrete probes for every dynamic segment + the locale home + catch-all.
    // (The matrix builds dynamic URLs from an ID const via template literals,
    // so probes match the `${ID}` form used in the spec source.)
    for (const probe of [
      "'/'",
      '/opportunities/test-opportunity',
      '/orgs/test-org',
      '/volunteers/testuser',
      '/org/applications/${ID}',
      '/org/contributions/${ID}',
      '/org/opportunities/${ID}',
      '/org/participants/${ID}',
      '/volunteer/applications/${ID}',
      '/volunteer/opportunities/test-opportunity',
      '/volunteer/tasks/${ID}',
      '/volunteer/tasks/${ID}/submit',
      '/system/not-found',
      '/does-not-exist-f19',
      '/reset-password?token=probe',
      '/verify-email?token=probe',
    ]) {
      if (!spec.includes(probe)) missing.push(`probe ${probe}`);
    }
    expect(missing).toEqual([]);
  });
});
