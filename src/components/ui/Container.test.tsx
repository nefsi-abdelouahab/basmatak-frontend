// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Container } from './Container';

describe('Container', () => {
  it('renders the default 1280px centered container with responsive gutters', () => {
    const { getByTestId } = render(
      <Container testId="c-default">
        <p>content</p>
      </Container>,
    );
    const el = getByTestId('c-default');
    for (const cls of ['mx-auto', 'w-full', 'max-w-7xl', 'px-4', 'md:px-6']) {
      expect(el.className.split(' '), cls).toContain(cls);
    }
  });

  it('renders the narrow single-column variant with the same gutters', () => {
    const { getByTestId } = render(
      <Container testId="c-narrow" variant="narrow">
        <p>form</p>
      </Container>,
    );
    const el = getByTestId('c-narrow');
    for (const cls of ['mx-auto', 'w-full', 'max-w-md', 'px-4', 'md:px-6']) {
      expect(el.className.split(' '), cls).toContain(cls);
    }
    expect(el.className.split(' ')).not.toContain('max-w-7xl');
  });

  it('passes vertical rhythm through className without touching gutters', () => {
    const { getByTestId } = render(
      <Container testId="c-rhythm" className="flex flex-col gap-6 py-8">
        <p>content</p>
      </Container>,
    );
    const el = getByTestId('c-rhythm');
    for (const cls of ['flex', 'flex-col', 'gap-6', 'py-8', 'px-4', 'md:px-6', 'max-w-7xl']) {
      expect(el.className.split(' '), cls).toContain(cls);
    }
  });
});
