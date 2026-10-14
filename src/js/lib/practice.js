// Pure: no DOM, no network, no clock. Helpers for the Practice page and the check client.

// Longest sentence the check accepts. The server enforces the same limit.
export const MAX_SENTENCE_LENGTH = 300;

// The issues if every one is usable against the sentence, else null. Usable: integer offsets with
// 0 <= start < end <= sentence length, a message, ordered by start and not overlapping.
export function validIssues(sentence, issues) {
  if (typeof sentence !== 'string' || !Array.isArray(issues)) return null;
  let previousEnd = 0;
  const out = [];
  for (const i of issues) {
    if (!i || !Number.isInteger(i.start) || !Number.isInteger(i.end) || typeof i.message !== 'string') return null;
    if (i.start < previousEnd || i.end <= i.start || i.end > sentence.length || !i.message.trim()) return null;
    out.push({ start: i.start, end: i.end, message: i.message });
    previousEnd = i.end;
  }
  return out;
}

// The sentence cut into [{ text, issue }], issue being null outside highlights. `issues` must
// already be valid (see validIssues). Empty pieces are left out.
export function highlightSegments(sentence, issues) {
  const segments = [];
  let at = 0;
  for (const issue of issues) {
    if (issue.start > at) segments.push({ text: sentence.slice(at, issue.start), issue: null });
    segments.push({ text: sentence.slice(issue.start, issue.end), issue });
    at = issue.end;
  }
  if (at < sentence.length) segments.push({ text: sentence.slice(at), issue: null });
  return segments;
}

// Preselected rating after a check: 1 when the word is unused, 2 with any issue, else 3.
// null when there is no successful check, so the user has to choose.
export function defaultRating(check) {
  if (check?.status !== 'ok') return null;
  if (!check.usesWord) return 1;
  return check.issues.length > 0 ? 2 : 3;
}
