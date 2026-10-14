import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmSuggestion, getUsage, suggest } from '../../src/js/lib/ai.js';

const sense = { term: 'Bank', part_of_speech: 'noun', translations: ['bank'] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('suggest', () => {
  it('returns the senses on ok and sends the request body', async () => {
    const invoke = vi.fn().mockResolvedValue({ status: 'ok', senses: [sense] });
    expect(await suggest('Bank', 'p1', { invoke })).toEqual({ status: 'ok', senses: [sense], suggestionId: null, confirmed: false });
    expect(invoke.mock.calls[0][0]).toEqual({ term: 'Bank', pair_id: 'p1' });
  });

  it('passes the suggestion id and confirmed flag through', async () => {
    const invoke = async () => ({ status: 'ok', senses: [sense], suggestion_id: 'abc', confirmed: true });
    expect(await suggest('Bank', 'p1', { invoke })).toMatchObject({ suggestionId: 'abc', confirmed: true });
  });

  it('passes not_a_word through', async () => {
    const invoke = async () => ({ status: 'not_a_word', senses: [] });
    expect(await suggest('table', 'p1', { invoke })).toEqual({ status: 'not_a_word', senses: [] });
  });

  it.each([
    ['error', { status: 'error', senses: [] }],
    ['over_cap', { status: 'over_cap', senses: [] }],
    ['ok without senses', { status: 'ok', senses: [] }],
    ['unknown status', { status: 'weird' }],
    ['null body', null],
    ['text body', 'oops'],
  ])('maps %s to unavailable', async (_name, body) => {
    expect(await suggest('Bank', 'p1', { invoke: async () => body })).toEqual({ status: 'unavailable', senses: [] });
  });

  it('maps a thrown error to unavailable', async () => {
    const invoke = async () => {
      throw new Error('HTTP 500');
    };
    expect((await suggest('Bank', 'p1', { invoke })).status).toBe('unavailable');
  });

  it('gives up after the timeout and aborts the request', async () => {
    let signal;
    const invoke = (_body, s) => {
      signal = s;
      return new Promise(() => {});
    };
    const pending = suggest('Bank', 'p1', { invoke });
    await vi.advanceTimersByTimeAsync(7999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ status: 'unavailable', senses: [] });
    expect(signal.aborted).toBe(true);
  });

  it('does not time out a fast answer', async () => {
    const invoke = async () => ({ status: 'ok', senses: [sense] });
    const result = await suggest('Bank', 'p1', { invoke });
    await vi.advanceTimersByTimeAsync(20000);
    expect(result.status).toBe('ok');
  });
});

describe('getUsage', () => {
  it('returns spent and cap and sends the usage action', async () => {
    const invoke = vi.fn().mockResolvedValue({ status: 'ok', spent_usd: 0.5, cap_usd: 2 });
    expect(await getUsage({ invoke })).toEqual({ spent: 0.5, cap: 2 });
    expect(invoke.mock.calls[0][0]).toEqual({ action: 'usage' });
  });

  it('accepts zero spend', async () => {
    const invoke = async () => ({ status: 'ok', spent_usd: 0, cap_usd: 2 });
    expect(await getUsage({ invoke })).toEqual({ spent: 0, cap: 2 });
  });

  it.each([
    ['error status', { status: 'error' }],
    ['missing numbers', { status: 'ok' }],
    ['text numbers', { status: 'ok', spent_usd: '0.5', cap_usd: '2' }],
    ['null body', null],
  ])('returns null for %s', async (_name, body) => {
    expect(await getUsage({ invoke: async () => body })).toBeNull();
  });

  it('returns null when the call throws', async () => {
    const invoke = async () => {
      throw new Error('HTTP 500');
    };
    expect(await getUsage({ invoke })).toBeNull();
  });

  it('returns null after the timeout', async () => {
    const pending = getUsage({ invoke: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toBeNull();
  });
});

describe('confirmSuggestion', () => {
  it('sends only the action, id and index', async () => {
    const invoke = vi.fn().mockResolvedValue({ status: 'ok' });
    expect(await confirmSuggestion('abc', 1, { invoke })).toBe(true);
    expect(invoke.mock.calls[0][0]).toEqual({ action: 'confirm', suggestion_id: 'abc', sense_index: 1 });
  });

  it('returns false on an error status or a thrown error', async () => {
    expect(await confirmSuggestion('abc', 0, { invoke: async () => ({ status: 'error' }) })).toBe(false);
    const invoke = async () => {
      throw new Error('HTTP 500');
    };
    expect(await confirmSuggestion('abc', 0, { invoke })).toBe(false);
  });

  it('returns false after the timeout', async () => {
    const pending = confirmSuggestion('abc', 0, { invoke: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toBe(false);
  });
});
