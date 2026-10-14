import { describe, expect, it } from 'vitest';
import { formatUsage, parseLimit } from '../../src/js/lib/settings.js';

describe('parseLimit', () => {
  it.each([['0', 0], ['10', 10], ['100', 100], [' 7 ', 7], ['007', 7]])('accepts %s', (raw, value) => {
    expect(parseLimit(raw)).toEqual({ ok: true, value });
  });

  it.each(['101', '-1', '2.5', '', '  ', 'abc', '1e1', '10 words', null, undefined])('rejects %s', (raw) => {
    expect(parseLimit(raw).ok).toBe(false);
  });
});

describe('formatUsage', () => {
  it('shows zero', () => {
    expect(formatUsage(0, 2)).toBe('$0.00 of $2.00');
  });

  it('shows less than a cent', () => {
    expect(formatUsage(0.0004, 2)).toBe('less than $0.01 of $2.00');
  });

  it('shows exactly a cent', () => {
    expect(formatUsage(0.01, 2)).toBe('$0.01 of $2.00');
  });

  it('shows an ordinary amount', () => {
    expect(formatUsage(0.5, 2)).toBe('$0.50 of $2.00');
  });

  it('shows the cap reached', () => {
    expect(formatUsage(2, 2)).toBe('$2.00 of $2.00');
  });
});
