import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => ({ href, children }),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

import { applyGateFor } from './useOpportunity';

const base = { status: 'published' as const, applicationDeadline: '2026-09-16T23:59:00.000Z' };
const seat = { requiredCount: 2, filledCount: 1 };
const NOW = '2026-09-10T12:00:00.000Z';

describe('apply deadline/seat gating', () => {
  it('allows apply on an open published position before the deadline', () => {
    expect(applyGateFor(base, seat, NOW)).toBeNull();
  });

  it('gates full positions', () => {
    expect(applyGateFor(base, { requiredCount: 2, filledCount: 2 }, NOW)).toBe('full');
  });

  it('gates past deadlines', () => {
    expect(applyGateFor(base, seat, '2026-09-20T12:00:00.000Z')).toBe('deadline');
  });

  it('gates non-published opportunities', () => {
    for (const status of ['draft', 'closed', 'cancelled', 'completed', 'in_progress']) {
      expect(applyGateFor({ status, applicationDeadline: null }, seat, NOW)).toBe('closed');
    }
  });

  it('treats missing counts as open (server remains the source of truth)', () => {
    expect(applyGateFor(base, {}, NOW)).toBeNull();
  });
});
