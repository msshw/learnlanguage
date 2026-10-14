// Pure: identifies a sense by part of speech and its set of translations, so a rejected sense can
// be recognised when the model suggests it again. Matching is exact; a rephrased sense is a new one.
export const MAX_AVOID = 10;

export type Rejected = { fingerprint: string; part_of_speech: string; translations: string[] };

export const fingerprint = (s: { part_of_speech: string; translations: string[] }): string =>
  `${s.part_of_speech}|${s.translations.map((t) => t.trim().toLowerCase()).sort().join(',')}`;

// The shape stored in rejected_senses and passed to moderate_suggestion.
export const toRejected = (s: { part_of_speech: string; translations: string[] }): Rejected => ({
  fingerprint: fingerprint(s),
  part_of_speech: s.part_of_speech,
  translations: s.translations,
});

export const filterRejected = <T extends { part_of_speech: string; translations: string[] }>(
  senses: T[],
  rejected: Iterable<string>,
): T[] => {
  const set = new Set(rejected);
  return senses.filter((s) => !set.has(fingerprint(s)));
};

// Text for the user message. Empty when there is nothing to avoid. Capped at MAX_AVOID senses.
export function avoidBlock(rejected: { part_of_speech: string; translations: string[] }[]): string {
  if (rejected.length === 0) return '';
  const lines = rejected.slice(0, MAX_AVOID).map((s) => `- ${s.part_of_speech}: ${s.translations.join(', ')}`);
  return `Do not suggest these senses (they were rejected as wrong):\n${lines.join('\n')}`;
}
