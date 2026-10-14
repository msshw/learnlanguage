import { describe, expect, it } from 'vitest';
import { avoidBlock, filterRejected, fingerprint, MAX_AVOID, toRejected } from '../../supabase/functions/_shared/fingerprint.ts';
import { ALL_REJECTED, generate } from '../../supabase/functions/autofill/generate.ts';
import { userMessage } from '../../supabase/functions/autofill/prompt.ts';
import { asCandidates, servedSenses } from '../../supabase/functions/autofill/serve.ts';
import { costUsd } from '../../supabase/functions/_shared/cost.ts';
import { backfillRows } from '../../scripts/backfill-rejected-senses.ts';

const money = { term: 'Bank', part_of_speech: 'noun', translations: ['bank', 'Lender'] };
const seat = { term: 'Bank', part_of_speech: 'noun', translations: ['bench'] };

describe('fingerprint', () => {
  it('ignores order, case and padding of translations', () => {
    expect(fingerprint({ part_of_speech: 'noun', translations: [' Lender', 'BANK'] })).toBe(fingerprint(money));
  });
  it('depends on the part of speech', () => {
    expect(fingerprint({ ...money, part_of_speech: 'verb' })).not.toBe(fingerprint(money));
  });
  it('depends on the translations', () => {
    expect(fingerprint(seat)).not.toBe(fingerprint(money));
  });
  it('toRejected carries the fingerprint and the readable parts', () => {
    expect(toRejected(seat)).toEqual({ fingerprint: 'noun|bench', part_of_speech: 'noun', translations: ['bench'] });
  });
});

describe('filterRejected', () => {
  it('drops matching senses and keeps the rest', () => {
    expect(filterRejected([money, seat], [fingerprint(money)])).toEqual([seat]);
  });
  it('can leave nothing', () => {
    expect(filterRejected([money], [fingerprint(money)])).toEqual([]);
  });
  it('keeps everything with an empty list', () => {
    expect(filterRejected([money, seat], [])).toEqual([money, seat]);
  });
});

describe('avoidBlock', () => {
  it('is empty without rejected senses', () => expect(avoidBlock([])).toBe(''));
  it('lists one line per sense', () => {
    const text = avoidBlock([money, seat]);
    expect(text).toContain('- noun: bank, Lender');
    expect(text).toContain('- noun: bench');
  });
  it('caps the list', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ part_of_speech: 'noun', translations: [`t${i}`] }));
    expect(avoidBlock(many).split('\n- ').length - 1).toBe(MAX_AVOID);
  });
});

describe('userMessage', () => {
  it('is the bare request without avoid text or problem', () => {
    expect(userMessage('Bank')).toBe('<term>Bank</term>');
  });
  it('adds the avoid block after the request', () => {
    const m = userMessage('Bank', undefined, 'AVOID');
    expect(m.indexOf('<term>')).toBeLessThan(m.indexOf('AVOID'));
  });
  it('strong repeats the avoid block before and after the request', () => {
    const m = userMessage('Bank', undefined, 'AVOID', true);
    expect(m.split('AVOID')).toHaveLength(3);
    expect(m.indexOf('AVOID')).toBeLessThan(m.indexOf('<term>'));
    expect(m.lastIndexOf('AVOID')).toBeGreaterThan(m.indexOf('<term>'));
  });
});

describe('servedSenses and asCandidates', () => {
  it('adds the stored index and state, and hides rejected senses', () => {
    const stored = [
      { ...money, state: 'rejected' },
      { ...seat, state: 'confirmed' },
      { ...money, translations: ['x'], state: 'candidate' },
    ];
    const out = servedSenses(stored);
    expect(out.map((s) => [s.index, s.state])).toEqual([[1, 'confirmed'], [2, 'candidate']]);
  });
  it('treats a missing state as candidate', () => {
    expect(servedSenses([money])[0]).toMatchObject({ index: 0, state: 'candidate' });
  });
  it('marks fresh senses as candidates without judged', () => {
    expect(asCandidates([money])[0]).toEqual({ ...money, state: 'candidate' });
  });
});

