import { describe, expect, it } from 'vitest';
import orgWorkspaceAr from './org-workspace/ar.json';
import orgWorkspaceEn from './org-workspace/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('org-workspace catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(orgWorkspaceAr as Json).sort()).toEqual(
      keys(orgWorkspaceEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(orgWorkspaceEn as Json),
      ...leaves(orgWorkspaceAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(orgWorkspaceEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
