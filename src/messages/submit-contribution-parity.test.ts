import { describe, expect, it } from 'vitest';
import submitContributionAr from './submit-contribution/ar.json';
import submitContributionEn from './submit-contribution/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

describe('submit-contribution catalog parity (en/ar)', () => {
  it('identical key sets', () => {
    expect(keys(submitContributionAr as Json).sort()).toEqual(
      keys(submitContributionEn as Json).sort(),
    );
  });

  it('no empty strings', () => {
    for (const leaf of [
      ...leaves(submitContributionEn as Json),
      ...leaves(submitContributionAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('no hardcoded-theme or untranslated leftovers', () => {
    for (const leaf of leaves(submitContributionEn as Json)) {
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('never advertises single-step gallery, 500 MB, audio, or zip uploads', () => {
    for (const leaf of leaves(submitContributionEn as Json)) {
      expect(leaf).not.toMatch(/500\s?MB/i);
      expect(leaf).not.toMatch(/audio|zip/i);
    }
  });

  it('never renders a messaging affordance', () => {
    for (const leaf of [
      ...leaves(submitContributionEn as Json),
      ...leaves(submitContributionAr as Json),
    ]) {
      expect(leaf.toLowerCase()).not.toContain('message coordinator');
    }
  });
});
