import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { darkTokens, tokens } from '../theme/tokens';

// F19 gate check (1) — theme audit.
// Roadmap §2 mandate 1: single centralized theme derived from the warm Basmatak
// light tokens (background #FBF9F4, gold #D4A62A, gold-strong #8A6508,
// status green/amber/error, radii). No hardcoded color/font/spacing value in
// any component outside src/theme/.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const FRONTEND = path.join(SRC, '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|css)$/.test(entry.name)) continue;
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
      if (path.relative(SRC, full).startsWith('theme')) continue;
      out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"A-Za-z0-9_$])\/\/.*$/gm, '$1');
}

function violationsFor(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of sourceFiles()) {
    const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (pattern.test(line)) found.push(`${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`);
    });
  }
  return found;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

describe('F19 gate (1): theme audit', () => {
  it('tokens carry the warm Basmatak light palette', () => {
    expect(tokens.colors.background).toBe('#FBF9F4');
    expect(tokens.colors.surface).toBe('#FFFFFF');
    expect(tokens.colors.surfaceMuted).toBe('#F4F0E6');
    expect(tokens.colors.border).toBe('#E9E3D3');
    expect(tokens.colors.ink).toBe('#14110D');
    expect(tokens.colors.inkMuted).toBe('#5C5548');
    expect(tokens.colors.gold).toBe('#D4A62A');
    expect(tokens.colors.goldStrong).toBe('#8A6508');
    expect(tokens.colors.goldSoft).toBe('#F6ECCB');
    expect(tokens.colors.onGold).toBe('#14110D');
    expect(tokens.colors.primary).toBe('#14110D');
    expect(tokens.colors.primaryHover).toBe('#2A251E');
    expect(tokens.colors.onPrimary).toBe('#FFFFFF');
    expect(tokens.colors.success).toBe('#2D6A4F');
    expect(tokens.colors.pending).toBe('#F59E0B');
    expect(tokens.colors.error).toBe('#DC2626');
    expect(tokens.colors.overlay).toBe('#14110D');
    expect(tokens.colors.onOverlay).toBe('#FFFFFF');
    expect(tokens.radii.sm).toBe('0.375rem');
    expect(tokens.radii.md).toBe('0.5rem');
    expect(tokens.radii.lg).toBe('0.75rem');
  });

  it('dark mode overrides every colour through the same variables', () => {
    expect(Object.keys(darkTokens.colors).sort()).toEqual(
      Object.keys(tokens.colors).sort(),
    );
    expect(darkTokens.colors.background).toBe('#14110D');
    expect(darkTokens.colors.surface).toBe('#211D17');
    expect(darkTokens.colors.surfaceMuted).toBe('#1B1712');
    expect(darkTokens.colors.gold).toBe('#E4BC4E');
    expect(darkTokens.colors.goldStrong).toBe('#E0B84A');
    expect(darkTokens.colors.ink).toBe('#F5F0E6');
  });

  it('tokens.css exposes one CSS variable per token, light by default', () => {
    const css = fs.readFileSync(path.join(SRC, 'theme', 'tokens.css'), 'utf8');
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
    for (const variable of ['--radius-sm:', '--radius-md:', '--radius-lg:']) {
      expect(css, `tokens.css defines ${variable}`).toContain(variable);
    }
  });

  it('tailwind config derives from tokens and holds no literals', () => {
    const config = fs.readFileSync(path.join(FRONTEND, 'tailwind.config.ts'), 'utf8');
    expect(config).toContain('cssVariables');
    expect(config).toContain('tokens.radii');
    expect(config).toContain('tokens.fontSize');
    expect(config).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('no hex color literals outside src/theme/', () => {
    expect(violationsFor(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
  });

  it('no rgb()/hsl() color literals outside src/theme/', () => {
    expect(violationsFor(/\brgba?\s*\(|\bhsla?\s*\(/)).toEqual([]);
  });

  it('no Tailwind arbitrary color classes outside src/theme/', () => {
    expect(violationsFor(/\[#[0-9a-fA-F]/)).toEqual([]);
  });

  it('no untokenized Tailwind palette utilities outside src/theme/', () => {
    const palette =
      /\b(?:bg|text|border|ring|outline|from|to|via|fill|stroke|decoration|placeholder|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/;
    expect(violationsFor(palette)).toEqual([]);
  });

  it('no purple/violet/indigo references outside src/theme/', () => {
    expect(violationsFor(/purple|violet|indigo/i)).toEqual([]);
  });

  it('font-family literals live only in globals.css and reference theme vars', () => {
    const holders = sourceFiles().filter((file) =>
      fs.readFileSync(file, 'utf8').includes('font-family'),
    );
    expect(holders.map((file) => path.relative(SRC, file))).toEqual([path.join('app', 'globals.css')]);
    const globals = fs.readFileSync(path.join(SRC, 'app', 'globals.css'), 'utf8');
    expect(globals).toContain('var(--font-inter)');
    expect(globals).toContain('var(--font-tajawal)');
    expect(globals).toContain("html[lang='ar'] body");
    expect(globals).toContain('line-height: 1.7');
    expect(globals).not.toContain('var(--font-plex-arabic)');
  });

  it('no physical directional utilities (RTL mirrors via logical properties)', () => {
    expect(violationsFor(/[^A-Za-z-][mp][lr]-/)).toEqual([]);
    expect(violationsFor(/text-(left|right)\b/)).toEqual([]);
    expect(violationsFor(/[^A-Za-z-](left|right)-\d/)).toEqual([]);
  });
});
