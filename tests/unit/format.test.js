import { describe, expect, it } from 'vitest';
import { formatDay, formatInterval, formatNextDue, formatRelativeDay, greeting } from '../../src/js/lib/format.js';

const tz = 'Europe/Berlin';

describe('formatNextDue', () => {
  it('shows only the date at the start of a day', () => {
    const text = formatNextDue(new Date('2026-10-13T02:00:00Z'), tz, 'en-GB'); // 04:00 CEST
    expect(text).toContain('13');
    expect(text).toContain('Oct');
    expect(text).not.toContain(':');
  });

  it('adds the time for any other moment, in the profile timezone', () => {
    const text = formatNextDue(new Date('2026-10-13T12:30:00Z'), tz, 'en-GB'); // 14:30 CEST
    expect(text).toContain('13');
    expect(text).toContain('14:30');
  });
});

describe('formatInterval', () => {
  const now = new Date('2026-10-11T09:00:00Z');
  const after = (ms) => new Date(now.getTime() + ms);
  const MIN = 60e3;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each([
    [10 * MIN, '10 min'],
    [0, '1 min'],
    [HOUR, '1 hour'],
    [5 * HOUR, '5 hours'],
    [DAY, '1 day'],
    [3 * DAY, '3 days'],
    [60 * DAY, '2 months'],
    [400 * DAY, '1 year'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatInterval(after(ms), now)).toBe(text);
  });
});

describe('formatRelativeDay', () => {
  // 09:00 CEST on 12 Oct 2026; the next logical day starts at 04:00 CEST (02:00Z) on 13 Oct.
  const now = new Date('2026-10-12T07:00:00Z');

  it.each([
    ['2026-10-01T10:00:00Z', 'Today'], // overdue
    ['2026-10-12T20:00:00Z', 'Today'],
    ['2026-10-13T01:59:00Z', 'Today'], // 03:59 local, before the rollover
    ['2026-10-13T02:00:00Z', 'Tomorrow'],
    ['2026-10-13T21:00:00Z', 'Tomorrow'],
    ['2026-10-16T09:00:00Z', 'In 4 days'],
    ['2026-10-26T09:00:00Z', 'In 14 days'], // across the end of summer time
  ])('formats %s as %s', (due, text) => {
    expect(formatRelativeDay(new Date(due), now, tz)).toBe(text);
  });

  it('counts days from the logical day just after midnight', () => {
    const lateNight = new Date('2026-10-12T23:30:00Z'); // 01:30 local on 13 Oct, still 12 Oct's day
    expect(formatRelativeDay(new Date('2026-10-13T08:00:00Z'), lateNight, tz)).toBe('Tomorrow');
  });
});

describe('formatDay', () => {
  it('shows the logical day, in the profile timezone', () => {
    expect(formatDay(new Date('2026-10-12T07:00:00Z'), tz, 'en-GB')).toBe('Monday 12 October');
    expect(formatDay(new Date('2026-10-12T23:30:00Z'), tz, 'en-GB')).toBe('Monday 12 October'); // 01:30 local
  });
});

describe('greeting', () => {
  it.each([
    ['2026-10-12T05:00:00Z', 'Good morning'], // 07:00 local
    ['2026-10-12T10:00:00Z', 'Good afternoon'], // 12:00 local
    ['2026-10-12T16:00:00Z', 'Good evening'], // 18:00 local
    ['2026-10-12T00:30:00Z', 'Good evening'], // 02:30 local
  ])('at %s says %s', (at, text) => {
    expect(greeting(new Date(at), tz)).toBe(text);
  });

  it('adds the name when there is one', () => {
    expect(greeting(new Date('2026-10-12T16:00:00Z'), tz, 'Maks')).toBe('Good evening, Maks');
    expect(greeting(new Date('2026-10-12T16:00:00Z'), tz, '  ')).toBe('Good evening');
    expect(greeting(new Date('2026-10-12T16:00:00Z'), tz, null)).toBe('Good evening');
  });
});

describe('Russian', () => {
  const now = new Date('2026-10-11T09:00:00Z');
  it('uses Russian plural forms and texts', () => {
    const after = (h) => new Date(now.getTime() + h * 3600e3);
    expect(formatInterval(after(1), now, 'ru')).toBe('1 час');
    expect(formatInterval(after(2), now, 'ru')).toBe('2 часа');
    expect(formatInterval(after(5), now, 'ru')).toBe('5 часов');
    expect(formatRelativeDay(new Date('2026-10-16T09:00:00Z'), new Date('2026-10-12T07:00:00Z'), tz, 'ru')).toBe('Через 4 дня');
    expect(greeting(new Date('2026-10-12T16:00:00Z'), tz, 'Макс', 'ru')).toBe('Добрый вечер, Макс');
  });
});
