// The model loop, with the model and the log injected so it can be tested with a fake.
// At most two model calls per request. Validation failures and all-rejected results share them.
import { avoidBlock, filterRejected, type Rejected } from '../_shared/fingerprint.ts';
import { userMessage } from './prompt.ts';
import type { Sense, Validated } from '../_shared/validate.ts';

export type Outcome = {
  in: number;
  out: number;
  ms: number;
  problem: string | null; // set when the output was unusable
  result: Validated | null;
  fatal?: boolean; // transport failure: no retry
};
export type Call = (message: string) => Promise<Outcome>;
export type Log = (row: { in: number; out: number; ms: number; error?: string }) => Promise<void>;

export const ALL_REJECTED = 'all senses rejected';

export type Generated =
  | { status: 'ok'; senses: Sense[] }
  | { status: 'not_a_word' }
  | { status: 'error' };

export async function generate(term: string, rejected: Rejected[], call: Call, log: Log): Promise<Generated> {
  const avoid = avoidBlock(rejected);
  const known = rejected.map((r) => r.fingerprint);
  let lastProblem: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const o = await call(userMessage(term, lastProblem, avoid, attempt > 0));
    const tokens = { in: o.in, out: o.out, ms: o.ms };
    if (o.fatal) {
      await log({ ...tokens, error: o.problem ?? 'call failed' });
      return { status: 'error' };
    }
    if (o.problem || !o.result?.ok) {
      lastProblem = o.problem ?? (o.result && !o.result.ok ? o.result.error : 'no result');
      await log({ ...tokens, error: lastProblem });
      continue;
    }
    if (o.result.status !== 'ok') {
      await log(tokens);
      return { status: 'not_a_word' };
    }
    const senses = filterRejected(o.result.senses, known);
    if (senses.length === 0) {
      lastProblem = 'every sense is one that must not be suggested';
      await log({ ...tokens, error: ALL_REJECTED });
      continue;
    }
    await log(tokens);
    return { status: 'ok', senses };
  }
  return { status: 'error' };
}
