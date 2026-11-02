import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Scrollbar contract: one global rule hides every scrollbar, and no
// component/stylesheet re-enables or restyles one. Scrolling itself must stay
// on overflow (auto/scroll behavior), never `overflow: hidden`.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const GLOBALS = path.join(SRC, 'app', 'globals.css');

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

function relative(file: string): string {
  return path.relative(SRC, file).replaceAll('\\', '/');
}

describe('scrollbar audit', () => {
  it('defines one global, element-wide hidden-scrollbar rule', () => {
    const css = fs.readFileSync(GLOBALS, 'utf8');

    expect(css).toMatch(
      /(?:^|\n)\*\s*\{[^}]*scrollbar-width:\s*none;[^}]*\}/,
    );
    expect(css).toMatch(
      /(?:^|\n)\*\s*\{[^}]*-ms-overflow-style:\s*none;[^}]*\}/,
    );
    expect(css).toMatch(
      /(?:^|\n)\*\s*\{[^}]*scrollbar-gutter:\s*auto;[^}]*\}/,
    );
    expect(css).toMatch(
      /(?:^|\n)\*::-webkit-scrollbar\s*\{[^}]*display:\s*none;[^}]*width:\s*0;[^}]*height:\s*0;[^}]*background:\s*transparent;[^}]*\}/,
    );

    // Hiding scrollbars must never be done by suppressing overflow.
    expect(css).not.toMatch(/overflow(?:-[xy])?:\s*hidden/);
  });

  it('no component or stylesheet re-enables or restyles a scrollbar', () => {
    const violations: string[] = [];
    const forbidden =
      /::-webkit-scrollbar|scrollbar-width|scrollbar-color|scrollbar-gutter|scrollbar-(?:thin|auto|thumb|track)|overflow-[xy]:\s*scroll|overflow-[xy]-scroll/;

    for (const file of sourceFiles()) {
      const raw = stripComments(fs.readFileSync(file, 'utf8'));
      const code =
        file === GLOBALS
          ? raw
              .replace(/(?:^|\n)\*\s*\{[^}]*\}/g, '')
              .replace(/(?:^|\n)\*::-webkit-scrollbar\s*\{[^}]*\}/g, '')
          : raw;

      for (const [index, line] of code.split('\n').entries()) {
        if (forbidden.test(line)) {
          violations.push(`${relative(file)}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps overflow available for scrolling everywhere', () => {
    const overflowHidden = sourceFiles().flatMap((file) => {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      return code
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /overflow:\s*hidden/.test(line))
        .map(({ line, index }) => `${relative(file)}:${index + 1}: ${line.trim()}`);
    });

    // `overflow-hidden` on decorative/clipping wrappers is fine; the global
    // scrollbar rule must not rely on it. This assertion stays narrow: the
    // scrollbar contract itself never introduces an overflow suppression.
    expect(
      overflowHidden.filter((hit) => hit.includes('globals.css')),
    ).toEqual([]);
  });
});
