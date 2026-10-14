// Code shared by the AI edge functions (autofill, check-sentence): CORS and JSON replies, the
// session check, the month's spend and the ai_calls log row.
import { MODEL } from './config.ts';
import { monthStart } from './cost.ts';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// The caller's user from the Bearer token, or null. The token is verified by Supabase Auth.
export async function sessionUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  return auth.user ?? null;
}

// This month's token totals over all of the user's ai_calls, every kind. Fail closed: null when
// the spend cannot be read, and the caller must not call the model then.
export async function readSpend(admin: any, userId: string) {
  const { data, error } = await admin.rpc('ai_usage_since', {
    p_user: userId,
    p_from: monthStart(new Date()).toISOString(),
  });
  if (error || !data?.[0]) return null;
  return { input: Number(data[0].input_tokens), output: Number(data[0].output_tokens) };
}

export async function logCall(
  admin: any,
  userId: string,
  kind: 'autofill' | 'sentence_check',
  row: { in: number; out: number; ms: number; error?: string },
) {
  const { error } = await admin.from('ai_calls').insert({
    user_id: userId,
    kind,
    model: MODEL,
    input_tokens: row.in,
    output_tokens: row.out,
    latency_ms: row.ms,
    ok: !row.error,
    error: row.error ?? null,
  });
  if (error) console.error('ai_calls insert failed', error.message);
}
