// Pure: checks what the JSON schema cannot (lengths, counts, forms per part of speech).
import { MAX_TERM_LENGTH, PARTS_OF_SPEECH } from './config.ts';
import type { PROFILES } from './languages.ts';

export type Profile = (typeof PROFILES)[keyof typeof PROFILES];

export type Sense = {
  term: string;
  part_of_speech: string;
  translations: string[];
  hint_native: string;
  forms: Record<string, string>;
  example_target: string;
  example_native: string;
};

export type Validated =
  | { ok: true; status: 'ok'; senses: Sense[] }
  | { ok: true; status: 'not_a_word'; senses: [] }
  | { ok: false; error: string };

const bad = (error: string): Validated => ({ ok: false, error });
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null;

function validSense(raw: any, profile: Profile): Sense | string {
  if (!raw || typeof raw !== 'object') return 'sense is not an object';
  const term = text(raw.term, MAX_TERM_LENGTH);
  if (!term) return 'bad term';
  if (!PARTS_OF_SPEECH.includes(raw.part_of_speech)) return 'bad part_of_speech';
  if (!Array.isArray(raw.translations) || raw.translations.length < 1 || raw.translations.length > 3) {
    return 'translations must have 1 to 3 items';
  }
  const translations = raw.translations.map((t: unknown) => text(t, 60));
  if (translations.some((t: string | null) => t === null)) return 'bad translation';
  const hint = text(raw.hint_native, 40);
  if (!hint || words(hint) > 4) return `bad hint_native: ${JSON.stringify(raw.hint_native)}`;
  const exampleTarget = text(raw.example_target, 200);
  if (!exampleTarget || words(exampleTarget) > 12) return `bad example_target: ${JSON.stringify(raw.example_target)}`;
  const exampleNative = text(raw.example_native, 200);
  if (!exampleNative) return 'bad example_native';

  const pos = raw.part_of_speech;
  const allowed: string[] = (profile.forms as Record<string, string[]>)[pos] ?? [];
  // A profile without forms (generic) sends none: a missing forms object is {}, any filled key is rejected below.
  const hasForms = Object.keys(profile.forms).length > 0;
  const given = raw.forms && typeof raw.forms === 'object' ? raw.forms : !hasForms && raw.forms == null ? {} : null;
  if (!given) return 'forms missing';
  const forms: Record<string, string> = {};
  for (const [key, value] of Object.entries(given)) {
    if (value === null || value === undefined) continue;
    if (!allowed.includes(key)) return `form ${key} not allowed for ${pos}`;
    const v = text(value, 80);
    if (!v) return `bad form ${key}`;
    forms[key] = v;
  }
  // The article check runs only for profiles that have articles (German).
  if (pos === 'noun' && profile.articles.length > 0 && !profile.articles.includes(forms.article)) {
    return `noun needs article ${profile.articles.join(', ')}`;
  }
  if (forms.auxiliary && !profile.auxiliaries.includes(forms.auxiliary)) return 'bad auxiliary';

  return { term, part_of_speech: pos, translations, hint_native: hint, forms, example_target: exampleTarget, example_native: exampleNative };
}

// profile: the target language's profile, from the pair read in the database.
export function validate(raw: any, profile: Profile): Validated {
  if (!raw || typeof raw !== 'object' || typeof raw.is_target_word !== 'boolean') return bad('bad shape');
  if (!raw.is_target_word) return { ok: true, status: 'not_a_word', senses: [] };
  if (!Array.isArray(raw.senses) || raw.senses.length < 1 || raw.senses.length > 3) {
    return bad('senses must have 1 to 3 items');
  }
  const senses: Sense[] = [];
  for (const s of raw.senses) {
    const v = validSense(s, profile);
    if (typeof v === 'string') return bad(v);
    senses.push(v);
  }
  return { ok: true, status: 'ok', senses };
}
