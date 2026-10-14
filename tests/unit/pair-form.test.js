import { describe, expect, it } from 'vitest';
import { nativeOptions, targetOptions } from '../../src/js/lib/pair-form.js';

describe('pair form options', () => {
  it('offers English and Russian as native', () => {
    expect(nativeOptions().map((o) => o.code)).toEqual(['ru', 'en']);
  });
  it('leaves the native language out of the targets', () => {
    const ru = targetOptions('ru').map((o) => o.code);
    expect(ru).not.toContain('ru');
    expect(ru).toContain('en');
    expect(targetOptions('en').map((o) => o.code)).not.toContain('en');
  });
  it('offers nothing for an unknown native', () => {
    expect(targetOptions('xx')).toEqual([]);
  });
});
