// Pure: turns the model's quotes into offsets and checks everything the model returned.
// The model is never trusted with character offsets; it quotes the faulty text and the code finds it.
import { MAX_CORRECTED_LENGTH, MAX_ISSUE_WORDS, MAX_ISSUES } from '../_shared/config.ts';

export type Issue = { start: number; end: number; message: string };
export type Checked = { corrected: string; uses_word: boolean; issues: Issue[] };
export type Placed = { ok: true; issues: Issue[] } | { ok: false; error: string };
export type CheckedResult = ({ ok: true } & Checked) | { ok: false; error: string };

// First occurrence of each quote that does not overlap an issue already placed, in the order the
// model listed them. Result sorted by start. Offsets are UTF-16 code units, end exclusive.
export function placeIssues(sentence: string, issues: { quote: string; message: string }[]): Placed {
  const placed: Issue[] = [];
  for (const { quote, message } of issues) {
    if (!quote) return { ok: false, error: 'empty quote' };
    let start = sentence.indexOf(quote);
    while (start !== -1 && placed.some((p) => start < p.end && p.start < start + quote.length)) {
      start = sentence.indexOf(quote, start + 1);
    }
    if (start === -1) return { ok: false, error: `quote not found: ${quote.slice(0, 40)}` };
    placed.push({ start, end: start + quote.length, message });
  }
  return { ok: true, issues: placed.sort((a, b) => a.start - b.start) };
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function validateCheck(raw: any, sentence: string): CheckedResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'output is not an object' };
  const { corrected, uses_word, issues } = raw;
  if (typeof corrected !== 'string' || !corrected.trim()) return { ok: false, error: 'corrected is missing' };
  if (corrected.length > MAX_CORRECTED_LENGTH) return { ok: false, error: 'corrected is too long' };
  if (typeof uses_word !== 'boolean') return { ok: false, error: 'uses_word is missing' };
  if (!Array.isArray(issues) || issues.length > MAX_ISSUES) return { ok: false, error: 'issues is invalid or too long' };
  for (const i of issues) {
    if (!i || typeof i.quote !== 'string' || typeof i.message !== 'string') return { ok: false, error: 'bad issue' };
    const message = i.message.trim();
    if (!message || words(message) > MAX_ISSUE_WORDS) return { ok: false, error: 'issue message length' };
    i.message = message;
  }
  const placed = placeIssues(sentence, issues);
  if (!placed.ok) return placed;
  return { ok: true, corrected, uses_word, issues: placed.issues };
}
