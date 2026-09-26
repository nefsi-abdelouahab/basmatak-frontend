import { describe, expect, it } from 'vitest';
import volunteerCredentialsAr from './volunteer-credentials/ar.json';
import volunteerCredentialsEn from './volunteer-credentials/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('volunteer-credentials catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(volunteerCredentialsAr as Json).sort()).toEqual(
      keys(volunteerCredentialsEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(volunteerCredentialsEn as Json),
      ...leaves(volunteerCredentialsAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(volunteerCredentialsEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
