import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every user-facing string on a non-admin page comes from the dictionaries. This catches a
// `textContent = 'literal'` left in a page module or lib. Admin files stay English on purpose.
const DIRS = ['src/js/pages', 'src/js/lib'];
const ADMIN = /^admin/;
const LITERAL = /\.textContent\s*=\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

// A literal counts when it has a letter outside ${...} placeholders.
const hasText = (literal) => /\p{L}/u.test(literal.replace(/\$\{[^}]*\}/g, ''));

function findLiterals() {
  const found = [];
  for (const dir of DIRS) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js') && !ADMIN.test(f))) {
      const source = readFileSync(`${dir}/${file}`, 'utf8');
      for (const match of source.matchAll(LITERAL)) {
        if (!hasText(match[1])) continue;
        const line = source.slice(0, match.index).split('\n').length;
        found.push(`${dir}/${file}:${line} ${match[1]}`);
      }
    }
  }
  return found;
}

describe('ui strings', () => {
  it('has no text literal assigned to textContent outside the dictionaries', () => {
    expect(findLiterals()).toEqual([]);
  });
});
