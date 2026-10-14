import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTranslations, cacheLanguage, readCachedLanguage, setDocumentLanguage } from '../../src/js/lib/i18n-dom.js';

// Minimal element and root stubs: the unit tests run in Node, without a DOM.
const el = (attrs) => {
  const node = {
    attrs: { ...attrs },
    textContent: 'original',
    getAttribute: (name) => node.attrs[name] ?? null,
    setAttribute: (name, value) => {
      node.attrs[name] = value;
    },
  };
  return node;
};
const rootOf = (...nodes) => ({
  querySelectorAll: (selector) => {
    const attr = selector.slice(1, -1);
    return nodes.filter((n) => attr in n.attrs);
  },
});

describe('applyTranslations', () => {
  it('sets text and the three attributes', () => {
    const text = el({ 'data-i18n': 'common.retry' });
    const input = el({ 'data-i18n-placeholder': 'words.search' });
    const button = el({ 'data-i18n-aria': 'sidebar.collapse' });
    const link = el({ 'data-i18n-title': 'common.cancel' });
    applyTranslations(rootOf(text, input, button, link), 'ru');
    expect(text.textContent).toBe('Повторить');
    expect(input.attrs.placeholder).toBe('Искать слова');
    expect(button.attrs['aria-label']).toBe('Свернуть меню');
    expect(link.attrs.title).toBe('Отмена');
    expect(input.textContent).toBe('original');
  });

  it('fills vars and falls back to English', () => {
    const text = el({ 'data-i18n': 'common.emptyHint' });
    applyTranslations(rootOf(text), 'xx', { language: 'German' });
    expect(text.textContent).toBe('Add your first German word to start reviewing.');
  });
});

describe('document language and cache', () => {
  const realDocument = globalThis.document;
  const realStorage = globalThis.localStorage;
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
    };
    globalThis.document = { documentElement: {} };
  });
  afterEach(() => {
    globalThis.document = realDocument;
    globalThis.localStorage = realStorage;
  });

  it('sets the html lang', () => {
    setDocumentLanguage('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('reads back a cached language, null when none or unsupported', () => {
    expect(readCachedLanguage()).toBeNull();
    cacheLanguage('ru');
    expect(readCachedLanguage()).toBe('ru');
    localStorage.setItem('ui-language', 'xx');
    expect(readCachedLanguage()).toBe('en');
  });

  it('survives blocked storage', () => {
    globalThis.localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(readCachedLanguage()).toBeNull();
    expect(() => cacheLanguage('ru')).not.toThrow();
  });
});
