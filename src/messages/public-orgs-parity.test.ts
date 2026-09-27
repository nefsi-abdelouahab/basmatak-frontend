import { describe, expect, it } from 'vitest';
import publicOrgsAr from './public-orgs/ar.json';
import publicOrgsEn from './public-orgs/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

const FORBIDDEN = [
  'civic',
  'accredit',
  'ledger',
  'gazett',
  'dispatch',
  'statutory',
  'supervis',
  'audit',
  'Law 12-06',
  '12-06',
  'National Registry',
  'registry id',
];

describe('publicOrgs catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(publicOrgsAr as Json).sort()).toEqual(keys(publicOrgsEn as Json).sort());
  });

  it('no empty strings', () => {
    for (const leaf of [...leaves(publicOrgsEn as Json), ...leaves(publicOrgsAr as Json)]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme leftovers', () => {
    for (const leaf of leaves(publicOrgsEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('neutral surface: no registry/authority/civic vocabulary', () => {
    const haystacks = [...leaves(publicOrgsEn as Json), ...leaves(publicOrgsAr as Json)];
    for (const text of haystacks) {
      for (const word of FORBIDDEN) {
        expect(text.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
    expect(JSON.stringify(publicOrgsEn)).not.toMatch(/authority/i);
  });
});
