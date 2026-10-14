import { PARTS_OF_SPEECH } from '../_shared/config.ts';

const nullableString = { type: ['string', 'null'] };

// Structured output cannot enforce lengths, counts, enums mixed with null or "forms keys match the part of speech";
// validate.ts checks those.
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_german_word', 'senses'],
  properties: {
    is_german_word: { type: 'boolean' },
    senses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'part_of_speech', 'translations', 'hint_en', 'forms', 'example_de', 'example_en'],
        properties: {
          term: { type: 'string' },
          part_of_speech: { type: 'string', enum: PARTS_OF_SPEECH },
          translations: { type: 'array', items: { type: 'string' } },
          hint_en: { type: 'string' },
          forms: {
            type: 'object',
            additionalProperties: false,
            required: ['article', 'plural', 'praeteritum', 'partizip2', 'auxiliary', 'separable_prefix'],
            properties: {
              article: nullableString,
              plural: nullableString,
              praeteritum: nullableString,
              partizip2: nullableString,
              auxiliary: nullableString,
              separable_prefix: nullableString,
            },
          },
          example_de: { type: 'string' },
          example_en: { type: 'string' },
        },
      },
    },
  },
};
