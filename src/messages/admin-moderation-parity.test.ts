import { describe, expect, it } from 'vitest';
import adminModerationAr from './admin-moderation/ar.json';
import adminModerationEn from './admin-moderation/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('admin-moderation catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(adminModerationAr as Json).sort()).toEqual(
      keys(adminModerationEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [...leaves(adminModerationEn as Json), ...leaves(adminModerationAr as Json)]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(adminModerationEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('no sanction vocabulary in either catalog', () => {
    const forbidden = [/statutory sanction/i, /100%\s*compliance/i, /contact secretariat/i];
    for (const leaf of [...leaves(adminModerationEn as Json), ...leaves(adminModerationAr as Json)]) {
      for (const pattern of forbidden) {
        expect(leaf).not.toMatch(pattern);
      }
    }
  });
});
