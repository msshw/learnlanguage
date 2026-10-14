// Pure: shapes the read-only admin views. Every output object is built key by key, so a column
// added to a source row never reaches the client. No word text, sentences or error text here.
import { costUsd } from '../_shared/cost.ts';

export const PAGE_SIZE = 50;

// Offset from the request body: an integer from 0, default 0; null when invalid.
export function parseOffset(value: unknown): number | null {
  if (value === undefined) return 0;
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

// Rows are fetched PAGE_SIZE + 1 at a time; the extra row only says there is more.
export const trimPage = <T>(rows: T[]) => ({ rows: rows.slice(0, PAGE_SIZE), has_more: rows.length > PAGE_SIZE });

const usd = (input: number, output: number) => Number(costUsd(input, output).toFixed(6));

export const shapeUser = (r: any) => ({
  email: r.email,
  created_at: r.created_at,
  last_sign_in_at: r.last_sign_in_at ?? null,
  is_admin: r.is_admin === true,
  words: Number(r.word_count),
  reviews: Number(r.review_count),
  practice_attempts: Number(r.sentence_count),
  ai_calls_month: Number(r.ai_calls_month),
  cost_month_usd: usd(Number(r.input_tokens_month), Number(r.output_tokens_month)),
});

export const shapeCall = (r: any) => ({
  created_at: r.created_at,
  email: r.email,
  kind: r.kind,
  model: r.model,
  input_tokens: r.input_tokens,
  output_tokens: r.output_tokens,
  cost_usd: usd(r.input_tokens, r.output_tokens),
  latency_ms: r.latency_ms,
  ok: r.ok === true,
});

// openReports: suggestion id -> number of open reports.
export function shapeSuggestion(r: any, openReports: Map<string, number>) {
  const senses: any[] = Array.isArray(r.senses) ? r.senses : [];
  const count = (state: string) => senses.filter((s) => (s?.state ?? 'candidate') === state).length;
  return {
    term: senses[0]?.term ?? r.corrected_key,
    target_lang: r.target_lang,
    native_lang: r.native_lang,
    status: r.deleted_at ? 'removed' : r.status,
    senses: { candidate: count('candidate'), confirmed: count('confirmed'), rejected: count('rejected') },
    open_reports: openReports.get(r.id) ?? 0,
    created_at: r.created_at,
  };
}
