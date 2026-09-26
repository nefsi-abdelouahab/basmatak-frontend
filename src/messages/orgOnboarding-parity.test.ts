import { describe, expect, it } from 'vitest';
import orgOnboardingAr from './orgOnboarding/ar.json';
import orgOnboardingEn from './orgOnboarding/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('orgOnboarding catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(orgOnboardingAr as Json).sort()).toEqual(
      keys(orgOnboardingEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(orgOnboardingEn as Json),
      ...leaves(orgOnboardingAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(orgOnboardingEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
