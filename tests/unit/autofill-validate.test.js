import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMA } from '../../supabase/functions/autofill/schema.ts';
import { SYSTEM_PROMPT, userMessage } from '../../supabase/functions/autofill/prompt.ts';
import { validate } from '../../supabase/functions/_shared/validate.ts';

const nullForms = { article: null, plural: null, praeteritum: null, partizip2: null, auxiliary: null, separable_prefix: null };

const noun = (over = {}) => ({
  term: 'Bank',
  part_of_speech: 'noun',
  translations: ['bank'],
  hint_en: 'bank (money)',
  forms: { ...nullForms, article: 'die', plural: 'Banken' },
  example_de: 'Ich gehe heute zur Bank.',
  example_en: "I'm going to the bank today.",
  ...over,
});

const verb = (over = {}) => ({
  term: 'anrufen',
  part_of_speech: 'verb',
  translations: ['call', 'phone'],
  hint_en: 'phone someone',
  forms: { ...nullForms, praeteritum: 'rief an', partizip2: 'angerufen', auxiliary: 'haben', separable_prefix: 'an' },
  example_de: 'Ich rufe dich morgen an.',
  example_en: 'I will call you tomorrow.',
  ...over,
});

const ok = (senses) => ({ is_german_word: true, senses });

describe('validate', () => {
  it('accepts a noun and drops null form keys', () => {
    const r = validate(ok([noun()]));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.senses[0].forms).toEqual({ article: 'die', plural: 'Banken' });
  });

  it('accepts a separable verb', () => {
    const r = validate(ok([verb()]));
    expect(r.senses[0].forms).toEqual({ praeteritum: 'rief an', partizip2: 'angerufen', auxiliary: 'haben', separable_prefix: 'an' });
  });

  it('accepts an adjective with all forms null and gives empty forms', () => {
    const r = validate(ok([noun({ term: 'schnell', part_of_speech: 'adjective', forms: { ...nullForms } })]));
    expect(r.senses[0].forms).toEqual({});
  });

  it('returns not_a_word and ignores senses', () => {
    expect(validate({ is_german_word: false, senses: [noun()] })).toEqual({ ok: true, status: 'not_a_word', senses: [] });
  });

  it.each([
    ['non-object', null],
    ['missing is_german_word', { senses: [noun()] }],
    ['no senses', ok([])],
    ['four senses', ok([noun(), noun(), noun(), noun()])],
    ['bad part of speech', ok([noun({ part_of_speech: 'pronoun' })])],
    ['noun without article', ok([noun({ forms: { ...nullForms, plural: 'Banken' } })])],
    ['bad article', ok([noun({ forms: { ...nullForms, article: 'le' } })])],
    ['verb form on a noun', ok([noun({ forms: { ...nullForms, article: 'die', auxiliary: 'haben' } })])],
    ['noun form on a verb', ok([verb({ forms: { ...nullForms, article: 'die' } })])],
    ['bad auxiliary', ok([verb({ forms: { ...nullForms, auxiliary: 'werden' } })])],
    ['form on an adjective', ok([noun({ part_of_speech: 'adjective', forms: { ...nullForms, plural: 'x' } })])],
    ['no translations', ok([noun({ translations: [] })])],
    ['four translations', ok([noun({ translations: ['a', 'b', 'c', 'd'] })])],
    ['empty translation', ok([noun({ translations: [' '] })])],
    ['hint of five words', ok([noun({ hint_en: 'one two three four five' })])],
    ['empty hint', ok([noun({ hint_en: '' })])],
    ['example of thirteen words', ok([noun({ example_de: 'a b c d e f g h i j k l m' })])],
    ['empty term', ok([noun({ term: '' })])],
    ['overlong term', ok([noun({ term: 'x'.repeat(81) })])],
    ['missing forms', ok([noun({ forms: undefined })])],
  ])('rejects %s', (_name, raw) => {
    expect(validate(raw).ok).toBe(false);
  });

  it('accepts a twelve-word example', () => {
    expect(validate(ok([noun({ example_de: 'a b c d e f g h i j k l' })])).ok).toBe(true);
  });
});

describe('schema and prompt', () => {
  it('forbids extra properties at every object level', () => {
    const sense = OUTPUT_SCHEMA.properties.senses.items;
    expect(OUTPUT_SCHEMA.additionalProperties).toBe(false);
    expect(sense.additionalProperties).toBe(false);
    expect(sense.properties.forms.additionalProperties).toBe(false);
  });

  it('requires all six form keys', () => {
    expect(OUTPUT_SCHEMA.properties.senses.items.properties.forms.required).toHaveLength(6);
  });

  it('uses no unsupported length keywords', () => {
    expect(JSON.stringify(OUTPUT_SCHEMA)).not.toMatch(/minLength|maxLength|minimum|maximum|minItems|maxItems/);
  });

  it('puts the term only in the user turn', () => {
    expect(SYSTEM_PROMPT).not.toContain('Bank');
    expect(userMessage('Bank')).toBe('<term>Bank</term>');
  });

  it('tells the model what was wrong on a retry', () => {
    const msg = userMessage('Bank', 'bad hint_en: "too many words here now"');
    expect(msg.startsWith('<term>Bank</term>')).toBe(true);
    expect(msg).toContain('bad hint_en: "too many words here now"');
  });

  it('names the offending hint in the validation error', () => {
    const r = validate(ok([noun({ hint_en: 'one two three four five' })]));
    expect(r.error).toBe('bad hint_en: "one two three four five"');
  });
});
