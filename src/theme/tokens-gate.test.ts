import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tokens } from './tokens';

const here = dirname(fileURLToPath(import.meta.url));

// Hex gate for mandate THEME: no literal color may live outside src/theme.
// Tokens themselves must match design/system-design.md frontmatter.
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('theme token gate', () => {
  it('matches DESIGN.md core values', () => {
    expect(tokens.colors.primary).toBe('#6D28D9');
    expect(tokens.colors.primaryHover).toBe('#5B21B6');
    expect(tokens.colors.tint).toBe('#F5F3FF');
    expect(tokens.colors.surface).toBe('#FFFFFF');
    expect(tokens.colors.surfaceMuted).toBe('#F8FAFC');
    expect(tokens.colors.border).toBe('#E2E8F0');
    expect(tokens.colors.borderMuted).toBe('#F1F5F9');
    expect(tokens.colors.success).toBe('#16A34A');
    expect(tokens.colors.pending).toBe('#F59E0B');
    expect(tokens.colors.error).toBe('#DC2626');
    expect(tokens.colors.ink).toBe('#111827');
    expect(tokens.colors.inkMuted).toBe('#64748B');
    // Radii 12/8/6: cards lg, inputs/buttons md, chips sm.
    expect(tokens.radii).toEqual({ sm: '0.375rem', md: '0.5rem', lg: '0.75rem' });
    expect(tokens.shadows.sm).toBe('0 1px 2px 0 rgba(17, 24, 39, 0.04)');
  });

  it('no hex literals outside src/theme', () => {
    const roots = [join(here, '..', 'app'), join(here, '..', 'components')];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const text = readFileSync(file, 'utf8');
        if (HEX.test(text)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
