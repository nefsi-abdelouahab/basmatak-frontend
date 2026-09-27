import { describe, expect, it } from 'vitest';
import orgAccountAr from './org-account/ar.json';
import orgAccountEn from './org-account/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('org-account catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(orgAccountAr as Json).sort()).toEqual(keys(orgAccountEn as Json).sort());
  });

  it('no empty strings', () => {
    for (const leaf of [...leaves(orgAccountEn as Json), ...leaves(orgAccountAr as Json)]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(orgAccountEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('carries no statute, legal-accreditation, or talent-directory copy', () => {
    const banned = [/law 12-06/i, /statute/i, /discover talents/i, /national .*registry/i];
    for (const leaf of [...leaves(orgAccountEn as Json), ...leaves(orgAccountAr as Json)]) {
      for (const pattern of banned) expect(leaf).not.toMatch(pattern);
    }
  });
});
