import { describe, expect, it } from 'vitest';
import { queryKeys } from './keys';

describe('query key factory', () => {
  it('produces stable list keys regardless of param order', () => {
    const a = queryKeys.list('opportunities', { q: 'x', page: 2 });
    const b = queryKeys.list('opportunities', { page: 2, q: 'x' });
    expect(a).toEqual(b);
  });

  it('separates domains with identical params', () => {
    expect(queryKeys.list('volunteers', { q: 'x' })).not.toEqual(
      queryKeys.list('organizations', { q: 'x' }),
    );
  });

  it('separates list, detail, and activity scopes', () => {
    const list = queryKeys.list('session');
    const detail = queryKeys.detail('session', 'me');
    const activity = queryKeys.activity('session');
    expect(list).not.toEqual(detail);
    expect(detail).not.toEqual(activity);
    expect(detail).toEqual(['session', 'detail', 'me']);
  });

  it('distinguishes param values', () => {
    expect(queryKeys.list('talents', { page: 1 })).not.toEqual(
      queryKeys.list('talents', { page: 2 }),
    );
  });
});
