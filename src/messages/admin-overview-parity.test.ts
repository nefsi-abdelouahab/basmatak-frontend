import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import adminOverviewAr from './admin-overview/ar.json';
import adminOverviewEn from './admin-overview/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) =>
    keys(v, prefix === '' ? k : `${prefix}.${k}`),
  );
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

// Copy discipline for the admin dashboard rebuild: the civic-sync and
// compliance framing is dropped, not renamed, and every fabricated design
// token is gone. The queue stays a neutral icon-led list with no pill
// badges and no sanction or enforcement vocabulary. `registryId` (the real
// VOL-/ORG-/OPP-/EXP- display format) is explicitly NOT banned — only its
// fabricated cousins and civic-ledger verbs are.
const FORBIDDEN_COPY = [
  /12-06/,
  /DZ-NAT/,
  /DZ-VOL/,
  /civil registry/i,
  /registry sync/i,
  /anchored/i,
  /minted/i,
  /statute/i,
  /compliance\s*%/i,
  /statutory/i,
  /sanction/i,
  /secretariat/i,
  /mandate/i,
];

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

/**
 * Strips comments before the copy scan. The module and page comments legitimately
 * name the forbidden vocabulary in order to document that it is banned; scanning
 * raw source would flag that meta-commentary instead of real UI copy. The
 * `[^:]` guard keeps a `//` inside a URL (`https://`) from starting a comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('admin-overview catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(adminOverviewAr as Json).sort()).toEqual(keys(adminOverviewEn as Json).sort());
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(adminOverviewEn as Json),
      ...leaves(adminOverviewAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme colors', () => {
    for (const leaf of leaves(adminOverviewEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('no civic-sync, compliance, or sanction vocabulary in either catalog', () => {
    for (const leaf of [
      ...leaves(adminOverviewEn as Json),
      ...leaves(adminOverviewAr as Json),
    ]) {
      for (const pattern of FORBIDDEN_COPY) {
        expect(leaf).not.toMatch(pattern);
      }
    }
  });

  it('labels the queue as a neutral review list', () => {
    expect((adminOverviewEn as Json) as Record<string, Json>).toBeTruthy();
    const en = adminOverviewEn as unknown as { queue: { title: string } };
    const ar = adminOverviewAr as unknown as { queue: { title: string } };
    expect(en.queue.title).toBe('Requires attention');
    expect(ar.queue.title.length).toBeGreaterThan(0);
  });

  it('carries no badge or pill vocabulary in queue copy', () => {
    const en = adminOverviewEn as unknown as { queue: Record<string, string> };
    for (const leaf of Object.values(en.queue)) {
      expect(leaf).not.toMatch(/badge/i);
      expect(leaf).not.toMatch(/pill/i);
    }
  });
});

describe('admin-overview source copy discipline', () => {
  const sources = [
    '../app/[locale]/admin/dashboard/AdminDashboardPage.tsx',
    '../app/[locale]/admin/dashboard/page.tsx',
    '../components/shell/Sidebar.tsx',
    '../components/shell/BottomNav.tsx',
    '../components/shell/Navbar.tsx',
    '../lib/api/adminAnalytics.ts',
    '../hooks/useAdminAnalytics.ts',
  ];

  it('no civic-sync, compliance, or sanction vocabulary in the dashboard sources', () => {
    for (const relativePath of sources) {
      const source = stripComments(readSource(relativePath));
      for (const pattern of FORBIDDEN_COPY) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it('no hardcoded JSX copy — dashboard strings come from the catalog', () => {
    const page = stripComments(readSource('../app/[locale]/admin/dashboard/AdminDashboardPage.tsx'));
    // Every rendered label resolves through the session's own namespace.
    expect(page).toContain("useTranslations('adminOverview')");
    // No JSX text node may carry a literal English sentence.
    expect(page).not.toMatch(/>\s*[A-Z][a-z]+(?:\s+[a-z]+){1,}\s*</);
  });

  it('no hardcoded figure rendered as a JSX text node', () => {
    const page = stripComments(readSource('../app/[locale]/admin/dashboard/AdminDashboardPage.tsx'));
    // A digit sitting directly in the markup is a figure typed into the UI
    // instead of read from a response field. Backend figures must arrive via
    // a mapped value, never as a literal between JSX tags.
    expect(page).not.toMatch(/>\s*\d+(?:[.,]\d+)?\s*</);
  });

  it('backend figures are mapped, not returned as literals', () => {
    const api = stripComments(readSource('../lib/api/adminAnalytics.ts'));
    // The render mappers hand back values derived from their input. A helper
    // that short-circuits to a bare number would be a hardcoded figure.
    const numericReturns = api.match(/return\s+-?\d+(?:\.\d+)?\s*;/g) ?? [];
    // `seriesMax` legitimately answers 0 for an empty window, and clamp bounds
    // are named constants. Nothing else may return a bare number.
    expect(numericReturns.length).toBeLessThanOrEqual(1);
  });
});
