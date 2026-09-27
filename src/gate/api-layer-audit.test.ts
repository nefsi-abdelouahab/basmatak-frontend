import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// F19 gate check (3) — API-layer audit.
// Roadmap §2 mandate 3: one centralized axios layer (JWT attach,
// 401 refresh-and-retry, unified error shape), one typed function per backend
// endpoint consumed only via TanStack Query hooks. No ad-hoc fetch/axios in
// components or pages. Streamed downloads go through the single shared
// authed blob-download helper, never per-screen code.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const LIB_API = path.join(SRC, 'lib', 'api');

function allSourceFiles(): string[] {
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
      out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

function filesMatching(pattern: RegExp): string[] {
  return allSourceFiles().filter((file) => pattern.test(fs.readFileSync(file, 'utf8')));
}

function rel(file: string): string {
  return path.relative(SRC, file);
}

describe('F19 gate (3): API-layer audit', () => {
  it('no ad-hoc fetch() calls anywhere outside tests', () => {
    // Word-boundary match: TanStack refetch/prefetch helpers do not match.
    expect(filesMatching(/\bfetch\s*\(/).map(rel)).toEqual([]);
  });

  it('no XMLHttpRequest / sendBeacon side channels', () => {
    expect(filesMatching(/XMLHttpRequest|sendBeacon/).map(rel)).toEqual([]);
  });

  it('axios is imported only inside src/lib/api/', () => {
    const holders = filesMatching(/from\s+['"]axios['"]/);
    for (const file of holders) {
      expect(file.startsWith(LIB_API), `${rel(file)} must live under src/lib/api/`).toBe(true);
    }
    expect(holders.length).toBeGreaterThan(0);
  });

  it('axios.create happens exactly once (the F0 client factory)', () => {
    const creators = filesMatching(/axios\s*\.\s*create\s*\(/).map(rel);
    expect(creators).toEqual([path.join('lib', 'api', 'client.ts')]);
  });

  it('direct axios verbs hit only the two documented transports', () => {
    // Allowed: session.ts refresh POST (no instance yet at refresh time) and
    // the presigned byte-PUTs (must bypass the authed instance: no auth
    // headers, no /api/v1 base). Everything else flows through the instance.
    const allowed = new Set(
      ['media.ts', 'orgOpps.ts', 'organizations.ts', 'orgAccount.ts', 'session.ts'].map((name) =>
        path.join('lib', 'api', name),
      ),
    );
    const holders = filesMatching(/axios\s*\.\s*(get|post|put|patch|delete|request)\s*\(/).map(rel);
    for (const file of holders) {
      expect(allowed.has(file), `${file}: direct axios verb outside the allowlist`).toBe(true);
    }
    expect(holders.length).toBeGreaterThan(0);
  });

  it('no api./client. HTTP verb calls outside src/lib/api/', () => {
    const holders = filesMatching(/(\bapi\b|\bclient\b)\s*\.\s*(get|post|put|patch|delete|request)\s*\(/).filter(
      (file) => !file.startsWith(LIB_API),
    );
    expect(holders.map(rel)).toEqual([]);
  });

  it('streamed downloads funnel through the single downloadBlob helper', () => {
    const blobFiles = filesMatching(/responseType\s*:\s*['"]blob['"]/).map(rel);
    expect(blobFiles.length).toBeGreaterThan(0);
    for (const file of blobFiles) {
      const content = fs.readFileSync(path.join(SRC, file), 'utf8');
      expect(content, `${file}: blob adapter must call downloadBlob`).toContain('downloadBlob');
    }
    const objectUrls = filesMatching(/createObjectURL/).map(rel);
    expect(objectUrls).toEqual([path.join('lib', 'api', 'download.ts')]);
    const anchorDownloads = filesMatching(/\.download\s*=/).map(rel);
    expect(anchorDownloads).toEqual([path.join('lib', 'api', 'download.ts')]);
  });

  it('every hook module consumes the centralized layer (no endpoint logic in hooks)', () => {
    const hooksDir = path.join(SRC, 'hooks');
    const orphans: string[] = [];
    for (const entry of fs.readdirSync(hooksDir)) {
      if (!entry.endsWith('.ts') || entry.includes('.test.')) continue;
      const content = fs.readFileSync(path.join(hooksDir, entry), 'utf8');
      if (!content.includes('lib/api')) orphans.push(entry);
    }
    expect(orphans).toEqual([]);
  });

  it('every lib/api module exports at least one typed endpoint function', () => {
    const modules = fs
      .readdirSync(LIB_API)
      .filter((name) => name.endsWith('.ts') && !name.includes('.test.') && name !== 'index.ts');
    expect(modules.length).toBeGreaterThan(0);
    const empty: string[] = [];
    for (const name of modules) {
      const content = fs.readFileSync(path.join(LIB_API, name), 'utf8');
      if (!/export\s+(async\s+)?function\s+\w+/.test(content)) empty.push(name);
    }
    expect(empty).toEqual([]);
  });
});
