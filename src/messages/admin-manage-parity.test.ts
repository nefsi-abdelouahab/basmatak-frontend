import { describe, expect, it } from 'vitest';
import adminManageAr from './admin-manage/ar.json';
import adminManageEn from './admin-manage/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('admin-manage catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(adminManageAr as Json).sort()).toEqual(
      keys(adminManageEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [...leaves(adminManageEn as Json), ...leaves(adminManageAr as Json)]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(adminManageEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('no invented admin states in copy', () => {
    const banned = ['pending-incomplete', 'legal review', 'flagged', 'law 12-06 seal', 'request info'];
    for (const leaf of leaves(adminManageEn as Json)) {
      for (const word of banned) {
        expect(leaf.toLowerCase()).not.toContain(word);
      }
    }
  });
});
