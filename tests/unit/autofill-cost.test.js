import { describe, expect, it } from 'vitest';
import { costUsd, isOverCap, monthStart, usageSummary } from '../../supabase/functions/_shared/cost.ts';

describe('monthStart', () => {
  it('is the first instant of the UTC month', () => {
    expect(monthStart(new Date('2026-10-17T13:45:00Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('keeps the last second of a month in that month', () => {
    expect(monthStart(new Date('2026-10-31T23:59:59Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('moves on at the month boundary', () => {
    expect(monthStart(new Date('2026-11-01T00:00:00Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('handles the year boundary', () => {
    expect(monthStart(new Date('2027-01-01T00:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('costUsd', () => {
  it('prices a typical call at about $0.0002', () => {
    expect(costUsd(800, 300)).toBeCloseTo(0.00023, 6);
  });

  it('is zero without tokens', () => {
    expect(costUsd(0, 0)).toBe(0);
  });

  it('prices a million of each at $0.60', () => {
    expect(costUsd(1_000_000, 1_000_000)).toBeCloseTo(0.6, 9);
  });
});

describe('isOverCap', () => {
  it('allows $1.99', () => {
    expect(isOverCap(1.99)).toBe(false);
  });

  it('stops at $2.00', () => {
    expect(isOverCap(2)).toBe(true);
  });

  it('stops at exactly $2.00 of tokens despite float error', () => {
    // 20,000,000 input tokens at $0.10 per million
    expect(isOverCap(costUsd(20_000_000, 0))).toBe(true);
  });

  it('allows one token under', () => {
    expect(isOverCap(costUsd(19_999_999, 0))).toBe(false);
  });
});

describe('usageSummary', () => {
  it('is zero with the cap when nothing was used', () => {
    expect(usageSummary(0, 0)).toEqual({ spent_usd: 0, cap_usd: 2 });
  });

  it('prices a typical month', () => {
    // 5M input tokens at $0.10 and 1M output tokens at $0.50 per million
    expect(usageSummary(5_000_000, 1_000_000)).toEqual({ spent_usd: 1, cap_usd: 2 });
  });

  it('rounds to 6 decimals', () => {
    expect(usageSummary(1, 1).spent_usd).toBe(0.000001);
    expect(usageSummary(333_333, 0).spent_usd).toBe(0.033333);
  });
});
