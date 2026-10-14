import { PARTS_OF_SPEECH } from '../_shared/config.ts';
import type { Profile } from '../_shared/validate.ts';

const nullableString = { type: ['string', 'null'] };

// Structured output cannot enforce lengths, counts, enums mixed with null or "forms keys match the part of speech";
// validate.ts checks those. A profile without forms (generic) gets no `forms` property at all.
export function outputSchema(profile: Profile) {
  const formKeys = [...new Set(Object.values(profile.forms as Record<string, string[]>).flat())];
  const required = ['term', 'part_of_speech', 'translations', 'hint_native', 'example_target', 'example_native'];
  const properties: Record<string, unknown> = {
    term: { type: 'string' },
    part_of_speech: { type: 'string', enum: PARTS_OF_SPEECH },
    translations: { type: 'array', items: { type: 'string' } },
    hint_native: { type: 'string' },
    example_target: { type: 'string' },
    example_native: { type: 'string' },
  };
  if (formKeys.length > 0) {
    required.splice(4, 0, 'forms');
    properties.forms = {
      type: 'object',
      additionalProperties: false,
      required: formKeys,
      properties: Object.fromEntries(formKeys.map((k) => [k, nullableString])),
    };
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['is_target_word', 'senses'],
    properties: {
      is_target_word: { type: 'boolean' },
      senses: { type: 'array', items: { type: 'object', additionalProperties: false, required, properties } },
    },
  };
}
