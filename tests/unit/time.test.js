import { describe, expect, it } from 'vitest';
import { dayStart, localDate, nextDayStart } from '../../src/js/lib/time.js';

const iso = (d) => d.toISOString();
const berlin = 'Europe/Berlin';

describe('dayStart', () => {
  it('belongs to the previous day just before 04:00', () => {
    // 03:59 CEST on 12 Oct 2026
    expect(iso(dayStart(new Date('2026-10-12T01:59:00Z'), berlin))).toBe('2026-10-11T02:00:00.000Z');
  });

  it('starts a new day at 04:00', () => {
    // 04:00 CEST on 12 Oct 2026
    expect(iso(dayStart(new Date('2026-10-12T02:00:00Z'), berlin))).toBe('2026-10-12T02:00:00.000Z');
  });

  it('uses the same day for the whole afternoon and evening', () => {
    expect(iso(dayStart(new Date('2026-10-12T21:59:00Z'), berlin))).toBe('2026-10-12T02:00:00.000Z');
  });

  it('works in a negative-offset timezone', () => {
    const ny = 'America/New_York'; // EDT, 04:00 local is 08:00Z
    expect(iso(dayStart(new Date('2026-10-12T07:59:00Z'), ny))).toBe('2026-10-11T08:00:00.000Z');
    expect(iso(dayStart(new Date('2026-10-12T08:00:00Z'), ny))).toBe('2026-10-12T08:00:00.000Z');
  });

  it('does not depend on the machine timezone', () => {
    expect(iso(dayStart(new Date('2026-01-15T12:00:00Z'), 'Asia/Tokyo'))).toBe('2026-01-14T19:00:00.000Z');
  });
});

describe('nextDayStart', () => {
  it('is 24 hours after dayStart on an ordinary day', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    expect(nextDayStart(now, berlin).getTime() - dayStart(now, berlin).getTime()).toBe(24 * 3600e3);
  });

  it('is 23 hours long on the day containing the spring-forward jump', () => {
    // 00:00Z on 29 Mar 2026 is 01:00 CET, before the jump at 02:00
    const now = new Date('2026-03-29T00:00:00Z');
    expect(iso(dayStart(now, berlin))).toBe('2026-03-28T03:00:00.000Z'); // 04:00 CET on 28 Mar
    expect(iso(nextDayStart(now, berlin))).toBe('2026-03-29T02:00:00.000Z'); // 04:00 CEST on 29 Mar
    expect(nextDayStart(now, berlin).getTime() - dayStart(now, berlin).getTime()).toBe(23 * 3600e3);
  });

  it('is 25 hours long on the day containing the fall-back change', () => {
    // 22:30Z on 24 Oct 2026 is 00:30 CEST on 25 Oct, before the change at 03:00
    const now = new Date('2026-10-24T22:30:00Z');
    expect(iso(dayStart(now, berlin))).toBe('2026-10-24T02:00:00.000Z'); // 04:00 CEST on 24 Oct
    expect(iso(nextDayStart(now, berlin))).toBe('2026-10-25T03:00:00.000Z'); // 04:00 CET on 25 Oct
    expect(nextDayStart(now, berlin).getTime() - dayStart(now, berlin).getTime()).toBe(25 * 3600e3);
  });

  it('is 24 hours again on the day after the jump', () => {
    const now = new Date('2026-03-29T12:00:00Z');
    expect(nextDayStart(now, berlin).getTime() - dayStart(now, berlin).getTime()).toBe(24 * 3600e3);
  });

  it('handles the month boundary', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    expect(iso(nextDayStart(now, berlin))).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('localDate', () => {
  it('uses the local calendar date, not UTC', () => {
    // 23:30 UTC on 11 Oct is 01:30 CEST on 12 Oct
    expect(localDate(new Date('2026-10-11T23:30:00Z'), berlin)).toBe('2026-10-12');
  });

  it('does not roll over at 04:00', () => {
    // 03:00 CEST on 12 Oct still reads 12 Oct, although the logical day is the 11th
    expect(localDate(new Date('2026-10-12T01:00:00Z'), berlin)).toBe('2026-10-12');
  });

  it('pads month and day', () => {
    expect(localDate(new Date('2026-01-05T12:00:00Z'), berlin)).toBe('2026-01-05');
  });

  it('follows a western timezone', () => {
    expect(localDate(new Date('2026-10-12T03:00:00Z'), 'America/New_York')).toBe('2026-10-11');
  });
});
