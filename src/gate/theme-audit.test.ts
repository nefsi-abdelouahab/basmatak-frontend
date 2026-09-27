import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '../theme/tokens';

// F19 gate check (1) — theme audit.
// Roadmap §2 mandate 1: single centralized theme derived from DESIGN.md
// tokens (primary #6D28D9, hover #5B21B6, status green/amber/error, radii).
// No hardcoded color/font/spacing value in any component outside src/theme/.

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

describe('F19 gate (1): theme audit', () => {
  it('tokens carry the mandated Disciplined Civic Network palette', () => {
    expect(tokens.colors.primary).toBe('#6D28D9');
    expect(tokens.colors.primaryHover).toBe('#5B21B6');
    expect(tokens.colors.surface).toBe('#FFFFFF');
    expect(tokens.colors.surfaceMuted).toBe('#F8FAFC');
    expect(tokens.colors.border).toBe('#E2E8F0');
    expect(tokens.colors.borderMuted).toBe('#F1F5F9');
    expect(tokens.colors.success).toBe('#16A34A');
    expect(tokens.colors.pending).toBe('#F59E0B');
    expect(tokens.colors.error).toBe('#DC2626');
    expect(tokens.colors.ink).toBe('#0F172A');
    expect(tokens.colors.inkMuted).toBe('#64748B');
    expect(tokens.radii.sm).toBe('0.375rem');
    expect(tokens.radii.md).toBe('0.5rem');
    expect(tokens.radii.lg).toBe('0.75rem');
  });

  it('tokens.css exposes one CSS variable per token', () => {
    const css = fs.readFileSync(path.join(SRC, 'theme', 'tokens.css'), 'utf8');
    for (const variable of [
      '--color-primary:',
      '--color-primary-hover:',
      '--color-surface:',
      '--color-surface-muted:',
      '--color-border:',
      '--color-border-muted:',
      '--color-success:',
      '--color-pending:',
      '--color-error:',
      '--color-ink:',
      '--color-ink-muted:',
      '--radius-sm:',
      '--radius-md:',
      '--radius-lg:',
    ]) {
      expect(css, `tokens.css defines ${variable}`).toContain(variable);
    }
  });

  it('tailwind config derives from tokens and holds no literals', () => {
    const config = fs.readFileSync(path.join(FRONTEND, 'tailwind.config.ts'), 'utf8');
    expect(config).toContain('tokens.colors');
    expect(config).toContain('tokens.radii');
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

  it('font-family literals live only in globals.css and reference theme vars', () => {
    const holders = sourceFiles().filter((file) =>
      fs.readFileSync(file, 'utf8').includes('font-family'),
    );
    expect(holders.map((file) => path.relative(SRC, file))).toEqual([path.join('app', 'globals.css')]);
    const globals = fs.readFileSync(path.join(SRC, 'app', 'globals.css'), 'utf8');
    expect(globals).toContain('var(--font-inter)');
    expect(globals).toContain('var(--font-plex-arabic)');
  });

  it('no physical directional utilities (RTL mirrors via logical properties)', () => {
    expect(violationsFor(/[^A-Za-z-][mp][lr]-/)).toEqual([]);
    expect(violationsFor(/text-(left|right)\b/)).toEqual([]);
    expect(violationsFor(/[^A-Za-z-](left|right)-\d/)).toEqual([]);
  });
});