describe('generate (two calls at most)', () => {
  const ok = (senses, tokens = {}) => ({ in: 100, out: 50, ms: 1, problem: null, result: { ok: true, status: 'ok', senses }, ...tokens });
  const bad = { in: 100, out: 50, ms: 1, problem: 'bad hint_native', result: { ok: false, error: 'bad hint_native' } };

  const run = async (rejected, outcomes) => {
    const messages = [];
    const logs = [];
    const queue = [...outcomes];
    const result = await generate(
      'Bank',
      rejected,
      async (m) => {
        messages.push(m);
        return queue.shift();
      },
      async (row) => void logs.push(row),
    );
    return { result, messages, logs };
  };

  const rejectedMoney = [toRejected(money)];

  it('returns the senses that are left', async () => {
    const { result, logs } = await run(rejectedMoney, [ok([money, seat])]);
    expect(result).toEqual({ status: 'ok', senses: [seat] });
    expect(logs).toHaveLength(1);
    expect(logs[0].error).toBeUndefined();
  });

  it('retries once when everything was rejected, with the stronger block', async () => {
    const { result, messages, logs } = await run(rejectedMoney, [ok([money]), ok([seat])]);
    expect(result).toEqual({ status: 'ok', senses: [seat] });
    expect(messages).toHaveLength(2);
    expect(messages[0].split('must not appear')).toHaveLength(1);
    expect(messages[1].split('must not appear')).toHaveLength(3);
    expect(logs.map((l) => l.error)).toEqual([ALL_REJECTED, undefined]);
  });

  it('answers error after two all-rejected attempts and logs both with their tokens', async () => {
    const { result, messages, logs } = await run(rejectedMoney, [ok([money]), ok([money])]);
    expect(result).toEqual({ status: 'error' });
    expect(messages).toHaveLength(2);
    expect(logs).toEqual([
      { in: 100, out: 50, ms: 1, error: ALL_REJECTED },
      { in: 100, out: 50, ms: 1, error: ALL_REJECTED },
    ]);
    // both rows count toward the cap
    const spent = logs.reduce((sum, l) => sum + costUsd(l.in, l.out), 0);
    expect(spent).toBeCloseTo(2 * costUsd(100, 50), 12);
  });

  it('shares the two calls between a validation failure and an all-rejected result', async () => {
    const { result, messages, logs } = await run(rejectedMoney, [bad, ok([money])]);
    expect(result).toEqual({ status: 'error' });
    expect(messages).toHaveLength(2);
    expect(logs.map((l) => l.error)).toEqual(['bad hint_native', ALL_REJECTED]);
  });

  it('does not retry a transport failure', async () => {
    const { result, messages } = await run([], [{ in: 0, out: 0, ms: 1, problem: 'timeout', result: null, fatal: true }]);
    expect(result).toEqual({ status: 'error' });
    expect(messages).toHaveLength(1);
  });

  it('passes not_a_word through', async () => {
    const { result } = await run([], [{ in: 1, out: 1, ms: 1, problem: null, result: { ok: true, status: 'not_a_word', senses: [] } }]);
    expect(result).toEqual({ status: 'not_a_word' });
  });
});

describe('backfillRows', () => {
  const record = {
    target_lang: 'de',
    native_lang: 'en',
    term_key: 'bnak',
    corrected_key: 'bank',
    senses: [
      { part_of_speech: 'noun', translations: ['Bank', 'Lender'] },
      { part_of_speech: 'noun', translations: ['Äpfel'] },
    ],
  };

  it('writes each sense under both keys using the shared fingerprint rule', () => {
    const rows = backfillRows([record]);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.term_key).sort()).toEqual(['bank', 'bank', 'bnak', 'bnak']);
    expect(rows.find((r) => r.translations[0] === 'Äpfel').fingerprint).toBe('noun|äpfel');
  });

  it('writes one row per key when both keys are equal', () => {
    expect(backfillRows([{ ...record, corrected_key: 'bnak' }])).toHaveLength(2);
  });

  it('has no duplicates across records', () => {
    expect(backfillRows([record, record])).toHaveLength(4);
  });
});
