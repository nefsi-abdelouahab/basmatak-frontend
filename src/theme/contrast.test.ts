import { describe, expect, it } from 'vitest';
import { darkTokens, tokens } from './tokens';

// WCAG 2.x relative luminance / contrast ratio. The identity requires readable
// text and gold pairings in both palettes, so these are hard gates rather than
// advisory snapshots.

type Palette = Record<string, string>;

function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const red = channelLuminance(Number.parseInt(value.slice(0, 2), 16));
  const green = channelLuminance(Number.parseInt(value.slice(2, 4), 16));
  const blue = channelLuminance(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const PAIRS: Array<{
  label: string;
  foreground: string;
  background: string;
}> = [
  { label: 'text/background', foreground: 'ink', background: 'background' },
  { label: 'muted/background', foreground: 'inkMuted', background: 'background' },
  { label: 'muted/surface-muted', foreground: 'inkMuted', background: 'surfaceMuted' },
  { label: 'gold-strong/background', foreground: 'goldStrong', background: 'background' },
  { label: 'gold-strong/surface-muted', foreground: 'goldStrong', background: 'surfaceMuted' },
  { label: 'black/gold', foreground: 'onGold', background: 'gold' },
  { label: 'white/black', foreground: 'onPrimary', background: 'primary' },
  { label: 'success/background', foreground: 'success', background: 'background' },
];

function ratiosFor(palette: Palette): Record<string, number> {
  return Object.fromEntries(
    PAIRS.map(({ label, foreground, background }) => [
      label,
      contrastRatio(palette[foreground], palette[background]),
    ]),
  );
}

describe.each([
  ['light', tokens.colors],
  ['dark', darkTokens.colors],
] as const)('%s palette contrast', (mode, palette) => {
  const ratios = ratiosFor(palette);

  it('reports the measured ratios', () => {
    const report = Object.entries(ratios)
      .map(([label, ratio]) => `${label}=${ratio.toFixed(2)}:1`)
      .join(', ');
    console.info(`[contrast:${mode}] ${report}`);
    expect(report.length).toBeGreaterThan(0);
  });

  it.each(PAIRS)('$label meets 4.5:1', ({ label }) => {
    expect(ratios[label]).toBeGreaterThanOrEqual(4.5);
  });
});
