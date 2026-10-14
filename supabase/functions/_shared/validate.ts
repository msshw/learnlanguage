// Pure: checks what the JSON schema cannot (lengths, counts, forms per part of speech).
import { ARTICLES, AUXILIARIES, MAX_TERM_LENGTH, NOUN_FORMS, PARTS_OF_SPEECH, VERB_FORMS } from './config.ts';

export type Sense = {
  term: string;
  part_of_speech: string;
  translations: string[];
  hint_en: string;
  forms: Record<string, string>;
  example_de: string;
  example_en: string;
};

export type Validated =
  | { ok: true; status: 'ok'; senses: Sense[] }
  | { ok: true; status: 'not_a_word'; senses: [] }
  | { ok: false; error: string };

const bad = (error: string): Validated => ({ ok: false, error });
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null;

function validSense(raw: any): Sense | string {
  if (!raw || typeof raw !== 'object') return 'sense is not an object';
  const term = text(raw.term, MAX_TERM_LENGTH);
  if (!term) return 'bad term';
  if (!PARTS_OF_SPEECH.includes(raw.part_of_speech)) return 'bad part_of_speech';
  if (!Array.isArray(raw.translations) || raw.translations.length < 1 || raw.translations.length > 3) {
    return 'translations must have 1 to 3 items';
  }
  const translations = raw.translations.map((t: unknown) => text(t, 60));
  if (translations.some((t: string | null) => t === null)) return 'bad translation';
  const hint = text(raw.hint_en, 40);
  if (!hint || words(hint) > 4) return `bad hint_en: ${JSON.stringify(raw.hint_en)}`;
  const exampleDe = text(raw.example_de, 200);
  if (!exampleDe || words(exampleDe) > 12) return `bad example_de: ${JSON.stringify(raw.example_de)}`;
  const exampleEn = text(raw.example_en, 200);
  if (!exampleEn) return 'bad example_en';

  const pos = raw.part_of_speech;
  const allowed = pos === 'noun' ? NOUN_FORMS : pos === 'verb' ? VERB_FORMS : [];
  const given = raw.forms && typeof raw.forms === 'object' ? raw.forms : null;
  if (!given) return 'forms missing';
  const forms: Record<string, string> = {};
  for (const [key, value] of Object.entries(given)) {
    if (value === null || value === undefined) continue;
    if (!allowed.includes(key)) return `form ${key} not allowed for ${pos}`;
    const v = text(value, 80);
    if (!v) return `bad form ${key}`;
    forms[key] = v;
  }
  if (pos === 'noun' && !ARTICLES.includes(forms.article)) return 'noun needs article der, die or das';
  if (forms.auxiliary && !AUXILIARIES.includes(forms.auxiliary)) return 'bad auxiliary';

  return { term, part_of_speech: pos, translations, hint_en: hint, forms, example_de: exampleDe, example_en: exampleEn };
}

export function validate(raw: any): Validated {
  if (!raw || typeof raw !== 'object' || typeof raw.is_german_word !== 'boolean') return bad('bad shape');
  if (!raw.is_german_word) return { ok: true, status: 'not_a_word', senses: [] };
  if (!Array.isArray(raw.senses) || raw.senses.length < 1 || raw.senses.length > 3) {
    return bad('senses must have 1 to 3 items');
  }
  const senses: Sense[] = [];
  for (const s of raw.senses) {
    const v = validSense(s);
    if (typeof v === 'string') return bad(v);
    senses.push(v);
  }
  return { ok: true, status: 'ok', senses };
}
