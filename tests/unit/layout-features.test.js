import { describe, expect, it } from 'vitest';
import { shouldShow } from '../../src/js/lib/error-bar.js';
import { shortcutTarget } from '../../src/js/lib/shortcut.js';

describe('shouldShow', () => {
  it('shows for an uncaught error', () => {
    expect(shouldShow({ type: 'error', error: new Error('x'), message: 'x' })).toBe(true);
  });

  it('shows for an unhandled rejection', () => {
    expect(shouldShow({ type: 'unhandledrejection', reason: new Error('x') })).toBe(true);
  });

  it('ignores a cross-origin "Script error." without an error object', () => {
    expect(shouldShow({ type: 'error', error: null, message: 'Script error.' })).toBe(false);
  });

  it('ignores ResizeObserver notices', () => {
    const message = 'ResizeObserver loop completed with undelivered notifications.';
    expect(shouldShow({ type: 'error', error: new Error(message), message })).toBe(false);
  });
});

const LINKS = [
  { code: 'KeyH', href: '/' },
  { code: 'KeyR', href: '/review.html' },
  { code: 'KeyA', href: '/add.html' },
  { code: 'KeyW', href: '/words.html' },
  { code: 'KeyS', href: '/settings.html' },
];

describe('shortcutTarget with Alt', () => {
  const key = (over = {}) => ({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyA', key: 'å', ...over });

  it.each(LINKS)('opens $href for $code', ({ code, href }) => {
    expect(shortcutTarget(key({ code }), '/other.html', LINKS)).toBe(href);
  });

  it('matches Alt+S by position when the key types "ß"', () => {
    expect(shortcutTarget(key({ code: 'KeyS', key: 'ß' }), '/', LINKS)).toBe('/settings.html');
  });

  it('does nothing on the current page', () => {
    expect(shortcutTarget(key(), '/add.html', LINKS)).toBeNull();
    expect(shortcutTarget(key({ code: 'KeyH' }), '/', LINKS)).toBeNull();
    expect(shortcutTarget(key({ code: 'KeyH' }), '/index.html', LINKS)).toBeNull();
  });

  it('does nothing for a hidden link', () => {
    const links = [...LINKS, { code: 'KeyM', href: '/admin.html', hidden: true }];
    expect(shortcutTarget(key({ code: 'KeyM' }), '/', links)).toBeNull();
    links[links.length - 1].hidden = false;
    expect(shortcutTarget(key({ code: 'KeyM' }), '/', links)).toBe('/admin.html');
  });

  it('works inside a field', () => {
    const target = { closest: () => ({}) };
    expect(shortcutTarget(key({ code: 'KeyH', target }), '/words.html', LINKS)).toBe('/');
  });

  it.each([{ ctrlKey: true }, { shiftKey: true }, { metaKey: true }, { altKey: false }, { code: 'KeyB' }])(
    'ignores %o',
    (over) => {
      expect(shortcutTarget(key(over), '/', LINKS)).toBeNull();
    },
  );
});

describe('shortcutTarget with N', () => {
  const on = (selector) => ({ closest: (s) => (selector && s.split(', ').includes(selector) ? {} : null) });
  const n = (over = {}) => ({
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyN', key: 'n', target: on(null), ...over,
  });

  it('opens Add word outside fields', () => {
    expect(shortcutTarget(n(), '/', LINKS)).toBe('/add.html');
    // With nothing focused the target can be the document, which has no closest().
    expect(shortcutTarget(n({ target: {} }), '/words.html', LINKS)).toBe('/add.html');
  });

  it('does nothing on the Add word page', () => {
    expect(shortcutTarget(n(), '/add.html', LINKS)).toBeNull();
  });

  it.each(['input', 'textarea', 'select', 'dialog'])('ignores N inside %s', (selector) => {
    expect(shortcutTarget(n({ target: on(selector) }), '/', LINKS)).toBeNull();
  });

  it.each([{ ctrlKey: true }, { shiftKey: true }, { metaKey: true }])('ignores %o', (over) => {
    expect(shortcutTarget(n(over), '/', LINKS)).toBeNull();
  });
});
