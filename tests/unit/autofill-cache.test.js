import { describe, expect, it } from 'vitest';
import { cacheKey } from '../../supabase/functions/_shared/cache.ts';

describe('cacheKey', () => {
  it('trims and collapses spaces', () => expect(cacheKey('  Guten   Morgen ')).toBe('guten morgen'));
  it('lowercases', () => expect(cacheKey('Bank')).toBe('bank'));
  it('keeps umlauts and lowercases them', () => {
    expect(cacheKey('MÄDCHEN')).toBe('mädchen');
    expect(cacheKey('Mädchen')).toBe('mädchen');
  });
  it('keeps ß', () => expect(cacheKey('Straße')).toBe('straße'));
});
