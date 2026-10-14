// Structured output cannot enforce counts or lengths; validate.ts checks those.
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['corrected', 'uses_word', 'issues'],
  properties: {
    corrected: { type: 'string' },
    uses_word: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quote', 'message'],
        properties: { quote: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
};
