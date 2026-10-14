import { describe, expect, it } from 'vitest';
import { moveIndex, otherPairs, pairLabel } from '../../src/js/lib/switcher.js';

describe('pairLabel', () => {
  it('names the pair', () => {
    expect(pairLabel({ target_lang: 'de', native_lang: 'en' })).toEqual({
      name: 'German',
      from: 'from English',
      code: 'DE',
      accessible: 'German from English',
    });
  });
});

describe('otherPairs', () => {
  it('leaves out the active pair', () => {
    expect(otherPairs([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
  });
});

describe('moveIndex', () => {
  it('wraps both ways', () => {
    expect(moveIndex(2, 'ArrowDown', 3)).toBe(0);
    expect(moveIndex(0, 'ArrowUp', 3)).toBe(2);
  });
  it('ignores other keys and empty menus', () => {
    expect(moveIndex(0, 'a', 3)).toBeNull();
    expect(moveIndex(0, 'ArrowDown', 0)).toBeNull();
  });
});
