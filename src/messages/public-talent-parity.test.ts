import { describe, expect, it } from 'vitest';
import publicTalentAr from './public-talent/ar.json';
import publicTalentEn from './public-talent/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

const en = leaves(publicTalentEn as Json);
const ar = leaves(publicTalentAr as Json);

// Banned vocabulary (F17 acceptance): surname rendering, verification tiers,
// registry-membership claims, endorsement/credential counts, and
// civic-registry / supervisory-authority / audit wording.
const FORBIDDEN: RegExp[] = [
  /national ledger/i,
  /civic registry/i,
  /member since/i,
  /membre depuis/i,
  /joined/i,
  /verified contributor/i,
  /identity verified/i,
  /level\s*\d+\s*verified/i,
  /endorsement/i,
  /audit/i,
  /supervisory/i,
  /ledger/i,
];

describe('public-talent catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(publicTalentAr as Json).sort()).toEqual(keys(publicTalentEn as Json).sort());
  });

  it('no empty strings', () => {
    for (const leaf of [...en, ...ar]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme leftovers', () => {
    for (const leaf of en) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('carries no forbidden civic/tier/membership vocabulary in either locale', () => {
    for (const leaf of [...en, ...ar]) {
      for (const pattern of FORBIDDEN) {
        expect(leaf, `banned pattern ${pattern} in "${leaf}"`).not.toMatch(pattern);
      }
    }
  });

  it('ships no member-since string at all', () => {
    expect([...keys(publicTalentEn as Json), ...keys(publicTalentAr as Json)].join('|')).not.toMatch(
      /member|since|joined/i,
    );
  });
});
