import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../../src/js/lib/return-to.js';

const origin = 'http://localhost:5173';

describe('safeReturnTo', () => {
  it('keeps a same-origin path with query', () => {
    expect(safeReturnTo('/review.html?x=1', origin)).toBe('/review.html?x=1');
  });

  it.each([
    ['absolute url', 'https://evil.test/'],
    ['protocol-relative', '//evil.test'],
    ['backslash trick', '/\\evil.test'],
    ['sign-in page', '/signin.html?returnTo=/'],
    ['sign-in without extension', '/signin'],
    ['empty', ''],
    ['no leading slash', 'review.html'],
    ['null', null],
    ['undefined', undefined],
    ['number', 5],
  ])('falls back to home for %s', (_name, value) => {
    expect(safeReturnTo(value, origin)).toBe('/');
  });
});
