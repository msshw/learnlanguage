// Pure. Copy of supabase/functions/_shared/languages.ts: change both, tests/unit/languages.test.js keeps them equal.
export const PROFILES = {
  german: {
    id: 'german',
    articles: ['der', 'die', 'das'],
    forms: {
      noun: ['article', 'plural'],
      verb: ['praeteritum', 'partizip2', 'auxiliary', 'separable_prefix'],
    },
    auxiliaries: ['haben', 'sein'],
    fold: [['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue'], ['ß', 'ss']],
  },
  generic: { id: 'generic', articles: [], forms: {}, auxiliaries: [], fold: [] },
  russian: { id: 'russian', articles: [], forms: {}, auxiliaries: [], fold: [['ё', 'е']] },
};

// native: may be the learner's own language; target: may be learned.
export const LANGUAGES = {
  de: { name: 'German', native: false, target: true, profile: 'german' },
  fr: { name: 'French', native: false, target: true, profile: 'generic' },
  es: { name: 'Spanish', native: false, target: true, profile: 'generic' },
  it: { name: 'Italian', native: false, target: true, profile: 'generic' },
  pt: { name: 'Portuguese', native: false, target: true, profile: 'generic' },
  nl: { name: 'Dutch', native: false, target: true, profile: 'generic' },
  pl: { name: 'Polish', native: false, target: true, profile: 'generic' },
  cs: { name: 'Czech', native: false, target: true, profile: 'generic' },
  uk: { name: 'Ukrainian', native: false, target: true, profile: 'generic' },
  ru: { name: 'Russian', native: true, target: true, profile: 'russian' },
  en: { name: 'English', native: true, target: true, profile: 'generic' },
};

const has = (code) => Object.prototype.hasOwnProperty.call(LANGUAGES, code);

export const isAllowedPair = (target, native) =>
  has(target) && has(native) && target !== native && LANGUAGES[target].target && LANGUAGES[native].native;

export const languageName = (code) => (has(code) ? LANGUAGES[code].name : code);

// Unknown codes get the generic profile.
export const profileOf = (code) => PROFILES[has(code) ? LANGUAGES[code].profile : 'generic'];
