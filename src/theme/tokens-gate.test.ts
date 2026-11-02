import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssVariables, darkTokens, tokens } from './tokens';

const here = dirname(fileURLToPath(import.meta.url));

// Hex gate for mandate THEME: no literal color may live outside src/theme.
// Tokens themselves must match the warm Basmatak light palette.
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

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

describe('theme token gate', () => {
  it('matches the warm Basmatak light palette', () => {
    expect(tokens.colors.background).toBe('#FBF9F4');
    expect(tokens.colors.surface).toBe('#FFFFFF');
    expect(tokens.colors.surfaceMuted).toBe('#F4F0E6');
    expect(tokens.colors.border).toBe('#E9E3D3');
    expect(tokens.colors.ink).toBe('#14110D');
    expect(tokens.colors.inkMuted).toBe('#5C5548');
    expect(tokens.colors.gold).toBe('#D4A62A');
    expect(tokens.colors.goldHover).toBe('#C29622');
    expect(tokens.colors.goldStrong).toBe('#8A6508');
    expect(tokens.colors.goldSoft).toBe('#F6ECCB');
    expect(tokens.colors.onGold).toBe('#14110D');
    expect(tokens.colors.primary).toBe('#14110D');
    expect(tokens.colors.primaryHover).toBe('#2A251E');
    expect(tokens.colors.onPrimary).toBe('#FFFFFF');
    expect(tokens.colors.success).toBe('#2D6A4F');
    expect(tokens.colors.pending).toBe('#F59E0B');
    expect(tokens.colors.error).toBe('#DC2626');
    expect(tokens.colors.errorWarm).toBe('#B44034');
    expect(tokens.colors.overlay).toBe('#14110D');
    expect(tokens.colors.onOverlay).toBe('#FFFFFF');
    // Radii 12/8/6: cards lg, inputs/buttons md, chips sm.
    expect(tokens.radii).toEqual({ sm: '0.375rem', md: '0.5rem', lg: '0.75rem' });
    expect(tokens.shadows.sm).toBe('0 1px 2px 0 rgba(17, 24, 39, 0.04)');
  });

  it('defines opt-in dark equivalents through the same token names', () => {
    expect(Object.keys(darkTokens.colors).sort()).toEqual(
      Object.keys(tokens.colors).sort(),
    );
    expect(darkTokens.colors.background).toBe('#14110D');
    expect(darkTokens.colors.surface).toBe('#211D17');
    expect(darkTokens.colors.surfaceMuted).toBe('#1B1712');
    expect(darkTokens.colors.ink).toBe('#F5F0E6');
    expect(darkTokens.colors.gold).toBe('#E4BC4E');
    expect(darkTokens.colors.goldStrong).toBe('#E0B84A');
    expect(darkTokens.colors.success).toBe('#7FC49A');
    expect(darkTokens.colors.errorWarm).toBe('#EE9A8B');
  });

  it('tokens.css mirrors every light and dark value without auto dark mode', () => {
    const css = readFileSync(join(here, 'tokens.css'), 'utf8').toLowerCase();
    for (const value of [
      ...Object.values(tokens.colors),
      ...Object.values(darkTokens.colors),
    ]) {
      expect(css, `tokens.css contains ${value}`).toContain(value.toLowerCase());
    }
    expect(css).toContain('color-scheme: light');
    expect(css).toContain("html[data-theme='dark']");
    expect(css).not.toContain('prefers-color-scheme');
    for (const name of Object.keys(tokens.colors)) {
      const variable = kebab(name);
      expect(css, `tokens.css defines --color-${variable}`).toContain(
        `--color-${variable}:`,
      );
      expect(css, `tokens.css defines --color-${variable}-rgb`).toContain(
        `--color-${variable}-rgb:`,
      );
    }
    expect(css, 'tokens.css defines the shared header height').toContain(
      '--header-height: 4rem',
    );
  });

  it('tailwind colours are backed by the token CSS variables', () => {
    for (const name of Object.keys(tokens.colors)) {
      const variable = kebab(name);
      expect(cssVariables[name as keyof typeof cssVariables]).toContain(
        `var(--color-${variable}-rgb)`,
      );
    }
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
