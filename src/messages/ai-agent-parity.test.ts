import { describe, expect, it } from 'vitest';
import aiAgentAr from './ai-agent/ar.json';
import aiAgentEn from './ai-agent/en.json';

type Json = string | { [key: string]: Json };

function keys(value: Json, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keys(nested, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function leaves(value: Json): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(leaves);
}

function entries(value: Json, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  return Object.entries(value).flatMap(([key, nested]) =>
    entries(nested, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*([a-zA-Z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

describe('aiAgent catalog parity (en/ar)', () => {
  it('pins the Basma empty-state greeting in both locales', () => {
    expect(aiAgentEn.empty.title).toBe("Hi, I'm Basma. How can I help?");
    expect(aiAgentAr.empty.title).toBe('مرحباً، أنا بصمة. كيف أساعدك؟');
    expect(aiAgentEn.panel.subtitle).toBe('Basmatak Assistant');
    expect(aiAgentAr.panel.subtitle).toBe('مساعد بصمتك');
  });

  it('has identical key sets', () => {
    expect(keys(aiAgentAr as Json).sort()).toEqual(keys(aiAgentEn as Json).sort());
  });

  it('has no empty strings', () => {
    for (const leaf of [
      ...leaves(aiAgentEn as Json),
      ...leaves(aiAgentAr as Json),
    ]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps interpolation variables in sync', () => {
    const ar = new Map(entries(aiAgentAr as Json));
    for (const [key, message] of entries(aiAgentEn as Json)) {
      expect(placeholders(ar.get(key) ?? ''), key).toEqual(placeholders(message));
    }
  });

  it('translates every Arabic leaf', () => {
    for (const leaf of leaves(aiAgentAr as Json)) {
      expect(leaf).toMatch(/[\u0600-\u06ff]/);
    }
  });

  it('contains no placeholder values or theme leftovers', () => {
    for (const leaf of [
      ...leaves(aiAgentEn as Json),
      ...leaves(aiAgentAr as Json),
    ]) {
      expect(leaf).not.toMatch(/TODO|FIXME|Lorem/i);
      expect(leaf).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
