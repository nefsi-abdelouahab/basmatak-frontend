import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routing } from '../i18n/routing';

// F19 gate check (2) — i18n audit.
// Roadmap §2 mandate 2: next-intl with en+ar catalogs, no hardcoded UI
// strings in JSX, RTL-correct at locale=ar (logical properties, mirrored
// layout, Arabic font swap).

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const MESSAGES = path.join(SRC, 'messages');

type Json = string | { [key: string]: Json };

function areaDirs(): string[] {
  return fs
    .readdirSync(MESSAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function keysOf(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keysOf(nested, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function leavesOf(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leavesOf);
}

function tsxFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

// Documented exception: the root error boundary renders only when the layout
// itself (including the next-intl provider) has crashed, so catalogs are
// unavailable by definition. Static English here, never extended.
const GLOBAL_ERROR = path.join('app', 'global-error.tsx');

describe('F19 gate (2): i18n audit', () => {
  it('every message area ships en+ar with identical key sets', () => {
    const areas = areaDirs();
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      const en = JSON.parse(fs.readFileSync(path.join(MESSAGES, area, 'en.json'), 'utf8')) as Json;
      const ar = JSON.parse(fs.readFileSync(path.join(MESSAGES, area, 'ar.json'), 'utf8')) as Json;
      expect(keysOf(ar).sort(), `${area}: ar/en key parity`).toEqual(keysOf(en).sort());
    }
  });

  it('no empty catalog strings in either locale', () => {
    const empty: string[] = [];
    for (const area of areaDirs()) {
      for (const locale of ['en', 'ar'] as const) {
        const catalog = JSON.parse(
          fs.readFileSync(path.join(MESSAGES, area, `${locale}.json`), 'utf8'),
        ) as Json;
        for (const leaf of leavesOf(catalog)) {
          if (leaf.trim().length === 0) empty.push(`${area}/${locale}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it('no hardcoded JSX text nodes (except the provider-less root boundary)', () => {
    const violations: string[] = [];
    for (const file of tsxFiles()) {
      if (path.relative(SRC, file) === GLOBAL_ERROR) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        // Same-line JSX text heuristic. The (?<!=) guard skips arrow
        // functions; the CODE_CHARS veto skips TS generics/expressions
        // (e.g. `new Set<string>(…) : new Set<string>(…)`), which are code,
        // never rendered copy. Multiline text nodes are covered by review.
        const match = /(?<!=)>[^<>{}]*[A-Za-z]{3,}[^<>{}]*</.exec(line);
        if (!match) return;
        const inner = match[0].slice(1, -1);
        if (/[()[\]?;=:*/|&$#@%^`~\\]/.test(inner)) return;
        violations.push(`${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(violations).toEqual([]);
  });

  it('no hardcoded UI-string attributes (title/label/placeholder/alt)', () => {
    const violations: string[] = [];
    const pattern = /(?<![A-Za-z-])(title|label|placeholder|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/;
    for (const file of tsxFiles()) {
      if (path.relative(SRC, file) === GLOBAL_ERROR) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const match = pattern.exec(line);
        if (match) violations.push(`${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`);
      });
    }
    // KNOWN F19 FINDING (spawns a frontend-fix-* change, archived F5 stays shut):
    // src/app/[locale]/volunteer/opportunities/[idOrSlug]/OpportunityDetailsPage.tsx:290
    // renders <MetaItem title="Mode"> — the mode label title bypasses the
    // opportunityDetails catalog (which already holds modeOnsite/modeRemote/
    // modeHybrid but no mode title key), so the ar locale shows English "Mode".
    expect(violations).toEqual([]);
  });

  it('RTL: en+ar routing, dir wiring, logical-property discipline', () => {
    expect(routing.locales).toEqual(['en', 'ar']);
    expect(routing.defaultLocale).toBe('en');
    const layout = fs.readFileSync(path.join(SRC, 'app', '[locale]', 'layout.tsx'), 'utf8');
    expect(layout).toContain(`dir={locale === 'ar' ? 'rtl' : 'ltr'}`);
    expect(layout).toContain('lang={locale}');
    const globals = fs.readFileSync(path.join(SRC, 'app', 'globals.css'), 'utf8');
    expect(globals).toMatch(/logical properties/i);
  });
});
