import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// F19 gate check (6) — contract spot-checks, static half (the behavioral half
// lives in e2e/gate-contract.spec.ts).
// Pins the §2 cross-cutting contracts + neutral-surface rules: registryId
// display-only, consent gate, 2-step upload with progress, guest redirects,
// streamed downloads, and no messaging/ranking/portfolio-page/verify-page
// affordances, perks/logistics inputs, or civic-narrative copy.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');

function allCodeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
      if (path.relative(SRC, full).startsWith('messages')) continue;
      out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

function stripComments(code: string): string {
  return code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"A-Za-z0-9_$])\/\/.*$/gm, '$1');
}

// Civic-narrative / cut-feature vocabulary. Comments documenting a CUT are
// fine (stripped above); live code or user-facing copy containing any of
// these fails the neutral-surface rule.
const FORBIDDEN = [
  'national ledger',
  'verify on national',
  'message coordinator',
  'send message',
  'start a conversation',
  'perks',
  'logistics',
  'leaderboard',
  'ranking',
  'statutory sanction',
  'contact secretariat',
  '12-06',
  'audited 100%',
  '500 mb',
];

describe('F19 gate (6): contract spot-checks (static)', () => {
  it('no forbidden affordances or civic-narrative copy in live code', () => {
    const violations: string[] = [];
    for (const file of allCodeFiles()) {
      const code = stripComments(fs.readFileSync(file, 'utf8')).toLowerCase();
      for (const term of FORBIDDEN) {
        if (code.includes(term)) violations.push(`${path.relative(SRC, file)}: ${term}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('registryId is display-only: never a route key or link target', () => {
    const violations: string[] = [];
    for (const file of allCodeFiles()) {
      if (!file.endsWith('.tsx')) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/registryId/i.test(line) && /(href|router\.push|redirect|Link)/.test(line)) {
          violations.push(`${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('no /verify proof page route (verification links stay inline deep-links)', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (entry.name === 'page.tsx' && path.basename(path.dirname(full)) === 'verify') {
          offenders.push(path.relative(SRC, full));
        }
      }
    };
    walk(path.join(SRC, 'app'));
    expect(offenders).toEqual([]);
  });

  it('no standalone public portfolio page (self-management route is the only one)', () => {
    expect(
      fs.existsSync(path.join(SRC, 'app', '[locale]', '(public)', 'portfolio')),
      'a (public)/portfolio route must not exist',
    ).toBe(false);
    expect(
      fs.existsSync(path.join(SRC, 'app', '[locale]', 'volunteer', 'portfolio', 'page.tsx')),
      'the F8 self-management portfolio route must still exist',
    ).toBe(true);
  });

  it('no chat/messaging component files', () => {
    const offenders = allCodeFiles()
      .filter((file) => /chat/i.test(path.basename(file)))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('consent gate is wired into the contribution flow', () => {
    const page = fs.readFileSync(
      path.join(
        SRC,
        'app',
        '[locale]',
        'volunteer',
        'tasks',
        '[participationId]',
        'submit',
        'SubmitContributionPage.tsx',
      ),
      'utf8',
    );
    expect(page).toContain('consentConfirmed');
    expect(page).toContain('disabled');
  });

  it('single 2-step upload shape (create → PUT bytes with progress → confirm, ≤5 MB)', () => {
    const media = fs.readFileSync(path.join(SRC, 'lib', 'api', 'media.ts'), 'utf8');
    expect(media).toContain('export async function createMediaUpload');
    expect(media).toContain('export async function confirmMediaUpload');
    expect(media).toContain('export async function uploadMedia');
    expect(media).toContain('MAX_MEDIA_BYTES');
    expect(media).toContain('onProgress');
  });

  it('guest authed-action redirect helper is the decision-10 single path', () => {
    const session = fs.readFileSync(path.join(SRC, 'hooks', 'useSession.ts'), 'utf8');
    expect(session).toContain('export function getLoginHref');
    expect(session).toContain('/login?next=');
  });

  it('streamed downloads expose exactly one shared helper', () => {
    const download = fs.readFileSync(path.join(SRC, 'lib', 'api', 'download.ts'), 'utf8');
    expect(download).toContain('export async function downloadBlob');
    expect(download).toContain('export function parseContentDisposition');
  });
});
