import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Structural contract for the request.ts auto-discovery loader (which itself
// uses webpack require.context and therefore cannot run under Vitest/Vite).
// This test asserts the on-disk shape the loader depends on, using plain fs:
// every messages/<area>/ directory carries both locale files, and directory
// names map to unique camelCase area keys. Adding a new area needs no edit
// here (subset assertion) and no edit to request.ts.

function toAreaKey(directory: string): string {
  return directory.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

const here = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.join(here, '..', 'messages');

function areaDirectories(): string[] {
  return fs
    .readdirSync(MESSAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('message catalog auto-discovery contract', () => {
  it('every area directory ships en.json + ar.json', () => {
    const areas = areaDirectories();
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      for (const locale of ['en', 'ar']) {
        const file = path.join(MESSAGES_DIR, area, `${locale}.json`);
        expect(fs.existsSync(file), `${area}/${locale}.json exists`).toBe(true);
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(typeof parsed, `${area}/${locale}.json parses to an object`).toBe('object');
      }
    }
  });

  it('directory names map to unique area keys', () => {
    const keys = areaDirectories().map(toAreaKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers all currently shipped areas', () => {
    const keys = new Set(areaDirectories().map(toAreaKey));
    for (const expected of [
      'auth',
      'common',
      'system',
      'opportunityDetails',
      'orgOnboarding',
      'submitContribution',
      'volunteerAccount',
      'volunteerCredentials',
      'volunteerHome',
      'volunteerTasks',
    ]) {
      expect(keys.has(expected), `area key ${expected} is discovered`).toBe(true);
    }
  });
});
