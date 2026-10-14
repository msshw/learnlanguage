import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRating, highlightSegments, validIssues } from '../../src/js/lib/practice.js';
import { checkSentence } from '../../src/js/lib/ai.js';

const S = 'Ich gehe zu die Bank.';
const issue = (start, end, message = 'm') => ({ start, end, message });

describe('highlightSegments', () => {
  it('returns the whole sentence without issues', () => {
    expect(highlightSegments(S, [])).toEqual([{ text: S, issue: null }]);
  });

  it('cuts around one issue', () => {
    const i = issue(9, 15);
    expect(highlightSegments(S, [i])).toEqual([
      { text: 'Ich gehe ', issue: null },
      { text: 'zu die', issue: i },
      { text: ' Bank.', issue: null },
    ]);
  });

  it('leaves out empty pieces at the edges', () => {
    const i = issue(0, 3);
    const j = issue(16, 21);
    expect(highlightSegments(S, [i, j]).map((s) => s.text)).toEqual(['Ich', ' gehe zu die ', 'Bank.']);
    expect(highlightSegments('Bank', [issue(0, 4)])).toHaveLength(1);
  });

  it('handles two adjacent issues', () => {
    const segments = highlightSegments('abcd', [issue(0, 2), issue(2, 4)]);
    expect(segments.map((s) => s.text)).toEqual(['ab', 'cd']);
  });

  it('keeps markup as plain text', () => {
    expect(highlightSegments('<b>Bank</b>', [issue(3, 7)])[1].text).toBe('Bank');
  });

  it('joins back to the sentence', () => {
    const segments = highlightSegments(S, [issue(0, 3), issue(9, 15)]);
    expect(segments.map((s) => s.text).join('')).toBe(S);
  });
});

describe('validIssues', () => {
  it('accepts none, one and ordered issues', () => {
    expect(validIssues(S, [])).toEqual([]);
    expect(validIssues(S, [issue(9, 15)])).toEqual([issue(9, 15)]);
    expect(validIssues(S, [issue(0, 3), issue(3, 8)])).toHaveLength(2);
  });

  it.each([
    ['end after the sentence', [issue(9, 22)]],
    ['negative start', [issue(-1, 3)]],
    ['empty span', [issue(4, 4)]],
    ['reversed span', [issue(8, 4)]],
    ['overlap', [issue(0, 5), issue(4, 8)]],
    ['wrong order', [issue(9, 15), issue(0, 3)]],
    ['fraction', [issue(0.5, 3)]],
    ['no message', [{ start: 0, end: 3 }]],
    ['blank message', [issue(0, 3, '  ')]],
    ['not an array', 'x'],
    ['null item', [null]],
  ])('rejects %s', (_name, issues) => {
    expect(validIssues(S, issues)).toBeNull();
  });
});

describe('defaultRating', () => {
  it('is Again when the word is not used, even with no issues', () => {
    expect(defaultRating({ status: 'ok', usesWord: false, issues: [] })).toBe(1);
    expect(defaultRating({ status: 'ok', usesWord: false, issues: [issue(0, 3)] })).toBe(1);
  });

  it('is Hard with at least one issue', () => {
    expect(defaultRating({ status: 'ok', usesWord: true, issues: [issue(0, 3)] })).toBe(2);
  });

  it('is Good for a clean sentence', () => {
    expect(defaultRating({ status: 'ok', usesWord: true, issues: [] })).toBe(3);
  });

  it('is none without a successful check', () => {
    expect(defaultRating({ status: 'unavailable' })).toBeNull();
    expect(defaultRating(null)).toBeNull();
  });
});

describe('checkSentence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ok = (over = {}) => ({
    status: 'ok',
    corrected: 'Ich gehe zur Bank.',
    uses_word: true,
    issues: [issue(9, 15, 'zu takes the dative.')],
    ...over,
  });

  it('returns the check and sends only the id and the sentence', async () => {
    const invoke = vi.fn().mockResolvedValue(ok());
    const result = await checkSentence('w1', S, { invoke });
    expect(result).toEqual({
      status: 'ok',
      corrected: 'Ich gehe zur Bank.',
      usesWord: true,
      issues: [issue(9, 15, 'zu takes the dative.')],
    });
    expect(invoke.mock.calls[0][0]).toEqual({ word_id: 'w1', sentence: S });
  });

  it.each([
    ['error', { status: 'error', corrected: null, uses_word: false, issues: [] }],
    ['over_cap', { status: 'over_cap', corrected: null, uses_word: false, issues: [] }],
    ['bad offsets', ok({ issues: [issue(9, 40)] })],
    ['overlapping issues', ok({ issues: [issue(0, 5), issue(4, 8)] })],
    ['missing corrected', ok({ corrected: undefined })],
    ['missing uses_word', ok({ uses_word: 'yes' })],
    ['null body', null],
    ['text body', 'oops'],
  ])('maps %s to unavailable', async (_name, body) => {
    expect(await checkSentence('w1', S, { invoke: async () => body })).toEqual({ status: 'unavailable' });
  });

  it('maps a thrown error to unavailable and does not retry', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('HTTP 500'));
    expect(await checkSentence('w1', S, { invoke })).toEqual({ status: 'unavailable' });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('gives up after 10 seconds and aborts the request', async () => {
    let signal;
    const invoke = (_body, s) => {
      signal = s;
      return new Promise(() => {});
    };
    const pending = checkSentence('w1', S, { invoke });
    await vi.advanceTimersByTimeAsync(9999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(signal.aborted).toBe(true);
  });
});
