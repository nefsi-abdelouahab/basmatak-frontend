import { describe, expect, it } from 'vitest';
import verifyAr from './verify/ar.json';
import verifyEn from './verify/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

const en = leaves(verifyEn as Json);
const ar = leaves(verifyAr as Json);

describe('verify catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(verifyAr as Json).sort()).toEqual(keys(verifyEn as Json).sort());
  });

  it('no empty strings', () => {
    for (const leaf of [...en, ...ar]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('ships no hardcoded-theme colors', () => {
    for (const leaf of en) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
