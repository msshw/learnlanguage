// The one place for model ID, prices and limits. Swapping the model or provider starts here.
export const MODEL = 'claude-haiku-5-5';
export const EFFORT = 'low';
// Thinking tokens count toward this cap, so it leaves room beyond the JSON itself.
export const MAX_TOKENS = 2000;
// Per-token USD prices (Haiku 5.5: $0.10 / $0.50 per million tokens).
export const PRICE_INPUT = 0.1 / 1_000_000;
export const PRICE_OUTPUT = 0.5 / 1_000_000;
export const MONTHLY_CAP_USD = 2;
export const CALL_TIMEOUT_MS = 6000;

export const MAX_TERM_LENGTH = 80;

export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

// check-sentence
export const MAX_SENTENCE_LENGTH = 300;
export const MAX_CORRECTED_LENGTH = 400;
export const MAX_ISSUES = 5;
export const MAX_ISSUE_WORDS = 25;
export const SENTENCE_CALL_TIMEOUT_MS = 8000;
