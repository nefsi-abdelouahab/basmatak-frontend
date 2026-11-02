// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FingerprintPattern } from './FingerprintPattern';

afterEach(cleanup);

function classNames(element: Element) {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

describe('FingerprintPattern', () => {
  it('renders a decorative, non-interactive watermark', () => {
    const { getByTestId } = render(<FingerprintPattern />);
    const pattern = getByTestId('fingerprint-pattern');

    expect(pattern).toBeTruthy();
    expect(pattern.getAttribute('aria-hidden')).toBe('true');
    expect(classNames(pattern)).toContain('pointer-events-none');
    expect(classNames(pattern)).toContain('text-gold-strong');
    expect(classNames(pattern)).toContain('opacity-5');
  });

  it('anchors the corner variant to the logical inline-end edge', () => {
    const { getByTestId } = render(<FingerprintPattern variant="corner" />);
    const classes = classNames(getByTestId('fingerprint-pattern'));

    expect(classes).toContain('absolute');
    expect(classes).toContain('end-[-20%]');
    expect(classes).toContain('h-[120%]');
    expect(classes).toContain('w-[120%]');
    expect(classes).not.toContain('right-[-20%]');
    expect(classes).not.toContain('left-[-20%]');
  });

  it('repeats the artwork in the tile variant without pointer capture', () => {
    const { getAllByTestId } = render(<FingerprintPattern variant="tile" />);
    const patterns = getAllByTestId('fingerprint-pattern');

    expect(patterns).toHaveLength(4);
    for (const pattern of patterns) {
      expect(pattern.getAttribute('aria-hidden')).toBe('true');
      expect(classNames(pattern)).toContain('pointer-events-none');
    }
  });
});
