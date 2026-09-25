import { describe, expect, it } from 'vitest';
import commonAr from './common/ar.json';
import commonEn from './common/en.json';
import systemAr from './system/ar.json';
import systemEn from './system/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) =>
    keys(v, prefix === '' ? k : `${prefix}.${k}`),
  );
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

const areas = {
  common: { en: commonEn as Json, ar: commonAr as Json },
  system: { en: systemEn as Json, ar: systemAr as Json },
} as const;

describe('message catalog parity (en/ar per area)', () => {
  for (const [area, catalog] of Object.entries(areas)) {
    it(`${area}: identical key sets`, () => {
      expect(keys(catalog.ar).sort()).toEqual(keys(catalog.en).sort());
    });

    it(`${area}: no empty strings`, () => {
      for (const leaf of [...leaves(catalog.en), ...leaves(catalog.ar)]) {
        expect(leaf.trim().length).toBeGreaterThan(0);
      }
    });
  }
});
