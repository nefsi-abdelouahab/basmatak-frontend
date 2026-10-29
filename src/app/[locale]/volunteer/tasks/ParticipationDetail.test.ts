import { describe, expect, it } from 'vitest';
import { formatSchedule } from './ParticipationDetail';

const LOCALE = 'en-US';
const fmt = (iso: string) => new Date(iso).toLocaleDateString(LOCALE);

describe('ParticipationDetail.formatSchedule', () => {
  it('reads the real backend schedule.startDate/endDate pair first', () => {
    const startDate = '2026-09-05T00:00:00.000Z';
    const endDate = '2026-09-12T00:00:00.000Z';
    const schedule = { startDate, endDate };
    const opportunity = {
      id: 'o1',
      title: 'Beach cleanup',
      slug: 'beach-cleanup',
      status: 'published',
    };
    const position = { id: 'p1', startAt: '2026-08-01T00:00:00.000Z' };

    expect(
      formatSchedule(schedule, opportunity, LOCALE, position),
    ).toBe(`${fmt(startDate)} – ${fmt(endDate)}`);
  });

  it('falls back to position.startAt when the schedule has no dates', () => {
    const startAt = '2026-08-01T00:00:00.000Z';
    const opportunity = { id: 'o1', title: 'Beach cleanup' };
    const position = { id: 'p1', startAt };

    expect(formatSchedule(null, opportunity, LOCALE, position)).toBe(
      fmt(startAt),
    );
  });

  it('keeps legacy schedule startAt/endAt and opportunity dates working', () => {
    const startAt = '2026-07-01T00:00:00.000Z';
    const endAt = '2026-07-02T00:00:00.000Z';
    expect(formatSchedule({ startAt, endAt }, null, LOCALE)).toBe(
      `${fmt(startAt)} – ${fmt(endAt)}`,
    );

    const startDate = '2026-06-01T00:00:00.000Z';
    const endDate = '2026-06-03T00:00:00.000Z';
    expect(
      formatSchedule(null, { startDate, endDate }, LOCALE),
    ).toBe(`${fmt(startDate)} – ${fmt(endDate)}`);
  });

  it('passes through a plain string and returns a dash when empty', () => {
    expect(formatSchedule('Every Saturday', null, LOCALE)).toBe(
      'Every Saturday',
    );
    expect(formatSchedule(null, null, LOCALE)).toBe('—');
    expect(formatSchedule({}, {}, LOCALE)).toBe('—');
  });
});
