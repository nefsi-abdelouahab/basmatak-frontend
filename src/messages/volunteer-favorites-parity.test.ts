import { describe, expect, it } from 'vitest';
import volunteerFavoritesAr from './volunteer-favorites/ar.json';
import volunteerFavoritesEn from './volunteer-favorites/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('volunteer-favorites catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(volunteerFavoritesAr as Json).sort()).toEqual(
      keys(volunteerFavoritesEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(volunteerFavoritesEn as Json),
      ...leaves(volunteerFavoritesAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });
});
