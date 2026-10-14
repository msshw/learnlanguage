// Thin edge function: input check, user check, cap check, model call (one retry on bad output or
// all-rejected senses, see generate.ts), log.
// All rules live in the pure modules next to this file.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CALL_TIMEOUT_MS, EFFORT, MAX_TERM_LENGTH, MAX_TOKENS, MODEL } from '../_shared/config.ts';
import { cacheKey } from '../_shared/cache.ts';
import { costUsd, isOverCap, usageSummary } from '../_shared/cost.ts';
import { generate, type Call } from './generate.ts';
import { asCandidates, servedSenses } from './serve.ts';
import { systemPrompt } from './prompt.ts';
import { outputSchema } from './schema.ts';
import { isAllowedPair, profileOf } from '../_shared/languages.ts';
import { validate } from '../_shared/validate.ts';
import { cors, json, logCall, readSpend, sessionUser } from '../_shared/ai.ts';

const reply = (status: string, senses: unknown[] = [], suggestionId: string | null = null, confirmed = false) =>
  json({ status, senses, suggestion_id: suggestionId, confirmed });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keys that are not scoped to one workspace need the workspace ID on every request.
const workspaceId = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
  maxRetries: 0,
  ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
});
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Returns the cleaned term, or null when the request body is not acceptable.
function readTerm(body: any): string | null {
  if (!body || typeof body.term !== 'string') return null;
  const term = body.term.trim().replace(/\s+/g, ' ');
  if (!term || term.length > MAX_TERM_LENGTH || /[\u0000-\u001f\u007f]/.test(term)) return null;
  return term;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const user = await sessionUser(admin, req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: any = null;
  try {
    body = await req.json();
  } catch { /* not JSON */ }

  // Settings asks what this month has cost. No model call, nothing logged.
  if (body?.action === 'usage') {
    const spend = await readSpend(admin, user.id);
    return spend ? json({ status: 'ok', ...usageSummary(spend.input, spend.output) }) : json({ status: 'error' });
  }

  // Confirms one sense. Only the id and index are read from the body; stored senses never change.
  // A rejected, unknown or out-of-range sense is an error. No model call, no ai_calls row.
  if (body?.action === 'confirm') {
    const { suggestion_id: id, sense_index: index } = body;
    if (typeof id !== 'string' || !UUID.test(id) || !Number.isInteger(index) || index < 0) return reply('error');
    const { error } = await admin.rpc('confirm_sense', { p_id: id, p_index: index });
    if (error) {
      console.error('confirm failed', error.message);
      return reply('error');
    }
    return json({ status: 'ok' });
  }

  const term = readTerm(body);
  if (!term || typeof body.pair_id !== 'string' || !UUID.test(body.pair_id)) return json({ error: 'bad request' }, 400);

  // The pair comes from the database, filtered by the caller. pair_id is only a lookup key; any
  // language code in the body is never read. Unknown, foreign or unsupported pair: 400, before the
  // cache, the cap and the model, and nothing is written to ai_calls.
  const { data: pair, error: pairError } = await admin
    .from('language_pairs')
    .select('target_lang, native_lang')
    .eq('id', body.pair_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (pairError) {
    console.error('pair read failed', pairError.message);
    return reply('error');
  }
  if (!pair || !isAllowedPair(pair.target_lang, pair.native_lang)) return json({ error: 'bad request' }, 400);
  const profile = profileOf(pair.target_lang);
  const system = systemPrompt(pair);
  const schema = outputSchema(profile);

  // Cache lookup before the cap: a hit costs nothing and is served even over the cap.
  // A failed lookup counts as a miss.
  const key = cacheKey(term);
  for (const column of ['term_key', 'corrected_key']) {
    const { data, error } = await admin
      .from('ai_suggestions')
      .select('id, senses')
      .eq('target_lang', pair.target_lang)
      .eq('native_lang', pair.native_lang)
      .eq(column, key)
      .eq('status', 'confirmed')
      .is('deleted_at', null)
      .order('confirmed_at', { ascending: false })
      .limit(1);
    if (error) console.error('suggestion lookup failed', error.message);
    else if (data?.[0]) {
      // A record with only rejected senses serves nothing and counts as a miss.
      const served = servedSenses(data[0].senses);
      if (served.length > 0) return reply('ok', served, data[0].id, true);
    }
  }

  const spend = await readSpend(admin, user.id);
  if (!spend) return reply('error');
  if (isOverCap(costUsd(spend.input, spend.output))) return reply('over_cap');

  // Rejected senses for this key: filtered out of the answer and listed in the prompt. A failed
  // read is logged and the call goes ahead without them.
  const { data: rejectedRows, error: rejectedError } = await admin
    .from('rejected_senses')
    .select('fingerprint, part_of_speech, translations')
    .eq('target_lang', pair.target_lang)
    .eq('native_lang', pair.native_lang)
    .eq('term_key', key)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (rejectedError) console.error('rejected_senses read failed', rejectedError.message);
  const rejected = rejectedRows ?? [];

  const call: Call = async (message) => {
    const started = Date.now();
    let response;
    try {
      response = await anthropic.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: message }],
          output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
        } as any,
        { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
      );
    } catch (err) {
      return {
        in: 0, out: 0, ms: Date.now() - started, result: null, fatal: true,
        problem: String((err as Error).message ?? err),
      };
    }

    const u = response.usage as any;
    const out = {
      in: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      out: u.output_tokens ?? 0,
      ms: Date.now() - started,
    };
    if (response.stop_reason === 'max_tokens' || response.stop_reason === 'refusal') {
      return { ...out, problem: `stop_reason ${response.stop_reason}`, result: null };
    }
    try {
      const block = response.content.find((b: any) => b.type === 'text') as any;
      const result = validate(JSON.parse(block?.text ?? ''), profile);
      return { ...out, problem: result.ok ? null : result.error, result };
    } catch {
      return { ...out, problem: 'output is not JSON', result: null };
    }
  };

  const generated = await generate(term, rejected, call, (row) => logCall(admin, user.id, 'autofill', row));
  if (generated.status === 'not_a_word') return reply('not_a_word');
  if (generated.status === 'error') return reply('error');

  const stored = asCandidates(generated.senses);
  const { data, error } = await admin
    .from('ai_suggestions')
    .insert({
      target_lang: pair.target_lang,
      native_lang: pair.native_lang,
      term_key: key,
      corrected_key: cacheKey(stored[0].term),
      senses: stored,
      model: MODEL,
      status: 'candidate',
    })
    .select('id')
    .single();
  if (error) console.error('candidate insert failed', error.message);
  return reply('ok', servedSenses(stored), data?.id ?? null);
});
